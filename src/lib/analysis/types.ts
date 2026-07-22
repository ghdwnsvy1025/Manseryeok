/**
 * Phase 5 — 분석 UI·서술
 * 마스터 대응: Phase 7 (§10·§11). 이후 명칭은 항상 「Phase 5 — 분석 UI·서술」.
 */

export const ANALYSIS_PHASE_LABEL = "Phase 5 — 분석 UI·서술" as const;
export const NARRATIVE_VERSION = "analysis-narrative-1.0.0";

export type PeriodType = "daily" | "weekly" | "monthly";

export type SourceType =
  | "saju_theory"
  | "personal_records"
  | "combined_suggestion";

export type LayerContent = {
  sourceType: SourceType;
  title: string;
  body: string;
  available: boolean;
};

export type AnalysisEvidence = {
  periodStart: string;
  periodEnd: string;
  sampleCount: number;
  confidenceScore: number | null;
  confidenceBand: string | null;
  modelStatus: string | null;
  dataStage: string | null;
  calculationVersion: string | null;
  theoryVersion: string | null;
  featureSchemaVersion: string | null;
  modelVersion: string | null;
  allowlistVersion: string | null;
  correlationNotCausationNote: string;
  recordsNeededForStable: number | null;
};

export type VersionMetadata = {
  calculationVersion: string | null;
  theoryVersion: string | null;
  featureSchemaVersion: string | null;
  modelVersion: string | null;
  allowlistVersion: string | null;
  narrativeVersion: string;
};

export type BaselineSummary = {
  weightedMean: number | null;
  mean: number | null;
  coverage30d: number | null;
  vsBaselineLabel: "higher" | "similar" | "lower" | "unavailable";
  deltaRounded: number | null;
} | null;

export type VerifiedPatternSummary = {
  keys: string[];
  plainSummary: string | null;
} | null;

export type AnalysisViewModel = {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  categoryKey: string;
  categoryLabel: string;
  dataStage: string | null;
  sampleCount: number;
  observationPeriod: { from: string; to: string };
  modelStatus: string | null;
  predictionVisible: boolean;
  /** 모델 기반 방향/패턴을 UI·LLM에 쓸 수 있는지 */
  modelExposureAllowed: boolean;
  confidenceScore: number | null;
  confidenceBand: string | null;
  baselineSummary: BaselineSummary;
  verifiedPatternSummary: VerifiedPatternSummary;
  astrologyTheoryLayer: LayerContent;
  personalRecordLayer: LayerContent;
  actionSuggestionLayer: LayerContent;
  evidence: AnalysisEvidence;
  limitations: string[];
  versionMetadata: VersionMetadata;
  /** 일간: 해당 날짜 journal 존재 여부 */
  hasJournalOnFocusDate: boolean | null;
  /** 주간/월간 집계 요약 (표시용, LLM에 숫자 재생성 금지용 스냅샷) */
  aggregate: {
    recordedDays: number;
    expectedDays: number;
    averageRawScore: number | null;
    topTags: string[];
    missingDates: string[];
  } | null;
  hideReasons: string[];
};

export type AssembleScorePoint = {
  localDate: string;
  rawScore: number | null;
  isNotApplicable?: boolean;
};

export type AssembleModelSnapshot = {
  modelStatus: string;
  dataStage: string;
  predictionVisible: boolean;
  confidenceScore: number;
  confidenceBand: string;
  validSampleCount: number;
  featureKeys: string[];
  baselineWeightedMean: number | null;
  maeImprovement: number | null;
  baselineMae: number | null;
  ridgeMae: number | null;
  validationSampleCount: number;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  modelVersion: string;
  allowlistVersion: string;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  summaryText: string | null;
};

export type AssembleAstrologySnapshot = {
  localDate: string;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  verifiedFeatureKeys: string[];
  elementDistributionApproximate?: boolean;
  theoryPlainSummary?: string | null;
};

export type AssembleInput = {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  /** daily focus date (usually = periodStart) */
  focusDate?: string;
  categoryKey: string;
  categoryLabel: string;
  timezone?: string;
  scores: AssembleScorePoint[];
  tags?: string[];
  astrology: AssembleAstrologySnapshot | null;
  model: AssembleModelSnapshot | null;
  /** 스냅샷 버전과 모델 버전 대조용 */
  expectedCalculationVersion?: string | null;
  expectedFeatureSchemaVersion?: string | null;
  confidenceFloor?: number;
  nowDate?: string;
};
