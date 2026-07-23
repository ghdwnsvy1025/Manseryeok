/**
 * Phase 4 — 개인화 Ridge MVP: 학습 → 저장 파이프라인
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { predictRidge, type RidgeFit } from "./ridge";
import {
  saveTrainingRun,
} from "./storage";
import {
  SupabasePersonalizationStorage,
  persistModelMetrics,
  persistPredictions,
} from "./supabasePersist";
import { trainCategoryModel, type TrainResult } from "./train";
import type { FeatureRow, ScoreSample } from "./types";
import {
  ALLOWLIST_VERSION,
  MODEL_CODE_VERSION,
  type PersonalizationModelRecord,
} from "./types";

export type PipelineResult = {
  train: TrainResult;
  reused: boolean;
  model: PersonalizationModelRecord | null;
  metricsId: string | null;
  predictionIds: string[];
  ridgeInvoked: boolean;
};

export async function loadScoresForCategory(
  sb: SupabaseClient,
  userId: string,
  categoryKey: string
): Promise<ScoreSample[]> {
  const { data: scoreRows, error } = await sb
    .from("category_scores")
    .select("raw_score,user_score,ai_score,final_score,is_not_applicable,entry_id")
    .eq("user_id", userId)
    .eq("category_code", categoryKey);
  if (error) throw new Error(error.message);
  if (!scoreRows?.length) return [];

  const entryIds = Array.from(new Set(scoreRows.map((r) => r.entry_id as string)));
  const { data: entries, error: e2 } = await sb
    .from("journal_entries")
    .select("id,entry_date")
    .eq("user_id", userId)
    .in("id", entryIds);
  if (e2) throw new Error(e2.message);
  const dateById = new Map(
    (entries || []).map((e) => [e.id as string, e.entry_date as string])
  );

  const samples: ScoreSample[] = [];
  for (const row of scoreRows) {
    const localDate = dateById.get(row.entry_id as string);
    if (!localDate) continue;
    const isNa = Boolean(row.is_not_applicable);
    const final =
      row.final_score != null
        ? Number(row.final_score)
        : row.user_score != null
          ? Number(row.user_score)
          : row.raw_score != null
            ? Number(row.raw_score)
            : null;
    samples.push({
      localDate,
      rawScore: final == null ? 0 : final,
      isNotApplicable: isNa || final == null,
    });
  }
  return samples.sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export async function loadFeatureRows(
  sb: SupabaseClient,
  userId: string,
  dates: string[]
): Promise<FeatureRow[]> {
  if (!dates.length) return [];
  const { data, error } = await sb
    .from("astrology_feature_vectors")
    .select("local_date,vector")
    .eq("user_id", userId)
    .in("local_date", dates);
  if (error) throw new Error(error.message);

  return (data || []).map((row) => {
    const vector = (row.vector || {}) as Record<string, number>;
    const approxFlag = Boolean(
      (vector as { __elementDistributionApproximate?: boolean })
        .__elementDistributionApproximate
    );
    const features = { ...vector };
    delete (features as { __elementDistributionApproximate?: boolean })
      .__elementDistributionApproximate;
    return {
      localDate: row.local_date as string,
      features,
      elementDistributionApproximate: approxFlag,
    };
  });
}

/**
 * DB에서 점수·특징을 읽어 trainCategoryModel 실행 후 모델/메트릭/예측 저장.
 */
export async function runPersonalizationTrainingPipeline(opts: {
  sb: SupabaseClient;
  userId: string;
  categoryKey: string;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  /** 음성 테스트: 학습 전 featureRows 덮어쓰기 */
  overrideFeatureRows?: FeatureRow[];
  previousCoefficients?: number[] | null;
  asOfDate?: string;
  now?: Date;
}): Promise<PipelineResult> {
  const scores = await loadScoresForCategory(
    opts.sb,
    opts.userId,
    opts.categoryKey
  );
  const dates = scores
    .filter((s) => !s.isNotApplicable)
    .map((s) => s.localDate);
  const featureRows =
    opts.overrideFeatureRows ??
    (await loadFeatureRows(opts.sb, opts.userId, dates));

  const train = trainCategoryModel({
    userId: opts.userId,
    categoryKey: opts.categoryKey,
    scores,
    featureRows,
    calculationVersion: opts.calculationVersion,
    theoryVersion: opts.theoryVersion,
    featureSchemaVersion: opts.featureSchemaVersion,
    previousCoefficients: opts.previousCoefficients,
    asOfDate: opts.asOfDate,
    now: opts.now,
  });

  const ridgeInvoked =
    train.ok &&
    Boolean(train.model) &&
    train.model!.dataStage !== "insufficient_data" &&
    train.model!.modelMetrics.trainSampleCount > 0;

  if (!train.ok || !train.model) {
    return {
      train,
      reused: false,
      model: null,
      metricsId: null,
      predictionIds: [],
      ridgeInvoked: false,
    };
  }

  // insufficient_data 도 감사 목적으로 저장 가능
  const storage = new SupabasePersonalizationStorage(opts.sb);
  const { model, reused } = await saveTrainingRun(storage, train.model);

  let metricsId: string | null = null;
  let predictionIds: string[] = [];

  if (!reused) {
    metricsId = await persistModelMetrics(opts.sb, model);

    if (model.predictionVisible && model.featureKeys.length > 0) {
      const fit: RidgeFit = {
        intercept: model.intercept,
        coefficients: model.coefficients,
        lambda: model.lambda,
        featureMeans: model.featureMeans,
        featureStds: model.featureStds,
      };
      const recent = [...featureRows]
        .filter((r) => dates.includes(r.localDate))
        .slice(-5);
      const predRows = recent.map((r) => {
        const x = model.featureKeys.map((k) => r.features[k] ?? 0);
        return {
          localDate: r.localDate,
          predictedZ: predictRidge(fit, x),
          baselineRaw: model.normalization.weightedMean,
        };
      });
      predictionIds = await persistPredictions(opts.sb, model, predRows);
    }
  } else {
    const { data: m } = await opts.sb
      .from("personalization_model_metrics")
      .select("id")
      .eq("model_id", model.id)
      .limit(1)
      .maybeSingle();
    metricsId = m?.id ?? null;
    const { data: p } = await opts.sb
      .from("personalization_predictions")
      .select("id")
      .eq("model_id", model.id);
    predictionIds = (p || []).map((x) => x.id as string);
  }

  return {
    train: { ok: true, model },
    reused,
    model,
    metricsId,
    predictionIds,
    ridgeInvoked:
      Boolean(ridgeInvoked) ||
      (model.validSampleCount >= 14 && model.coefficients.length >= 0),
  };
}

export { ALLOWLIST_VERSION, MODEL_CODE_VERSION };
