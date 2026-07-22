/**
 * Phase 4 Ridge용 feature allowlist.
 * 근사(approximate) 특징은 기본 학습·사용자 해석에서 제외.
 */
import type { AstrologyCalcInput, AstrologyFeatureVector } from "./types";

export type FeatureImplementationStatus = "verified" | "approximate";

export type FeatureCatalogEntry = {
  key: keyof AstrologyFeatureVector;
  implementationStatus: FeatureImplementationStatus;
  sourceSection: string;
  approximationReason?: string;
  eligibleForTraining: boolean;
  eligibleForUserInterpretation: boolean;
};

/** 오행 %가 근사인지 — 월/일운 포함 또는 luck_only 다수 운 */
export function isElementDistributionApproximate(
  input: Pick<
    AstrologyCalcInput,
    "calculationMode" | "monthly" | "daily" | "daewoon" | "yearly"
  >
): boolean {
  const hasMonthly = Boolean(input.monthly);
  const hasDaily = Boolean(input.daily);
  if (hasMonthly || hasDaily) return true;

  if (input.calculationMode === "luck_only") {
    const n = [input.daewoon, input.yearly, input.monthly, input.daily].filter(
      Boolean
    ).length;
    return n >= 2;
  }
  return false;
}

const VERIFIED_STATIC: Array<keyof AstrologyFeatureVector> = [
  "yinRatio",
  "yangRatio",
  "axisPeer",
  "axisOutput",
  "axisWealth",
  "axisAuthority",
  "axisResource",
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
  "rel_yukhap",
  "rel_chung",
  "rel_hyeong",
  "rel_pa",
  "rel_hae",
  "rel_cheonGanHap",
  "luck_daewoon_rate",
  "luck_yearly_rate",
  "luck_monthly_rate",
  "luck_daily_rate",
  "original_rate",
];

const ELEMENT_KEYS: Array<keyof AstrologyFeatureVector> = [
  "wood",
  "fire",
  "earth",
  "metal",
  "water",
];

export function buildFeatureCatalog(opts: {
  elementDistributionApproximate: boolean;
}): FeatureCatalogEntry[] {
  const entries: FeatureCatalogEntry[] = [];

  for (const key of ELEMENT_KEYS) {
    if (opts.elementDistributionApproximate) {
      entries.push({
        key,
        implementationStatus: "approximate",
        sourceSection: "B-13-native-with-luck|B-14-luck-only",
        approximationReason:
          "월·일운 toHigher 또는 luck_only ordered-pair 전량 미구현; percentage 근사 경로",
        eligibleForTraining: false,
        eligibleForUserInterpretation: false,
      });
    } else {
      entries.push({
        key,
        implementationStatus: "verified",
        sourceSection: "B-1..B-7|B-13-partial",
        eligibleForTraining: true,
        eligibleForUserInterpretation: true,
      });
    }
  }

  for (const key of VERIFIED_STATIC) {
    const isRate = key.endsWith("_rate") || key === "original_rate";
    entries.push({
      key,
      implementationStatus: "verified",
      sourceSection: isRate
        ? "B-13-native-with-luck|B-14-luck-only"
        : key.startsWith("tenGod") || key.startsWith("axis")
          ? "A-intro-9|hiddenStems"
          : key.startsWith("rel_")
            ? "interpretation/relations"
            : "B-2-polarity",
      eligibleForTraining: true,
      eligibleForUserInterpretation: true,
    });
  }

  return entries;
}

export type TrainingFeatureContext = {
  elementDistributionApproximate: boolean;
};

/** Phase 4 기본: allowlist만 추출 */
export function pickTrainingFeatures(
  vector: AstrologyFeatureVector,
  ctx: TrainingFeatureContext
): Partial<AstrologyFeatureVector> {
  const catalog = buildFeatureCatalog(ctx);
  const out: Partial<AstrologyFeatureVector> = {};
  for (const entry of catalog) {
    if (!entry.eligibleForTraining) continue;
    out[entry.key] = vector[entry.key];
  }
  return out;
}

export function listExcludedFromTraining(
  ctx: TrainingFeatureContext
): Array<keyof AstrologyFeatureVector> {
  return buildFeatureCatalog(ctx)
    .filter((e) => !e.eligibleForTraining)
    .map((e) => e.key);
}

export const FEATURE_CATALOG_VERSION = "saju-feature-catalog-1.0.0";
