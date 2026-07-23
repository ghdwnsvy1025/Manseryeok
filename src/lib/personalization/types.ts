/**
 * Phase 4 — 개인화 Ridge MVP
 * 마스터 문서 대응: §9 / 구현 Phase 6 (개인화). 본 모듈 명칭은 항상 「Phase 4 — 개인화 Ridge MVP」.
 */
import { FEATURE_CATALOG_VERSION } from "@/lib/astrology/featureAllowlist";

export const PERSONALIZATION_PHASE_LABEL = "Phase 4 — 개인화 Ridge MVP" as const;

export const MODEL_CODE_VERSION = "ridge-mvp-1.1.0";
/** allowlist version = feature catalog version (단일 출처) */
export const ALLOWLIST_VERSION = FEATURE_CATALOG_VERSION;
export const MODEL_TYPE = "ridge" as const;

export type DataStage =
  | "insufficient_data"
  | "early_signal"
  | "active"
  | "stable_candidate";

export type ModelStatus =
  | "active"
  | "degraded"
  | "insufficient_signal"
  | "insufficient_data"
  | "training"
  | "failed";

export type ConfidenceBand =
  | "insufficient"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type ScoreSample = {
  localDate: string;
  rawScore: number;
  /** null = 해당 없음 / 미입력 — 학습·정규화 제외 */
  isNotApplicable?: boolean;
};

export type FeatureRow = {
  localDate: string;
  features: Record<string, number>;
  /** 해당 행의 element % 가 approximate 이면 학습 제외 대상 */
  elementDistributionApproximate?: boolean;
};

export type NormalizedSample = {
  localDate: string;
  rawScore: number;
  normalizedZ: number;
  usedFallbackCenter: boolean;
};

export type BaselineStats = {
  weightedMean: number;
  mean: number;
  std: number;
  validCount: number;
  coverage30d: number;
  lowVariance: boolean;
  halfLifeDays: number;
  maxLookback: number;
};

export type ConfidenceComponents = {
  volume: number;
  coverage: number;
  variation: number;
  recency: number;
  validationImprovement: number;
  stability: number;
};

export type ModelMetrics = {
  baselineMae: number;
  ridgeMae: number;
  maeImprovement: number;
  directionAccuracy: number | null;
  spearmanRho: number | null;
  validationSampleCount: number;
  trainSampleCount: number;
  lambda: number;
};

export type PersonalizationModelRecord = {
  id: string;
  userId: string;
  categoryKey: string;
  modelType: typeof MODEL_TYPE;
  modelStatus: ModelStatus;
  dataStage: DataStage;
  trainingStartDate: string;
  trainingEndDate: string;
  validSampleCount: number;
  featureKeys: string[];
  coefficients: number[];
  intercept: number;
  lambda: number;
  featureMeans: number[];
  featureStds: number[];
  normalization: BaselineStats & { samples: NormalizedSample[] };
  baselineMetrics: { mae: number; prediction: number };
  modelMetrics: ModelMetrics;
  confidenceComponents: ConfidenceComponents;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  predictionVisible: boolean;
  summaryText: string | null;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  modelVersion: string;
  allowlistVersion: string;
  modelCodeVersion: string;
  snapshotIdRange: { from: string | null; to: string | null };
  createdAt: string;
  deprecatedAt: string | null;
  trainingRunKey: string;
};

export type TrainInput = {
  userId: string;
  categoryKey: string;
  scores: ScoreSample[];
  featureRows: FeatureRow[];
  asOfDate?: string;
  previousCoefficients?: number[] | null;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  now?: Date;
};
