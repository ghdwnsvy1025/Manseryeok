/**
 * Phase 4 — 개인화 Ridge MVP: Supabase 모델 저장
 * journal / astrology 원본은 수정하지 않음.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonalizationModelRecord } from "./types";
import type { PersonalizationStorage } from "./storage";

export function modelToRow(model: PersonalizationModelRecord) {
  return {
    id: model.id,
    user_id: model.userId,
    category_key: model.categoryKey,
    model_type: model.modelType,
    model_status: model.modelStatus,
    data_stage: model.dataStage,
    training_start_date: model.trainingStartDate || null,
    training_end_date: model.trainingEndDate || null,
    valid_sample_count: model.validSampleCount,
    feature_keys: model.featureKeys,
    coefficients: model.coefficients,
    intercept: model.intercept,
    lambda: model.lambda,
    feature_means: model.featureMeans,
    feature_stds: model.featureStds,
    normalization_metadata: {
      weightedMean: model.normalization.weightedMean,
      mean: model.normalization.mean,
      std: model.normalization.std,
      validCount: model.normalization.validCount,
      coverage30d: model.normalization.coverage30d,
      lowVariance: model.normalization.lowVariance,
      halfLifeDays: model.normalization.halfLifeDays,
      maxLookback: model.normalization.maxLookback,
    },
    baseline_metrics: model.baselineMetrics,
    model_metrics: model.modelMetrics,
    confidence_components: model.confidenceComponents,
    confidence_score: model.confidenceScore,
    confidence_band: model.confidenceBand,
    prediction_visible: model.predictionVisible,
    summary_text: model.summaryText,
    calculation_version: model.calculationVersion,
    theory_version: model.theoryVersion,
    feature_schema_version: model.featureSchemaVersion,
    model_version: model.modelVersion,
    allowlist_version: model.allowlistVersion,
    model_code_version: model.modelCodeVersion,
    training_run_key: model.trainingRunKey,
    snapshot_id_from: model.snapshotIdRange.from,
    snapshot_id_to: model.snapshotIdRange.to,
    created_at: model.createdAt,
    deprecated_at: model.deprecatedAt,
  };
}

export function rowToModel(row: Record<string, unknown>): PersonalizationModelRecord {
  const norm = (row.normalization_metadata || {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    categoryKey: String(row.category_key),
    modelType: "ridge",
    modelStatus: row.model_status as PersonalizationModelRecord["modelStatus"],
    dataStage: row.data_stage as PersonalizationModelRecord["dataStage"],
    trainingStartDate: String(row.training_start_date || ""),
    trainingEndDate: String(row.training_end_date || ""),
    validSampleCount: Number(row.valid_sample_count || 0),
    featureKeys: (row.feature_keys as string[]) || [],
    coefficients: (row.coefficients as number[]) || [],
    intercept: Number(row.intercept || 0),
    lambda: Number(row.lambda || 10),
    featureMeans: (row.feature_means as number[]) || [],
    featureStds: (row.feature_stds as number[]) || [],
    normalization: {
      weightedMean: Number(norm.weightedMean ?? 3),
      mean: Number(norm.mean ?? 3),
      std: Number(norm.std ?? 0.5),
      validCount: Number(norm.validCount ?? row.valid_sample_count ?? 0),
      coverage30d: Number(norm.coverage30d ?? 0),
      lowVariance: Boolean(norm.lowVariance),
      halfLifeDays: Number(norm.halfLifeDays ?? 30),
      maxLookback: Number(norm.maxLookback ?? 60),
      samples: [],
    },
    baselineMetrics: (row.baseline_metrics as PersonalizationModelRecord["baselineMetrics"]) || {
      mae: 0,
      prediction: 3,
    },
    modelMetrics: (row.model_metrics as PersonalizationModelRecord["modelMetrics"]) || {
      baselineMae: 0,
      ridgeMae: 0,
      maeImprovement: 0,
      directionAccuracy: null,
      spearmanRho: null,
      validationSampleCount: 0,
      trainSampleCount: 0,
      lambda: 10,
    },
    confidenceComponents:
      (row.confidence_components as PersonalizationModelRecord["confidenceComponents"]) || {
        volume: 0,
        coverage: 0,
        variation: 0,
        recency: 0,
        validationImprovement: 0,
        stability: 0,
      },
    confidenceScore: Number(row.confidence_score || 0),
    confidenceBand:
      (row.confidence_band as PersonalizationModelRecord["confidenceBand"]) ||
      "insufficient",
    predictionVisible: Boolean(row.prediction_visible),
    summaryText: (row.summary_text as string) || null,
    calculationVersion: String(row.calculation_version),
    theoryVersion: String(row.theory_version),
    featureSchemaVersion: String(row.feature_schema_version),
    modelVersion: String(row.model_version),
    allowlistVersion: String(row.allowlist_version),
    modelCodeVersion: String(row.model_code_version),
    snapshotIdRange: {
      from: (row.snapshot_id_from as string) || null,
      to: (row.snapshot_id_to as string) || null,
    },
    createdAt: String(row.created_at),
    deprecatedAt: (row.deprecated_at as string) || null,
    trainingRunKey: String(row.training_run_key),
  };
}

export class SupabasePersonalizationStorage implements PersonalizationStorage {
  constructor(private readonly sb: SupabaseClient) {}

  async listByUser(userId: string): Promise<PersonalizationModelRecord[]> {
    const { data, error } = await this.sb
      .from("personalization_models")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r) => rowToModel(r));
  }

  async getActive(
    userId: string,
    categoryKey: string
  ): Promise<PersonalizationModelRecord | null> {
    const { data, error } = await this.sb
      .from("personalization_models")
      .select("*")
      .eq("user_id", userId)
      .eq("category_key", categoryKey)
      .is("deprecated_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToModel(data) : null;
  }

  async findByTrainingRunKey(
    trainingRunKey: string
  ): Promise<PersonalizationModelRecord | null> {
    const { data, error } = await this.sb
      .from("personalization_models")
      .select("*")
      .eq("training_run_key", trainingRunKey)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToModel(data) : null;
  }

  async insert(
    model: PersonalizationModelRecord
  ): Promise<PersonalizationModelRecord> {
    const existing = await this.findByTrainingRunKey(model.trainingRunKey);
    if (existing) throw new Error("duplicate_training_run");

    const now = model.createdAt;
    await this.sb
      .from("personalization_models")
      .update({ deprecated_at: now })
      .eq("user_id", model.userId)
      .eq("category_key", model.categoryKey)
      .is("deprecated_at", null);

    const { data, error } = await this.sb
      .from("personalization_models")
      .insert(modelToRow(model))
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToModel(data);
  }

  async deprecate(id: string, at: string): Promise<void> {
    const { error } = await this.sb
      .from("personalization_models")
      .update({ deprecated_at: at })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export async function persistModelMetrics(
  sb: SupabaseClient,
  model: PersonalizationModelRecord
): Promise<string> {
  const { data, error } = await sb
    .from("personalization_model_metrics")
    .insert({
      model_id: model.id,
      user_id: model.userId,
      baseline_mae: model.modelMetrics.baselineMae,
      ridge_mae: model.modelMetrics.ridgeMae,
      mae_improvement: model.modelMetrics.maeImprovement,
      direction_accuracy: model.modelMetrics.directionAccuracy,
      spearman_rho: model.modelMetrics.spearmanRho,
      validation_sample_count: model.modelMetrics.validationSampleCount,
      train_sample_count: model.modelMetrics.trainSampleCount,
      lambda: model.modelMetrics.lambda,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function persistPredictions(
  sb: SupabaseClient,
  model: PersonalizationModelRecord,
  rows: Array<{
    localDate: string;
    predictedZ: number;
    baselineRaw: number;
  }>
): Promise<string[]> {
  if (!rows.length) return [];
  const payload = rows.map((r) => ({
    model_id: model.id,
    user_id: model.userId,
    category_key: model.categoryKey,
    local_date: r.localDate,
    predicted_z: r.predictedZ,
    baseline_raw: r.baselineRaw,
    visible: model.predictionVisible,
  }));
  const { data, error } = await sb
    .from("personalization_predictions")
    .insert(payload)
    .select("id");
  if (error) throw new Error(error.message);
  return (data || []).map((d) => d.id as string);
}
