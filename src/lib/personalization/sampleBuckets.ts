import type { DataStage } from "./types";

export function resolveDataStage(validSampleCount: number): DataStage {
  if (validSampleCount <= 13) return "insufficient_data";
  if (validSampleCount <= 29) return "early_signal";
  if (validSampleCount <= 89) return "active";
  return "stable_candidate";
}

export function stageAllowsRidge(stage: DataStage): boolean {
  return stage !== "insufficient_data";
}

export function stageUsesBaseFeaturesOnly(stage: DataStage): boolean {
  return stage === "early_signal";
}

export function stageAllowsRelationAndLag(stage: DataStage): boolean {
  return stage === "active" || stage === "stable_candidate";
}

export function stageConfidenceCap(stage: DataStage): number {
  switch (stage) {
    case "insufficient_data":
      return 29;
    case "early_signal":
      return 49;
    case "active":
      return 84;
    case "stable_candidate":
      return 100;
  }
}
