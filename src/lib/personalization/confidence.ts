import type {
  ConfidenceBand,
  ConfidenceComponents,
  DataStage,
  ModelMetrics,
} from "./types";
import { stageConfidenceCap } from "./sampleBuckets";

export function bandFromScore(score: number): ConfidenceBand {
  if (score < 30) return "insufficient";
  if (score < 50) return "low";
  if (score < 70) return "medium";
  if (score < 85) return "high";
  return "very_high";
}

export function computeConfidenceComponents(opts: {
  validSampleCount: number;
  coverage30d: number;
  lowVariance: boolean;
  std: number;
  daysSinceLastSample: number;
  metrics: ModelMetrics | null;
  prevCoefCorrelation: number | null;
}): ConfidenceComponents {
  const volume = Math.min(opts.validSampleCount / 90, 1);
  const coverage = Math.max(0, Math.min(1, opts.coverage30d));
  const variation = opts.lowVariance
    ? 0.15
    : Math.min(1, Math.max(0, (opts.std - 0.5) / 1.5));
  const recency = Math.max(0, 1 - opts.daysSinceLastSample / 60);

  let validationImprovement = 0;
  if (opts.metrics && opts.metrics.validationSampleCount > 0) {
    const imp = opts.metrics.maeImprovement;
    validationImprovement = Math.max(0, Math.min(1, imp / Math.max(opts.metrics.baselineMae, 0.1)));
  }

  const stability =
    opts.prevCoefCorrelation == null
      ? 0.5
      : Math.max(0, Math.min(1, (opts.prevCoefCorrelation + 1) / 2));

  return {
    volume,
    coverage,
    variation,
    recency,
    validationImprovement,
    stability,
  };
}

export function scoreConfidence(
  c: ConfidenceComponents,
  stage: DataStage,
  opts?: {
    forceHide?: boolean;
    validationWeak?: boolean;
  }
): { score: number; band: ConfidenceBand } {
  if (opts?.forceHide) {
    return { score: 0, band: "insufficient" };
  }
  let raw =
    100 *
    (0.2 * c.volume +
      0.15 * c.coverage +
      0.1 * c.variation +
      0.1 * c.recency +
      0.3 * c.validationImprovement +
      0.15 * c.stability);
  raw = Math.max(0, Math.min(100, raw));
  const cap = stageConfidenceCap(stage);
  if (opts?.validationWeak) {
    raw = Math.min(raw, 49);
  }
  const score = Math.min(raw, cap);
  return { score, band: bandFromScore(score) };
}
