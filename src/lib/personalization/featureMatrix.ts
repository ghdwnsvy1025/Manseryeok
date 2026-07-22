/**
 * Phase 4 — 개인화 Ridge MVP: allowlist 재검증·상수 제거·특징 행렬
 */
import {
  buildFeatureCatalog,
  type TrainingFeatureContext,
} from "@/lib/astrology/featureAllowlist";
import type { AstrologyFeatureVector } from "@/lib/astrology/types";
import type { DataStage, FeatureRow } from "./types";
import { stageUsesBaseFeaturesOnly } from "./sampleBuckets";

/** early_signal: 오행 5 + 십신 축 5 (+ luck rates는 운 변화로 허용) */
export const EARLY_BASE_KEYS = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
  "axisPeer",
  "axisOutput",
  "axisWealth",
  "axisAuthority",
  "axisResource",
  "luck_daewoon_rate",
  "luck_yearly_rate",
  "luck_monthly_rate",
  "luck_daily_rate",
] as const;

/** active+: 관계 카운트 추가 (lag는 train에서 선택적) */
export const ACTIVE_EXTRA_KEYS = [
  "rel_yukhap",
  "rel_chung",
  "rel_hyeong",
  "rel_pa",
  "rel_hae",
  "rel_cheonGanHap",
  "tenGod_비견",
  "tenGod_겁재",
  "tenGod_식신",
  "tenGod_상관",
  "tenGod_편재",
  "tenGod_정재",
  "tenGod_편관",
  "tenGod_정관",
  "tenGod_편인",
  "tenGod_정인",
] as const;

/** 원국 단독 상수 후보 — interaction 없이 사용 금지 */
export const NATAL_ONLY_KEYS = ["yinRatio", "yangRatio", "original_rate"] as const;

export class AllowlistViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AllowlistViolationError";
  }
}

export const ELEMENT_FEATURE_KEYS = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
] as const;

/**
 * approximate 행에 오행 특징이 주입되면 학습 전체 중단 (제외가 아니라 거부).
 */
export function assertNoApproximateElementInjection(rows: FeatureRow[]): void {
  for (const row of rows) {
    if (!row.elementDistributionApproximate) continue;
    for (const k of ELEMENT_FEATURE_KEYS) {
      if (row.features[k] != null && Number.isFinite(row.features[k])) {
        throw new AllowlistViolationError(
          `approximate 특징 '${k}'는 학습 입력으로 허용되지 않습니다 (날짜 ${row.localDate}).`
        );
      }
    }
  }
}

export function eligibleTrainingKeys(
  ctx: TrainingFeatureContext
): Set<string> {
  return new Set(
    buildFeatureCatalog(ctx)
      .filter((e) => e.eligibleForTraining)
      .map((e) => e.key)
  );
}

export function assertKeysAllowed(
  keys: string[],
  ctx: TrainingFeatureContext
): void {
  const allowed = eligibleTrainingKeys(ctx);
  for (const k of keys) {
    if (!allowed.has(k as keyof AstrologyFeatureVector)) {
      throw new AllowlistViolationError(
        `특징 '${k}'는 allowlist 학습 대상이 아닙니다.`
      );
    }
  }
}

export function candidateKeysForStage(stage: DataStage): string[] {
  if (stage === "insufficient_data") return [];
  if (stageUsesBaseFeaturesOnly(stage)) {
    return [...EARLY_BASE_KEYS];
  }
  return [...EARLY_BASE_KEYS, ...ACTIVE_EXTRA_KEYS];
}

export function removeConstantFeatures(
  keys: string[],
  rows: Record<string, number>[]
): string[] {
  if (rows.length < 2) return keys;
  return keys.filter((k) => {
    const vals = rows.map((r) => r[k]).filter((v) => Number.isFinite(v));
    if (vals.length < 2) return false;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return max - min > 1e-9;
  });
}

export function buildAlignedMatrix(opts: {
  stage: DataStage;
  dates: string[];
  featureRows: FeatureRow[];
  /** 행별 approximate 여부 — true면 해당 날짜 제외 */
  requireVerifiedElements?: boolean;
}): {
  keys: string[];
  X: number[][];
  usedDates: string[];
  ctx: TrainingFeatureContext;
} {
  assertNoApproximateElementInjection(opts.featureRows);

  const byDate = new Map(opts.featureRows.map((r) => [r.localDate, r]));
  const anyApprox = opts.featureRows.some((r) => r.elementDistributionApproximate);
  // 학습 집합 전체에 approximate element 가 섞이면 element 키는 제외
  const ctx: TrainingFeatureContext = {
    elementDistributionApproximate: anyApprox,
  };

  const allowed = eligibleTrainingKeys(ctx);
  let keys = candidateKeysForStage(opts.stage).filter((k) => {
    if ((NATAL_ONLY_KEYS as readonly string[]).includes(k)) return false;
    // approximate / 미허용 키는 후보에서 먼저 제거 (학습 중단이 아니라 제외)
    return allowed.has(k as keyof AstrologyFeatureVector);
  });

  // 최종 후보가 allowlist를 벗어나지 않는지 재검증
  assertKeysAllowed(keys, ctx);

  const usedDates: string[] = [];
  const featureMaps: Record<string, number>[] = [];

  for (const d of opts.dates) {
    const row = byDate.get(d);
    if (!row) continue;
    if (opts.requireVerifiedElements && row.elementDistributionApproximate) {
      // skip dates with approximate element path when requiring verified
      continue;
    }
    const fmap: Record<string, number> = {};
    let ok = true;
    for (const k of keys) {
      const v = row.features[k];
      if (v == null || !Number.isFinite(v)) {
        ok = false;
        break;
      }
      fmap[k] = v;
    }
    if (!ok) continue;
    usedDates.push(d);
    featureMaps.push(fmap);
  }

  keys = removeConstantFeatures(keys, featureMaps);
  assertKeysAllowed(keys, ctx);

  const X = featureMaps.map((fmap) => keys.map((k) => fmap[k]!));
  return { keys, X, usedDates, ctx };
}

export function pickRowFeatures(
  vector: Partial<AstrologyFeatureVector> | Record<string, number>,
  keys: string[]
): number[] {
  return keys.map((k) => {
    const v = (vector as Record<string, number>)[k];
    if (v == null || !Number.isFinite(v)) {
      throw new AllowlistViolationError(`결측 특징: ${k}`);
    }
    return v;
  });
}
