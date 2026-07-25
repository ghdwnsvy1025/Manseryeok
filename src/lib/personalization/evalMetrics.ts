/**
 * Ridge 섀도 평가 지표.
 * 사용자 live 결과에는 영향 없음 — 비교·저장용.
 */

export const EVAL_METRICS_VERSION = "ridge-eval-v1.0.0";

export type MaturityCohort =
  | "new_user"
  | "d1_6"
  | "d7_29"
  | "d30_89"
  | "d90_plus";

export type RegressionMetrics = {
  n: number;
  mae: number | null;
  rmse: number | null;
};

export type ProbabilisticMetrics = {
  n: number;
  /** 이진 이벤트에만 의미 있음. 연속 점수면 null */
  brier: number | null;
  logLoss: number | null;
  /** ECE — expected calibration error */
  calibrationError: number | null;
};

export type EngagementMetrics = {
  questionFitRate: number | null;
  diaryStartRate: number | null;
  diaryCompleteRate: number | null;
  nShown: number;
  nFitGood: number;
  nDiaryStarted: number;
  nDiaryCompleted: number;
};

export type CohortEval = {
  cohort: MaturityCohort;
  priorUniqueDays: number;
  regression: {
    live: RegressionMetrics;
    ridge: RegressionMetrics;
    maeDelta: number | null;
    rmseDelta: number | null;
  };
  probabilistic: {
    live: ProbabilisticMetrics;
    ridge: ProbabilisticMetrics;
  };
  engagement: EngagementMetrics;
};

export type ShadowEvalReport = {
  version: string;
  overall: CohortEval;
  byCohort: CohortEval[];
  modelRowDiagnosis: ModelRowDiagnosis;
};

export type ModelRowDiagnosis = {
  modelRows: number;
  reasons: Array<
    | "ok"
    | "inference_not_run"
    | "db_persist_failed"
    | "feature_flag_off"
    | "insufficient_data"
    | "code_path_unwired"
  >;
  detail: string;
};

export function maturityCohort(priorUniqueDays: number): MaturityCohort {
  if (priorUniqueDays <= 0) return "new_user";
  if (priorUniqueDays <= 6) return "d1_6";
  if (priorUniqueDays <= 29) return "d7_29";
  if (priorUniqueDays <= 89) return "d30_89";
  return "d90_plus";
}

export function computeMae(actual: number[], pred: number[]): number | null {
  if (actual.length === 0 || actual.length !== pred.length) return null;
  let s = 0;
  for (let i = 0; i < actual.length; i++) {
    s += Math.abs(actual[i]! - pred[i]!);
  }
  return s / actual.length;
}

export function computeRmse(actual: number[], pred: number[]): number | null {
  if (actual.length === 0 || actual.length !== pred.length) return null;
  let s = 0;
  for (let i = 0; i < actual.length; i++) {
    const d = actual[i]! - pred[i]!;
    s += d * d;
  }
  return Math.sqrt(s / actual.length);
}

function regressionMetrics(
  actual: number[],
  pred: number[]
): RegressionMetrics {
  return {
    n: actual.length,
    mae: computeMae(actual, pred),
    rmse: computeRmse(actual, pred),
  };
}

/**
 * 점수를 0~1 확률로 보고 이진 라벨(>= threshold)에 대한 Brier / log loss / ECE.
 * 운세·일기 점수(1~10)를 threshold=5.5로 이진화한다.
 */
export function computeProbabilisticMetrics(
  actual: number[],
  pred: number[],
  threshold = 5.5,
  bins = 5
): ProbabilisticMetrics {
  if (actual.length === 0 || actual.length !== pred.length) {
    return { n: 0, brier: null, logLoss: null, calibrationError: null };
  }

  const toProb = (v: number) =>
    Math.max(0.001, Math.min(0.999, (v - 1) / 9));

  let brier = 0;
  let logLoss = 0;
  const binSums = Array.from({ length: bins }, () => ({
    p: 0,
    y: 0,
    n: 0,
  }));

  for (let i = 0; i < actual.length; i++) {
    const y = actual[i]! >= threshold ? 1 : 0;
    const p = toProb(pred[i]!);
    brier += (p - y) * (p - y);
    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    const bi = Math.min(bins - 1, Math.floor(p * bins));
    binSums[bi]!.p += p;
    binSums[bi]!.y += y;
    binSums[bi]!.n += 1;
  }

  let ece = 0;
  for (const b of binSums) {
    if (b.n === 0) continue;
    const avgP = b.p / b.n;
    const avgY = b.y / b.n;
    ece += (b.n / actual.length) * Math.abs(avgP - avgY);
  }

  return {
    n: actual.length,
    brier: brier / actual.length,
    logLoss: logLoss / actual.length,
    calibrationError: ece,
  };
}

export function computeEngagementMetrics(input: {
  shown: number;
  fitGood: number;
  diaryStarted: number;
  diaryCompleted: number;
}): EngagementMetrics {
  const { shown, fitGood, diaryStarted, diaryCompleted } = input;
  return {
    nShown: shown,
    nFitGood: fitGood,
    nDiaryStarted: diaryStarted,
    nDiaryCompleted: diaryCompleted,
    questionFitRate: shown > 0 ? fitGood / shown : null,
    diaryStartRate: shown > 0 ? diaryStarted / shown : null,
    diaryCompleteRate:
      diaryStarted > 0 ? diaryCompleted / diaryStarted : null,
  };
}

function emptyEngagement(): EngagementMetrics {
  return computeEngagementMetrics({
    shown: 0,
    fitGood: 0,
    diaryStarted: 0,
    diaryCompleted: 0,
  });
}

export function buildCohortEval(input: {
  cohort: MaturityCohort;
  priorUniqueDays: number;
  actual: number[];
  livePred: number[];
  ridgePred: number[];
  engagement?: EngagementMetrics;
}): CohortEval {
  const live = regressionMetrics(input.actual, input.livePred);
  const ridge = regressionMetrics(input.actual, input.ridgePred);
  const maeDelta =
    live.mae != null && ridge.mae != null
      ? Math.round((live.mae - ridge.mae) * 1000) / 1000
      : null;
  const rmseDelta =
    live.rmse != null && ridge.rmse != null
      ? Math.round((live.rmse - ridge.rmse) * 1000) / 1000
      : null;

  return {
    cohort: input.cohort,
    priorUniqueDays: input.priorUniqueDays,
    regression: { live, ridge, maeDelta, rmseDelta },
    probabilistic: {
      live: computeProbabilisticMetrics(input.actual, input.livePred),
      ridge: computeProbabilisticMetrics(input.actual, input.ridgePred),
    },
    engagement: input.engagement ?? emptyEngagement(),
  };
}

/**
 * Ridge 모델 행이 0개인 이유를 진단.
 * 실제 섀도 로그를 만든 뒤에만 제거 여부를 판단한다.
 */
export function diagnoseModelRows(input: {
  modelRows: number;
  trainFlagOn: boolean;
  inferenceAttempted: boolean;
  lastPersistError?: string | null;
  sampleCount?: number;
  minSamples?: number;
}): ModelRowDiagnosis {
  if (input.modelRows > 0) {
    return {
      modelRows: input.modelRows,
      reasons: ["ok"],
      detail: `${input.modelRows}개 모델 행 존재`,
    };
  }

  const reasons: ModelRowDiagnosis["reasons"] = [];
  const parts: string[] = [];

  if (!input.trainFlagOn) {
    reasons.push("feature_flag_off");
    parts.push("학습 플래그 OFF");
  }
  if (!input.inferenceAttempted) {
    reasons.push("inference_not_run");
    parts.push("추론 미실행");
  }
  if (input.lastPersistError) {
    reasons.push("db_persist_failed");
    parts.push(`DB 저장 실패: ${input.lastPersistError}`);
  }
  const min = input.minSamples ?? 14;
  if ((input.sampleCount ?? 0) < min) {
    reasons.push("insufficient_data");
    parts.push(`표본 ${(input.sampleCount ?? 0)} < ${min}`);
  }
  if (reasons.length === 0) {
    reasons.push("code_path_unwired");
    parts.push("코드 경로 미연결 가능성");
  }

  return {
    modelRows: 0,
    reasons,
    detail: parts.join(" · "),
  };
}

export function buildShadowEvalReport(input: {
  priorUniqueDays: number;
  actual: number[];
  livePred: number[];
  ridgePred: number[];
  engagement?: EngagementMetrics;
  modelDiagnosis: ModelRowDiagnosis;
  /** 코호트별 추가 표본이 있으면 넣는다. 없으면 overall만. */
  cohortSlices?: Array<{
    cohort: MaturityCohort;
    priorUniqueDays: number;
    actual: number[];
    livePred: number[];
    ridgePred: number[];
    engagement?: EngagementMetrics;
  }>;
}): ShadowEvalReport {
  const overall = buildCohortEval({
    cohort: maturityCohort(input.priorUniqueDays),
    priorUniqueDays: input.priorUniqueDays,
    actual: input.actual,
    livePred: input.livePred,
    ridgePred: input.ridgePred,
    engagement: input.engagement,
  });

  const byCohort =
    input.cohortSlices?.map((s) =>
      buildCohortEval({
        cohort: s.cohort,
        priorUniqueDays: s.priorUniqueDays,
        actual: s.actual,
        livePred: s.livePred,
        ridgePred: s.ridgePred,
        engagement: s.engagement,
      })
    ) ?? [overall];

  return {
    version: EVAL_METRICS_VERSION,
    overall,
    byCohort,
    modelRowDiagnosis: input.modelDiagnosis,
  };
}
