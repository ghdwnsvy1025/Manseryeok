/**
 * 회상 신뢰도 — first_recorded_at 기반
 *
 * 왜 필요한가
 * - 오늘 기록한 오늘 일기와, 3주 뒤에 몰아서 채워 넣은 일기를 통계에서
 *   같은 무게로 쓰면 안 된다. 회상 편향(기억 왜곡·평탄화)이 섞이기 때문이다.
 * - updated_at은 나중에 고칠 때마다 바뀌므로 쓸 수 없다.
 *   "그 날짜를 처음 기록한 시각"(first_recorded_at)이 필요하다.
 */

export const RECALL_CONFIDENCE_VERSION = "recall-confidence-v1.0.0";

/** 이 일수 이내 기록은 당일 기록과 동등하게 본다 (자기 전/다음날 아침) */
export const RECALL_GRACE_DAYS = 1;
/** 지수 감쇠 시상수 (일) */
export const RECALL_DECAY_DAYS = 5;
/** 아무리 오래돼도 이 아래로는 내려가지 않는다 */
export const RECALL_CONFIDENCE_FLOOR = 0.25;
/** 통계에 포함할 최소 회상 신뢰도 */
export const MIN_STATS_RECALL_CONFIDENCE = 0.4;

export type RecallTier =
  | "same_day"
  | "next_day"
  | "recent_recall"
  | "distant_recall";

export type RecallAssessment = {
  /** 기록 대상 날짜와 최초 기록 시각의 차이 (일). 음수는 0으로 클램프 */
  lagDays: number;
  confidence: number;
  tier: RecallTier;
  /** 통계 집계에 포함해도 되는가 */
  usableForStats: boolean;
  version: string;
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** YYYY-MM-DD를 UTC 자정으로 해석 */
function dateToUtcMs(dateStr: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const ms = Date.parse(`${dateStr}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function recallLagDays(
  entryDate: string,
  firstRecordedAt: string | null | undefined
): number {
  if (!firstRecordedAt) return 0;
  const entryMs = dateToUtcMs(entryDate);
  const recordedMs = Date.parse(firstRecordedAt);
  if (entryMs == null || !Number.isFinite(recordedMs)) return 0;
  // 기록 시각도 날짜 단위로 내려서 비교 — 같은 날 밤 11시가 lag 1이 되면 안 된다
  const recordedDayMs = Math.floor(recordedMs / 86400000) * 86400000;
  const lag = (recordedDayMs - entryMs) / 86400000;
  return Math.max(0, Math.round(lag));
}

export function recallConfidenceFromLag(lagDays: number): number {
  const lag = Math.max(0, lagDays);
  if (lag <= RECALL_GRACE_DAYS) return 1;
  const decayed = Math.exp(-(lag - RECALL_GRACE_DAYS) / RECALL_DECAY_DAYS);
  return round4(
    RECALL_CONFIDENCE_FLOOR + (1 - RECALL_CONFIDENCE_FLOOR) * decayed
  );
}

function tierFromLag(lagDays: number): RecallTier {
  if (lagDays === 0) return "same_day";
  if (lagDays === 1) return "next_day";
  if (lagDays <= 7) return "recent_recall";
  return "distant_recall";
}

export function assessRecall(
  entryDate: string,
  firstRecordedAt: string | null | undefined
): RecallAssessment {
  const lagDays = recallLagDays(entryDate, firstRecordedAt);
  const confidence = recallConfidenceFromLag(lagDays);
  return {
    lagDays,
    confidence,
    tier: tierFromLag(lagDays),
    usableForStats: confidence >= MIN_STATS_RECALL_CONFIDENCE,
    version: RECALL_CONFIDENCE_VERSION,
  };
}

export type RecallSummary = {
  total: number;
  usable: number;
  excluded: number;
  /** 사용 가능한 기록들의 평균 회상 신뢰도 */
  averageConfidence: number;
  byTier: Record<RecallTier, number>;
};

export function summarizeRecall(
  rows: Array<{ entryDate: string; firstRecordedAt?: string | null }>
): RecallSummary {
  const byTier: Record<RecallTier, number> = {
    same_day: 0,
    next_day: 0,
    recent_recall: 0,
    distant_recall: 0,
  };
  let usable = 0;
  let confidenceSum = 0;

  for (const r of rows) {
    const a = assessRecall(r.entryDate, r.firstRecordedAt);
    byTier[a.tier] += 1;
    if (a.usableForStats) {
      usable += 1;
      confidenceSum += a.confidence;
    }
  }

  return {
    total: rows.length,
    usable,
    excluded: rows.length - usable,
    averageConfidence: usable > 0 ? round4(confidenceSum / usable) : 0,
    byTier,
  };
}
