/**
 * Phase 5 — 분석 UI·서술: 모델 결과 노출 정책
 * UI와 LLM 입력에 동일하게 적용 (UI만 숨기고 프롬프트 전달 금지).
 */
import type { AssembleAstrologySnapshot, AssembleModelSnapshot } from "./types";

export const DEFAULT_CONFIDENCE_FLOOR = 30;
export const MIN_VALIDATION_SAMPLES = 3;

const FORBIDDEN_STATUSES = new Set([
  "degraded",
  "insufficient_signal",
  "insufficient_data",
  "failed",
  "training",
]);

/** 원국 단독·학습 금지 키가 모델에 있으면 노출 차단 */
const FORBIDDEN_FEATURE_KEYS = new Set([
  "yinRatio",
  "yangRatio",
  "original_rate",
]);

export type ExposureDecision = {
  allowed: boolean;
  reasons: string[];
};

export function evaluateModelExposure(opts: {
  model: AssembleModelSnapshot | null;
  astrology: AssembleAstrologySnapshot | null;
  expectedCalculationVersion?: string | null;
  expectedFeatureSchemaVersion?: string | null;
  confidenceFloor?: number;
}): ExposureDecision {
  const reasons: string[] = [];
  const floor = opts.confidenceFloor ?? DEFAULT_CONFIDENCE_FLOOR;
  const m = opts.model;

  if (!m) {
    return { allowed: false, reasons: ["no_model"] };
  }
  if (!m.predictionVisible) {
    reasons.push("predictionVisible_false");
  }
  if (FORBIDDEN_STATUSES.has(m.modelStatus)) {
    reasons.push(`modelStatus_${m.modelStatus}`);
  }
  if (m.dataStage === "insufficient_data") {
    reasons.push("dataStage_insufficient_data");
  }
  if (
    m.baselineMae != null &&
    m.ridgeMae != null &&
    m.ridgeMae >= m.baselineMae - 1e-9
  ) {
    reasons.push("not_better_than_baseline");
  }
  if (m.maeImprovement != null && m.maeImprovement <= 0) {
    reasons.push("mae_improvement_non_positive");
  }
  if (m.validationSampleCount < MIN_VALIDATION_SAMPLES) {
    reasons.push("validation_sample_insufficient");
  }
  if (m.confidenceScore < floor) {
    reasons.push("confidence_below_floor");
  }
  if (opts.astrology?.elementDistributionApproximate) {
    const elementKeys = ["wood", "fire", "earth", "metal", "water"];
    if (m.featureKeys.some((k) => elementKeys.includes(k))) {
      reasons.push("approximate_element_features");
    }
  }
  for (const k of m.featureKeys) {
    if (FORBIDDEN_FEATURE_KEYS.has(k)) {
      reasons.push(`forbidden_feature_${k}`);
    }
    if (k.startsWith("llm_") || k.includes("unknown")) {
      reasons.push(`unknown_feature_${k}`);
    }
  }
  if (
    opts.expectedCalculationVersion &&
    m.calculationVersion !== opts.expectedCalculationVersion
  ) {
    reasons.push("calculation_version_mismatch");
  }
  if (
    opts.expectedFeatureSchemaVersion &&
    m.featureSchemaVersion !== opts.expectedFeatureSchemaVersion
  ) {
    reasons.push("feature_schema_version_mismatch");
  }
  if (opts.astrology) {
    if (m.calculationVersion !== opts.astrology.calculationVersion) {
      reasons.push("model_vs_snapshot_calculation_mismatch");
    }
    if (m.featureSchemaVersion !== opts.astrology.featureSchemaVersion) {
      reasons.push("model_vs_snapshot_feature_schema_mismatch");
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/** early_signal: 확정 방향 대신 초기 관찰만 */
export function isEarlySignalOnly(dataStage: string | null | undefined): boolean {
  return dataStage === "early_signal";
}
