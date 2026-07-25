import { describe, expect, test } from "@jest/globals";
import {
  EVAL_METRICS_VERSION,
  maturityCohort,
  computeMae,
  computeRmse,
  computeProbabilisticMetrics,
  computeEngagementMetrics,
  diagnoseModelRows,
  buildShadowEvalReport,
} from "@/lib/personalization/evalMetrics";

describe("ridge shadow evaluation metrics", () => {
  test("version pinned", () => {
    expect(EVAL_METRICS_VERSION).toMatch(/^ridge-eval-v/);
  });

  test("maturity cohorts cover the required bands", () => {
    expect(maturityCohort(0)).toBe("new_user");
    expect(maturityCohort(3)).toBe("d1_6");
    expect(maturityCohort(10)).toBe("d7_29");
    expect(maturityCohort(40)).toBe("d30_89");
    expect(maturityCohort(100)).toBe("d90_plus");
  });

  test("MAE and RMSE on a known pair", () => {
    const actual = [1, 2, 3];
    const pred = [1, 2, 5];
    expect(computeMae(actual, pred)).toBeCloseTo(2 / 3, 5);
    expect(computeRmse(actual, pred)).toBeCloseTo(Math.sqrt(4 / 3), 5);
  });

  test("perfect predictions have zero error metrics", () => {
    const a = [4, 5, 6, 7];
    expect(computeMae(a, a)).toBe(0);
    expect(computeRmse(a, a)).toBe(0);
    const p = computeProbabilisticMetrics(a, a);
    expect(p.brier).not.toBeNull();
    expect(p.calibrationError).toBeLessThan(0.2);
  });

  test("engagement rates", () => {
    const e = computeEngagementMetrics({
      shown: 10,
      fitGood: 4,
      diaryStarted: 5,
      diaryCompleted: 3,
    });
    expect(e.questionFitRate).toBe(0.4);
    expect(e.diaryStartRate).toBe(0.5);
    expect(e.diaryCompleteRate).toBe(0.6);
  });

  test("model row diagnosis names the real cause", () => {
    const off = diagnoseModelRows({
      modelRows: 0,
      trainFlagOn: false,
      inferenceAttempted: false,
      sampleCount: 2,
    });
    expect(off.reasons).toContain("feature_flag_off");
    expect(off.reasons).toContain("insufficient_data");

    const ok = diagnoseModelRows({
      modelRows: 3,
      trainFlagOn: true,
      inferenceAttempted: true,
      sampleCount: 30,
    });
    expect(ok.reasons).toEqual(["ok"]);
  });

  test("shadow eval report is deterministic", () => {
    const input = {
      priorUniqueDays: 12,
      actual: [5, 6, 7, 4],
      livePred: [5, 5, 7, 5],
      ridgePred: [5, 6, 6, 4],
      modelDiagnosis: diagnoseModelRows({
        modelRows: 0,
        trainFlagOn: false,
        inferenceAttempted: true,
        sampleCount: 12,
      }),
    };
    const a = buildShadowEvalReport(input);
    const b = buildShadowEvalReport(input);
    expect(a).toEqual(b);
    expect(a.overall.regression.maeDelta).not.toBeNull();
    expect(a.overall.probabilistic.ridge.brier).not.toBeNull();
  });
});
