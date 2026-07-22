/**
 * Bridge: invoked by verify-personalization-training-e2e.mjs via jest.
 * Reads P4_E2E_INPUT_PATH JSON, runs runPersonalizationTrainingPipeline, writes result.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { runPersonalizationTrainingPipeline } from "@/lib/personalization/trainingPipeline";
import { trainCategoryModel } from "@/lib/personalization/train";
import type { FeatureRow, ScoreSample } from "@/lib/personalization/types";

type BridgeInput = {
  mode: "pipeline" | "reject_approximate" | "train_only";
  url: string;
  anonKey: string;
  accessToken: string;
  userId: string;
  categoryKey: string;
  calculationVersion: string;
  theoryVersion: string;
  featureSchemaVersion: string;
  overrideFeatureRows?: FeatureRow[];
  scores?: ScoreSample[];
  featureRows?: FeatureRow[];
  asOfDate?: string;
};

describe("Phase 4 — 개인화 Ridge MVP training bridge", () => {
  test("run bridge once", async () => {
    const path = process.env.P4_E2E_INPUT_PATH;
    const outPath = process.env.P4_E2E_OUTPUT_PATH;
    if (!path || !outPath) {
      // Not an e2e run — skip silently when suite collected by accident
      expect(true).toBe(true);
      return;
    }

    const input = JSON.parse(fs.readFileSync(path, "utf8")) as BridgeInput;
    const sb = createClient(input.url, input.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${input.accessToken}` },
      },
    });

    let result: unknown;

    if (input.mode === "reject_approximate") {
      const train = trainCategoryModel({
        userId: input.userId,
        categoryKey: input.categoryKey,
        scores: input.scores || [],
        featureRows: input.featureRows || [],
        calculationVersion: input.calculationVersion,
        theoryVersion: input.theoryVersion,
        featureSchemaVersion: input.featureSchemaVersion,
        asOfDate: input.asOfDate,
      });
      result = {
        mode: "reject_approximate",
        rejected: !train.ok,
        error: train.ok ? null : train.error,
        featureKeys: train.ok ? train.model.featureKeys : [],
      };
    } else if (input.mode === "train_only") {
      const train = trainCategoryModel({
        userId: input.userId,
        categoryKey: input.categoryKey,
        scores: input.scores || [],
        featureRows: input.featureRows || [],
        calculationVersion: input.calculationVersion,
        theoryVersion: input.theoryVersion,
        featureSchemaVersion: input.featureSchemaVersion,
        asOfDate: input.asOfDate,
      });
      result = { mode: "train_only", train };
    } else {
      const pipeline = await runPersonalizationTrainingPipeline({
        sb,
        userId: input.userId,
        categoryKey: input.categoryKey,
        calculationVersion: input.calculationVersion,
        theoryVersion: input.theoryVersion,
        featureSchemaVersion: input.featureSchemaVersion,
        overrideFeatureRows: input.overrideFeatureRows,
        asOfDate: input.asOfDate,
      });
      result = {
        mode: "pipeline",
        ridgeInvoked: pipeline.ridgeInvoked,
        reused: pipeline.reused,
        metricsId: pipeline.metricsId,
        predictionIds: pipeline.predictionIds,
        trainOk: pipeline.train.ok,
        trainError: pipeline.train.ok ? null : pipeline.train.error,
        model: pipeline.model
          ? {
              id: pipeline.model.id,
              categoryKey: pipeline.model.categoryKey,
              dataStage: pipeline.model.dataStage,
              modelStatus: pipeline.model.modelStatus,
              predictionVisible: pipeline.model.predictionVisible,
              validSampleCount: pipeline.model.validSampleCount,
              featureKeys: pipeline.model.featureKeys,
              lambda: pipeline.model.lambda,
              trainingRunKey: pipeline.model.trainingRunKey,
              calculationVersion: pipeline.model.calculationVersion,
              theoryVersion: pipeline.model.theoryVersion,
              featureSchemaVersion: pipeline.model.featureSchemaVersion,
              modelVersion: pipeline.model.modelVersion,
              allowlistVersion: pipeline.model.allowlistVersion,
              modelCodeVersion: pipeline.model.modelCodeVersion,
              baselineMae: pipeline.model.modelMetrics.baselineMae,
              ridgeMae: pipeline.model.modelMetrics.ridgeMae,
              maeImprovement: pipeline.model.modelMetrics.maeImprovement,
            }
          : null,
      };
    }

    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
    expect(true).toBe(true);
  }, 120_000);
});
