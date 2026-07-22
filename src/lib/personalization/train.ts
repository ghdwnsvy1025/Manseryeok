/**
 * Phase 4 — 개인화 Ridge MVP: 학습 오케스트레이션
 */
import {
  baselinePredictionZ,
  computeBaselineStats,
  normalizeScores,
} from "./baseline";
import {
  computeConfidenceComponents,
  scoreConfidence,
} from "./confidence";
import {
  AllowlistViolationError,
  assertKeysAllowed,
  buildAlignedMatrix,
} from "./featureMatrix";
import {
  DEFAULT_LAMBDA,
  LAMBDA_CANDIDATES,
  directionAccuracy,
  fitRidge,
  mae,
  predictRidge,
  spearmanRho,
  type RidgeFit,
} from "./ridge";
import { resolveDataStage, stageAllowsRidge } from "./sampleBuckets";
import {
  ALLOWLIST_VERSION,
  MODEL_CODE_VERSION,
  MODEL_TYPE,
  PERSONALIZATION_PHASE_LABEL,
  type ModelStatus,
  type PersonalizationModelRecord,
  type TrainInput,
} from "./types";

function id(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function daysBetween(a: string, b: string): number {
  return (
    Math.abs(
      Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)
    ) /
    (1000 * 60 * 60 * 24)
  );
}

/** 시간순: 날짜 단위로 마지막 20% holdout (같은 날짜 train/val 분리 금지) */
export function timeOrderedSplit(
  dates: string[],
  holdoutFraction = 0.2
): { trainDates: string[]; valDates: string[] } {
  const unique = Array.from(new Set(dates)).sort();
  if (unique.length < 5) {
    return { trainDates: unique, valDates: [] };
  }
  const nVal = Math.max(1, Math.floor(unique.length * holdoutFraction));
  const cut = unique.length - nVal;
  return {
    trainDates: unique.slice(0, cut),
    valDates: unique.slice(cut),
  };
}

export function buildTrainingRunKey(input: {
  userId: string;
  categoryKey: string;
  validSampleCount: number;
  calculationVersion: string;
  featureSchemaVersion: string;
  allowlistVersion: string;
  modelCodeVersion: string;
  endDate: string;
}): string {
  return [
    input.userId,
    input.categoryKey,
    input.validSampleCount,
    input.endDate,
    input.calculationVersion,
    input.featureSchemaVersion,
    input.allowlistVersion,
    input.modelCodeVersion,
  ].join("|");
}

export function shouldRetrain(opts: {
  lastTrainAt: string | null;
  lastValidCount: number;
  currentValidCount: number;
  lastCalculationVersion: string | null;
  lastFeatureSchemaVersion: string | null;
  lastAllowlistVersion: string | null;
  lastModelCodeVersion: string | null;
  calculationVersion: string;
  featureSchemaVersion: string;
  allowlistVersion: string;
  modelCodeVersion: string;
  now: Date;
}): boolean {
  if (!opts.lastTrainAt) return true;
  if (opts.currentValidCount - opts.lastValidCount >= 3) return true;
  const last = Date.parse(opts.lastTrainAt);
  const days = (opts.now.getTime() - last) / (1000 * 60 * 60 * 24);
  if (days >= 7) return true;
  if (opts.lastCalculationVersion !== opts.calculationVersion) return true;
  if (opts.lastFeatureSchemaVersion !== opts.featureSchemaVersion) return true;
  if (opts.lastAllowlistVersion !== opts.allowlistVersion) return true;
  if (opts.lastModelCodeVersion !== opts.modelCodeVersion) return true;
  return false;
}

function coefCorrelation(a: number[] | null | undefined, b: number[]): number | null {
  if (!a || a.length !== b.length || a.length === 0) return null;
  return spearmanRho(a, b);
}

function summaryFor(opts: {
  status: ModelStatus;
  stage: string;
  visible: boolean;
  validCount: number;
}): string {
  if (opts.stage === "insufficient_data") {
    return `현재 유효 기록이 ${opts.validCount}개입니다. 개인 패턴을 보려면 카테고리별로 14개 이상 기록이 필요합니다. 이 안내는 통계적 안내이며 사주 확정이 아닙니다.`;
  }
  if (!opts.visible) {
    return "뚜렷한 반복 패턴이 아직 확인되지 않았습니다. 이 결과는 개인 기록의 상관관계를 찾기 위한 것이며 원인이나 미래를 확정하지 않습니다.";
  }
  if (opts.stage === "early_signal") {
    return "초기 경향으로만 참고하세요. 최근 기록에서 일부 특징과 점수의 동반 패턴이 관찰될 수 있으나, 표본이 적어 안정적이지 않을 수 있습니다.";
  }
  return "최근 기록에서는 특정 검증 특징이 높았던 날에 해당 카테고리 점수가 평소와 다르게 나타나는 경향이 있었습니다. 이는 개인 기록의 상관관계이며 원인을 단정하지 않습니다.";
}

export type TrainResult =
  | { ok: true; model: PersonalizationModelRecord }
  | { ok: false; error: string; model?: PersonalizationModelRecord };

export function trainCategoryModel(input: TrainInput): TrainResult {
  const asOf =
    input.asOfDate ??
    [...input.scores.map((s) => s.localDate)].sort().at(-1) ??
    new Date().toISOString().slice(0, 10);

  const { baseline, samples } = normalizeScores(input.scores, asOf);
  const stage = resolveDataStage(baseline.validCount);
  const nowIso = (input.now ?? new Date()).toISOString();
  const startDate = samples[0]?.localDate ?? asOf;
  const endDate = samples.at(-1)?.localDate ?? asOf;

  const baseRecord = (): Omit<
    PersonalizationModelRecord,
    | "featureKeys"
    | "coefficients"
    | "intercept"
    | "lambda"
    | "featureMeans"
    | "featureStds"
    | "modelMetrics"
    | "baselineMetrics"
    | "confidenceComponents"
    | "confidenceScore"
    | "confidenceBand"
    | "predictionVisible"
    | "summaryText"
    | "modelStatus"
  > & { modelStatus: ModelStatus } => ({
    id: id(),
    userId: input.userId,
    categoryKey: input.categoryKey,
    modelType: MODEL_TYPE,
    modelStatus: "insufficient_data",
    dataStage: stage,
    trainingStartDate: startDate,
    trainingEndDate: endDate,
    validSampleCount: baseline.validCount,
    normalization: { ...baseline, samples },
    calculationVersion: input.calculationVersion,
    theoryVersion: input.theoryVersion,
    featureSchemaVersion: input.featureSchemaVersion,
    modelVersion: `${MODEL_CODE_VERSION}+${asOf}`,
    allowlistVersion: ALLOWLIST_VERSION,
    modelCodeVersion: MODEL_CODE_VERSION,
    snapshotIdRange: { from: null, to: null },
    createdAt: nowIso,
    deprecatedAt: null,
    trainingRunKey: buildTrainingRunKey({
      userId: input.userId,
      categoryKey: input.categoryKey,
      validSampleCount: baseline.validCount,
      calculationVersion: input.calculationVersion,
      featureSchemaVersion: input.featureSchemaVersion,
      allowlistVersion: ALLOWLIST_VERSION,
      modelCodeVersion: MODEL_CODE_VERSION,
      endDate,
    }),
  });

  if (!stageAllowsRidge(stage)) {
    const model: PersonalizationModelRecord = {
      ...baseRecord(),
      featureKeys: [],
      coefficients: [],
      intercept: 0,
      lambda: DEFAULT_LAMBDA,
      featureMeans: [],
      featureStds: [],
      baselineMetrics: { mae: 0, prediction: baseline.weightedMean },
      modelMetrics: {
        baselineMae: 0,
        ridgeMae: 0,
        maeImprovement: 0,
        directionAccuracy: null,
        spearmanRho: null,
        validationSampleCount: 0,
        trainSampleCount: 0,
        lambda: DEFAULT_LAMBDA,
      },
      confidenceComponents: {
        volume: Math.min(baseline.validCount / 90, 1),
        coverage: baseline.coverage30d,
        variation: 0,
        recency: 1,
        validationImprovement: 0,
        stability: 0,
      },
      confidenceScore: 0,
      confidenceBand: "insufficient",
      predictionVisible: false,
      summaryText: summaryFor({
        status: "insufficient_data",
        stage,
        visible: false,
        validCount: baseline.validCount,
      }),
      modelStatus: "insufficient_data",
    };
    return { ok: true, model };
  }

  try {
    const sampleByDate = new Map(samples.map((s) => [s.localDate, s]));
    const dates = samples.map((s) => s.localDate);
    const aligned = buildAlignedMatrix({
      stage,
      dates,
      featureRows: input.featureRows,
      requireVerifiedElements: false,
    });

    // 날짜 교집합: 타깃+특징
    const pairedDates = aligned.usedDates.filter((d) => sampleByDate.has(d));
    if (pairedDates.length < 14) {
      return {
        ok: false,
        error: "aligned_samples_insufficient",
      };
    }

    // rebuild matrix for paired dates only
    const realigned = buildAlignedMatrix({
      stage,
      dates: pairedDates,
      featureRows: input.featureRows,
    });
    assertKeysAllowed(realigned.keys, realigned.ctx);

    const yAll = realigned.usedDates.map(
      (d) => sampleByDate.get(d)!.normalizedZ
    );
    const XAll = realigned.X;
    const keys = realigned.keys;

    if (keys.length === 0) {
      return { ok: false, error: "no_varying_features" };
    }
    if (keys.length >= realigned.usedDates.length) {
      // numerical risk — still try with high lambda
    }

    const { trainDates, valDates } = timeOrderedSplit(realigned.usedDates);
    const trainIdx = realigned.usedDates
      .map((d, i) => (trainDates.includes(d) ? i : -1))
      .filter((i) => i >= 0);
    const valIdx = realigned.usedDates
      .map((d, i) => (valDates.includes(d) ? i : -1))
      .filter((i) => i >= 0);

    const Xtrain = trainIdx.map((i) => XAll[i]!);
    const ytrain = trainIdx.map((i) => yAll[i]!);
    const Xval = valIdx.map((i) => XAll[i]!);
    const yval = valIdx.map((i) => yAll[i]!);

    const baselineZ = baselinePredictionZ(baseline);
    const pickLambda = (): number => {
      if (baseline.validCount < 45 || valIdx.length === 0) return DEFAULT_LAMBDA;
      let best = DEFAULT_LAMBDA;
      let bestMae = Infinity;
      for (const lam of LAMBDA_CANDIDATES) {
        const fit = fitRidge(Xtrain, ytrain, lam);
        if ("error" in fit) continue;
        const preds = Xval.map((x) => predictRidge(fit, x));
        const m = mae(yval, preds);
        if (m < bestMae) {
          bestMae = m;
          best = lam;
        }
      }
      return best;
    };

    const lambda = pickLambda();
    const fitResult = fitRidge(Xtrain, ytrain, lambda);
    if ("error" in fitResult) {
      return { ok: false, error: fitResult.error };
    }
    const fit: RidgeFit = fitResult;

    const baselinePredsVal = yval.map(() => baselineZ);
    const ridgePredsVal =
      Xval.length > 0
        ? Xval.map((x) => predictRidge(fit, x))
        : [];

    const baselineMae =
      yval.length > 0 ? mae(yval, baselinePredsVal) : mae(ytrain, ytrain.map(() => baselineZ));
    const ridgeMae =
      yval.length > 0
        ? mae(yval, ridgePredsVal)
        : mae(
            ytrain,
            Xtrain.map((x) => predictRidge(fit, x))
          );

    const maeImprovement = baselineMae - ridgeMae;
    const betterThanBaseline = ridgeMae < baselineMae - 1e-9;
    const dirAcc =
      yval.length > 0
        ? directionAccuracy(yval, ridgePredsVal, baselineZ)
        : null;
    const spear =
      yval.length >= 3 ? spearmanRho(yval, ridgePredsVal) : null;

    let modelStatus: ModelStatus = betterThanBaseline
      ? "active"
      : "degraded";
    if (!betterThanBaseline && baseline.validCount < 30) {
      modelStatus = "insufficient_signal";
    }
    const predictionVisible = betterThanBaseline && modelStatus === "active";

    const lastDate = realigned.usedDates.at(-1)!;
    const daysSince = daysBetween(lastDate, asOf);
    const components = computeConfidenceComponents({
      validSampleCount: baseline.validCount,
      coverage30d: baseline.coverage30d,
      lowVariance: baseline.lowVariance,
      std: baseline.std,
      daysSinceLastSample: daysSince,
      metrics: {
        baselineMae,
        ridgeMae,
        maeImprovement,
        directionAccuracy: dirAcc,
        spearmanRho: spear,
        validationSampleCount: yval.length,
        trainSampleCount: ytrain.length,
        lambda,
      },
      prevCoefCorrelation: coefCorrelation(
        input.previousCoefficients,
        fit.coefficients
      ),
    });

    const { score, band } = scoreConfidence(components, stage, {
      forceHide: !predictionVisible || baseline.lowVariance,
      validationWeak: yval.length < 3 || !betterThanBaseline,
    });

    const model: PersonalizationModelRecord = {
      ...baseRecord(),
      modelStatus,
      featureKeys: keys,
      coefficients: fit.coefficients,
      intercept: fit.intercept,
      lambda,
      featureMeans: fit.featureMeans,
      featureStds: fit.featureStds,
      baselineMetrics: {
        mae: baselineMae,
        prediction: baseline.weightedMean,
      },
      modelMetrics: {
        baselineMae,
        ridgeMae,
        maeImprovement,
        directionAccuracy: dirAcc,
        spearmanRho: spear,
        validationSampleCount: yval.length,
        trainSampleCount: ytrain.length,
        lambda,
      },
      confidenceComponents: components,
      confidenceScore: score,
      confidenceBand: band,
      predictionVisible,
      summaryText: summaryFor({
        status: modelStatus,
        stage,
        visible: predictionVisible,
        validCount: baseline.validCount,
      }),
    };

    // final allowlist gate
    assertKeysAllowed(model.featureKeys, realigned.ctx);

    return { ok: true, model };
  } catch (e) {
    if (e instanceof AllowlistViolationError) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "train_failed",
    };
  }
}

export { PERSONALIZATION_PHASE_LABEL };
