/**
 * 과거 일기 특징 백필 — 순수 계획 계층.
 * HTTP 장시간 요청으로 전체 백필을 돌리지 않는다.
 * CLI/워커가 이 모듈의 배치·커서·멱등 규칙을 따른다.
 */

export const DIARY_BACKFILL_VERSION = "diary-features-v1.0.0";

export type BackfillEntryRef = {
  id: string;
  userId: string;
  entryDate: string;
  /** 이미 같은 버전으로 분석된 스냅샷이 있으면 true */
  hasMatchingSnapshot: boolean;
  /** 사용자 삭제·탈퇴로 제외 */
  userDeleted?: boolean;
  firstRecordedAt?: string | null;
  createdAt?: string | null;
};

export type BackfillAction =
  | { type: "skip"; reason: "same_version" | "user_deleted" | "out_of_range" }
  | { type: "ensure_first_recorded_at"; value: string }
  | { type: "create_snapshot" }
  | { type: "noop_ready" };

export type BackfillJobOptions = {
  modelVersion: string;
  userId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  batchSize: number;
  dryRun: boolean;
  cursor?: string | null;
};

export type BackfillProgress = {
  scanned: number;
  skippedSameVersion: number;
  skippedDeleted: number;
  ensuredFirstRecordedAt: number;
  snapshotsToCreate: number;
  snapshotsCreated: number;
  errors: number;
  dryRun: boolean;
  modelVersion: string;
  cursor: string | null;
  cancelled: boolean;
};

export function defaultBackfillOptions(
  overrides: Partial<BackfillJobOptions> = {}
): BackfillJobOptions {
  return {
    modelVersion: DIARY_BACKFILL_VERSION,
    userId: null,
    fromDate: null,
    toDate: null,
    batchSize: 50,
    dryRun: true,
    cursor: null,
    ...overrides,
  };
}

export function emptyProgress(
  opts: BackfillJobOptions
): BackfillProgress {
  return {
    scanned: 0,
    skippedSameVersion: 0,
    skippedDeleted: 0,
    ensuredFirstRecordedAt: 0,
    snapshotsToCreate: 0,
    snapshotsCreated: 0,
    errors: 0,
    dryRun: opts.dryRun,
    modelVersion: opts.modelVersion,
    cursor: opts.cursor ?? null,
    cancelled: false,
  };
}

/** 날짜 범위·사용자 필터 */
export function isInScope(
  entry: BackfillEntryRef,
  opts: BackfillJobOptions
): boolean {
  if (opts.userId && entry.userId !== opts.userId) return false;
  if (opts.fromDate && entry.entryDate < opts.fromDate) return false;
  if (opts.toDate && entry.entryDate > opts.toDate) return false;
  return true;
}

/**
 * 한 행에 대해 수행할 액션 목록.
 * 원문(content)은 입력에 포함하지 않는다 — 호출부가 넘기면 안 된다.
 */
export function planEntryActions(
  entry: BackfillEntryRef,
  opts: BackfillJobOptions
): BackfillAction[] {
  if (entry.userDeleted) {
    return [{ type: "skip", reason: "user_deleted" }];
  }
  if (!isInScope(entry, opts)) {
    return [{ type: "skip", reason: "out_of_range" }];
  }
  if (entry.hasMatchingSnapshot) {
    return [{ type: "skip", reason: "same_version" }];
  }

  const actions: BackfillAction[] = [];
  if (!entry.firstRecordedAt && entry.createdAt) {
    actions.push({
      type: "ensure_first_recorded_at",
      value: entry.createdAt,
    });
  }
  actions.push({ type: "create_snapshot" });
  return actions;
}

/** 커서: entry_date|id 로 정렬 재개 */
export function encodeCursor(entryDate: string, id: string): string {
  return `${entryDate}|${id}`;
}

export function decodeCursor(
  cursor: string | null | undefined
): { entryDate: string; id: string } | null {
  if (!cursor) return null;
  const idx = cursor.indexOf("|");
  if (idx <= 0) return null;
  return {
    entryDate: cursor.slice(0, idx),
    id: cursor.slice(idx + 1),
  };
}

export function applyActionToProgress(
  progress: BackfillProgress,
  action: BackfillAction,
  applied: boolean
): void {
  if (action.type === "skip") {
    if (action.reason === "same_version") progress.skippedSameVersion += 1;
    if (action.reason === "user_deleted") progress.skippedDeleted += 1;
    return;
  }
  if (action.type === "ensure_first_recorded_at") {
    if (applied) progress.ensuredFirstRecordedAt += 1;
    return;
  }
  if (action.type === "create_snapshot") {
    progress.snapshotsToCreate += 1;
    if (applied) progress.snapshotsCreated += 1;
  }
}

/**
 * 배치 한도만큼 액션을 모은다. 원문 필드는 절대 결과에 넣지 않는다.
 */
export function planBatch(
  entries: BackfillEntryRef[],
  opts: BackfillJobOptions
): {
  plans: Array<{ entryId: string; entryDate: string; userId: string; actions: BackfillAction[] }>;
  nextCursor: string | null;
} {
  const plans: Array<{
    entryId: string;
    entryDate: string;
    userId: string;
    actions: BackfillAction[];
  }> = [];

  const sorted = [...entries].sort((a, b) => {
    if (a.entryDate !== b.entryDate) return a.entryDate < b.entryDate ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const cursor = decodeCursor(opts.cursor);
  let nextCursor: string | null = null;

  for (const entry of sorted) {
    if (cursor) {
      if (
        entry.entryDate < cursor.entryDate ||
        (entry.entryDate === cursor.entryDate && entry.id <= cursor.id)
      ) {
        continue;
      }
    }
    const actions = planEntryActions(entry, opts);
    const useful = actions.some((a) => a.type !== "skip");
    if (useful || actions[0]?.type === "skip") {
      plans.push({
        entryId: entry.id,
        entryDate: entry.entryDate,
        userId: entry.userId,
        actions,
      });
    }
    nextCursor = encodeCursor(entry.entryDate, entry.id);
    if (plans.length >= opts.batchSize) break;
  }

  return { plans, nextCursor };
}
