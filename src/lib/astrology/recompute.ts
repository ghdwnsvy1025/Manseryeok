/**
 * 스냅샷 재계산 인터페이스 — 조용한 덮어쓰기 금지.
 * 대규모 실행은 호출하지 않음 (안정화 단계에서는 준비만).
 */
import {
  CALCULATION_VERSION,
  FEATURE_SCHEMA_VERSION,
  THEORY_VERSION,
} from "./versions";
import type { CalculationMode } from "./types";
import type { AstrologyStorage } from "./snapshot";
import { ensureAstrologySnapshot } from "./snapshot";
import type { SajuProfile } from "@/lib/diary/types";

export type RecomputePlan = {
  /** 새 계산 엔진 버전 (기존 스냅샷과 다르면 신규 행) */
  targetCalculationVersion: string;
  targetFeatureSchemaVersion: string;
  targetTheoryVersion: string;
  modes: CalculationMode[];
  /** inclusive YYYY-MM-DD */
  dateFrom?: string;
  dateTo?: string;
  userId?: string | null;
  deprecateOlderVersions: boolean;
};

export type SnapshotDeprecation = {
  snapshotId: string;
  deprecated: true;
  deprecatedAt: string;
  supersededByVersion: string;
  reason: string;
};

/**
 * 버전 발행 규칙 (문서화 + 가드).
 * - calculationVersion: 오행/운 공식·상수 변경 시
 * - featureSchemaVersion: 벡터 키·의미 변경 시
 * - 기존 행 UPDATE로 덮어쓰기 금지 → ensureAstrologySnapshot의 unique 키로 신규 삽입
 */
export function assertVersionBumpAllowed(plan: RecomputePlan): void {
  if (plan.targetCalculationVersion === CALCULATION_VERSION) {
    // 동일 버전 재실행은 idempotent reuse만 — 덮어쓰기 없음
  }
  if (!plan.targetCalculationVersion || !plan.targetFeatureSchemaVersion) {
    throw new Error("재계산에는 calculation·featureSchema 버전이 필요합니다.");
  }
}

export type RecomputeCommand = {
  kind: "by_date_range" | "by_user";
  plan: RecomputePlan;
  /** journal 원본은 읽기만 — 수정 금지 */
  journalImmutable: true;
};

export function buildDateRangeRecomputeCommand(
  dateFrom: string,
  dateTo: string,
  modes: CalculationMode[] = ["native_with_luck"]
): RecomputeCommand {
  return {
    kind: "by_date_range",
    journalImmutable: true,
    plan: {
      targetCalculationVersion: CALCULATION_VERSION,
      targetFeatureSchemaVersion: FEATURE_SCHEMA_VERSION,
      targetTheoryVersion: THEORY_VERSION,
      modes,
      dateFrom,
      dateTo,
      deprecateOlderVersions: true,
    },
  };
}

export function buildUserRecomputeCommand(
  userId: string,
  modes: CalculationMode[] = ["native_with_luck"]
): RecomputeCommand {
  return {
    kind: "by_user",
    journalImmutable: true,
    plan: {
      targetCalculationVersion: CALCULATION_VERSION,
      targetFeatureSchemaVersion: FEATURE_SCHEMA_VERSION,
      targetTheoryVersion: THEORY_VERSION,
      modes,
      userId,
      deprecateOlderVersions: true,
    },
  };
}

/**
 * 단일 날짜 재생성 — 새 버전이면 새 스냅샷.
 * 과거 Ridge가 참조한 구버전 행은 삭제하지 않음.
 */
export async function recomputeSnapshotForDate(opts: {
  storage: AstrologyStorage;
  userId: string | null;
  localDate: string;
  mode: CalculationMode;
  sajuProfile: SajuProfile;
}): Promise<{ created: boolean; snapshotId: string }> {
  assertVersionBumpAllowed({
    targetCalculationVersion: CALCULATION_VERSION,
    targetFeatureSchemaVersion: FEATURE_SCHEMA_VERSION,
    targetTheoryVersion: THEORY_VERSION,
    modes: [opts.mode],
    deprecateOlderVersions: false,
  });
  const result = await ensureAstrologySnapshot({
    storage: opts.storage,
    userId: opts.userId,
    localDate: opts.localDate,
    calculationMode: opts.mode,
    sajuProfile: opts.sajuProfile,
  });
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { created: !result.reused, snapshotId: result.snapshot.id };
}

/** Ridge 학습 메타에 남길 스냅샷 버전 추적 레코드 */
export type ModelSnapshotVersionRef = {
  modelId: string;
  calculationVersion: string;
  featureSchemaVersion: string;
  theoryVersion: string;
  trainedAt: string;
};
