/**
 * Phase 4 — 개인화 Ridge MVP tests
 * 정규화 · allowlist · Ridge · 평가 · 버전 · 원본 불변
 */
import { describe, expect, test } from "@jest/globals";
import {
  clampZ,
  computeBaselineStats,
  decayWeight,
  detectLowVariance,
  filterValidScores,
  normalizeScores,
  STD_FLOOR,
  Z_CLAMP,
} from "@/lib/personalization/baseline";
import {
  AllowlistViolationError,
  assertKeysAllowed,
  buildAlignedMatrix,
  EARLY_BASE_KEYS,
  NATAL_ONLY_KEYS,
  removeConstantFeatures,
} from "@/lib/personalization/featureMatrix";
import {
  DEFAULT_LAMBDA,
  fitRidge,
  mae,
  predictRidge,
  directionAccuracy,
} from "@/lib/personalization/ridge";
import {
  computeConfidenceComponents,
  scoreConfidence,
} from "@/lib/personalization/confidence";
import { resolveDataStage } from "@/lib/personalization/sampleBuckets";
import {
  buildTrainingRunKey,
  shouldRetrain,
  timeOrderedSplit,
  trainCategoryModel,
} from "@/lib/personalization/train";
import {
  MemoryPersonalizationStorage,
  saveTrainingRun,
} from "@/lib/personalization/storage";
import type { FeatureRow, ScoreSample } from "@/lib/personalization/types";
import {
  ALLOWLIST_VERSION,
  MODEL_CODE_VERSION,
} from "@/lib/personalization/types";
import { FEATURE_CATALOG_VERSION } from "@/lib/astrology/featureAllowlist";

function dateOffset(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function makeScores(
  n: number,
  opts?: { start?: string; pattern?: (i: number) => number; naAt?: number[] }
): ScoreSample[] {
  const start = opts?.start ?? "2025-01-01";
  const na = new Set(opts?.naAt ?? []);
  return Array.from({ length: n }, (_, i) => {
    if (na.has(i)) {
      return {
        localDate: dateOffset(start, i),
        rawScore: 3,
        isNotApplicable: true,
      };
    }
    const raw = opts?.pattern ? opts.pattern(i) : 2 + (i % 4);
    return { localDate: dateOffset(start, i), rawScore: raw };
  });
}

function makeFeatures(
  dates: string[],
  opts?: { approx?: boolean; signal?: boolean; injectApproxElements?: boolean }
): FeatureRow[] {
  return dates.map((localDate, i) => {
    const luck = opts?.signal ? (i % 5) / 4 : 0.5;
    const energyProxy = opts?.signal ? luck : 0.2;
    const features: Record<string, number> = {
      axisPeer: 0.2 + energyProxy * 0.1,
      axisOutput: 0.2 + (opts?.signal ? (i % 4) * 0.05 : 0),
      axisWealth: 0.2,
      axisAuthority: 0.2,
      axisResource: 0.2,
      luck_daewoon_rate: 1,
      luck_yearly_rate: 1 + (i % 2) * 0.01,
      luck_monthly_rate: 1 + luck * 0.1,
      luck_daily_rate: 1 + energyProxy * 0.2,
      rel_yukhap: i % 3,
      rel_chung: 0,
      rel_hyeong: 0,
      rel_pa: 0,
      rel_hae: 0,
      rel_cheonGanHap: 0,
      tenGod_비견: 1,
      tenGod_겁재: 0,
      tenGod_식신: i % 2,
      tenGod_상관: 0,
      tenGod_편재: 0,
      tenGod_정재: 0,
      tenGod_편관: 0,
      tenGod_정관: 0,
      tenGod_편인: 0,
      tenGod_정인: 1,
      yinRatio: 0.5,
      yangRatio: 0.5,
      original_rate: 1,
    };
    // verified 경로에서만 오행 포함. approximate 주입 음성 테스트는 injectApproxElements
    if (!opts?.approx || opts?.injectApproxElements) {
      features.wood = 20 + (i % 3);
      features.fire = 20;
      features.earth = 20;
      features.metal = 20;
      features.water = 20;
    }
    return {
      localDate,
      elementDistributionApproximate: opts?.approx ?? false,
      features,
    };
  });
}

describe("Phase 4 — 개인화 Ridge MVP · 정규화", () => {
  test("1. 가중평균", () => {
    const scores = makeScores(5, {
      start: "2025-06-01",
      pattern: () => 4,
    });
    const b = computeBaselineStats(scores, "2025-06-05");
    expect(b.weightedMean).toBeCloseTo(4, 5);
  });

  test("2. 반감기", () => {
    expect(decayWeight(0)).toBe(1);
    expect(decayWeight(30)).toBeCloseTo(0.5, 5);
    expect(decayWeight(60)).toBeCloseTo(0.25, 5);
  });

  test("3. 표준편차 하한", () => {
    const scores = makeScores(20, { pattern: () => 3 });
    const b = computeBaselineStats(scores, "2025-01-20");
    expect(b.std).toBeGreaterThanOrEqual(STD_FLOOR);
  });

  test("4. z-score clamp", () => {
    expect(clampZ(10)).toBe(Z_CLAMP);
    expect(clampZ(-10)).toBe(-Z_CLAMP);
  });

  test("5. 14개 미만 fallback", () => {
    const scores = makeScores(10, { pattern: (i) => (i % 2 === 0 ? 5 : 1) });
    const { samples } = normalizeScores(scores, "2025-01-10");
    expect(samples.every((s) => s.usedFallbackCenter)).toBe(true);
    expect(samples[0]!.normalizedZ).toBe(clampZ(5 - 3));
  });

  test("6. N/A 제외", () => {
    const scores = makeScores(10, { naAt: [0, 1, 2] });
    const valid = filterValidScores(scores);
    expect(valid).toHaveLength(7);
  });

  test("7. low variance 감지", () => {
    const low = makeScores(20, { pattern: () => 3 });
    expect(detectLowVariance(low)).toBe(true);
    const high = makeScores(20, { pattern: (i) => 1 + (i % 5) });
    expect(detectLowVariance(high)).toBe(false);
  });
});

describe("Phase 4 — 개인화 Ridge MVP · Allowlist", () => {
  test("8. verified 특징만 통과", () => {
    expect(() =>
      assertKeysAllowed(["axisPeer", "luck_daily_rate"], {
        elementDistributionApproximate: false,
      })
    ).not.toThrow();
  });

  test("9. approximate 특징 거부", () => {
    expect(() =>
      assertKeysAllowed(["wood"], { elementDistributionApproximate: true })
    ).toThrow(AllowlistViolationError);
  });

  test("10. unknown 특징 거부", () => {
    expect(() =>
      assertKeysAllowed(["llm_magic_score"], {
        elementDistributionApproximate: false,
      })
    ).toThrow(AllowlistViolationError);
  });

  test("11. 학습 직전 allowlist 재검증", () => {
    const scores = makeScores(20, {
      pattern: (i) => 2 + (i % 3),
    });
    const dates = scores.map((s) => s.localDate);
    const features = makeFeatures(dates, { approx: true });
    // approximate면 오행 미포함 → luck/축만으로 학습 가능
    const result = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "saju-calc-1.0.0",
      theoryVersion: "sajubase-final-2026-07-19",
      featureSchemaVersion: "saju-feature-mvp-1.0.0",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.featureKeys).not.toContain("wood");
      expect(
        result.model.featureKeys.every((k) => !(NATAL_ONLY_KEYS as readonly string[]).includes(k))
      ).toBe(true);
    }
  });

  test("11b. approximate 오행 주입 시 학습 거부", () => {
    const scores = makeScores(20, { pattern: (i) => 2 + (i % 3) });
    const features = makeFeatures(scores.map((s) => s.localDate), {
      approx: true,
      injectApproxElements: true,
    });
    const result = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/approximate/);
    }
  });

  test("12. 상수 특징 제거", () => {
    const keys = ["a", "b"];
    const rows = [
      { a: 1, b: 2 },
      { a: 1, b: 3 },
      { a: 1, b: 4 },
    ];
    expect(removeConstantFeatures(keys, rows)).toEqual(["b"]);
  });
});

describe("Phase 4 — 개인화 Ridge MVP · Ridge", () => {
  test("13. 결정론적 재현성", () => {
    const X = [
      [1, 2],
      [2, 1],
      [3, 4],
      [4, 3],
    ];
    const y = [1, 2, 3, 4];
    const a = fitRidge(X, y, 10);
    const b = fitRidge(X, y, 10);
    expect(a).toEqual(b);
  });

  test("14. lambda 적용", () => {
    const X = [
      [1, 0],
      [2, 0],
      [3, 1],
      [4, 1],
    ];
    const y = [1, 2, 2.5, 4];
    const soft = fitRidge(X, y, 0.1);
    const hard = fitRidge(X, y, 100);
    expect("error" in soft || "error" in hard).toBe(false);
    if (!("error" in soft) && !("error" in hard)) {
      const softNorm = soft.coefficients.reduce((s, c) => s + c * c, 0);
      const hardNorm = hard.coefficients.reduce((s, c) => s + c * c, 0);
      expect(hardNorm).toBeLessThanOrEqual(softNorm + 1e-9);
    }
  });

  test("15. 시간순 분할", () => {
    const dates = [
      "2025-01-01",
      "2025-01-02",
      "2025-01-03",
      "2025-01-04",
      "2025-01-05",
      "2025-01-06",
      "2025-01-07",
      "2025-01-08",
      "2025-01-09",
      "2025-01-10",
    ];
    const { trainDates, valDates } = timeOrderedSplit(dates, 0.2);
    expect(trainDates.every((d) => d < valDates[0]!)).toBe(true);
    expect(valDates).toHaveLength(2);
  });

  test("16. 랜덤 셔플 미사용", () => {
    const dates = Array.from({ length: 20 }, (_, i) =>
      dateOffset("2025-01-01", i)
    );
    const a = timeOrderedSplit(dates);
    const b = timeOrderedSplit([...dates].reverse());
    expect(a).toEqual(b);
  });

  test("17. 수치 불안정 처리", () => {
    const X = [
      [1, 1],
      [1, 1],
      [1, 1],
    ];
    const y = [1, 2, 3];
    const r = fitRidge(X, y, 0);
    // λ=0 + 완전 공선 → singular 가능
    expect("error" in r || Number.isFinite((r as { intercept: number }).intercept)).toBe(
      true
    );
  });

  test("18. 너무 적은 표본에서 학습 금지", () => {
    const scores = makeScores(10);
    const result = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: makeFeatures(scores.map((s) => s.localDate)),
      calculationVersion: "saju-calc-1.0.0",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.modelStatus).toBe("insufficient_data");
      expect(result.model.predictionVisible).toBe(false);
      expect(resolveDataStage(10)).toBe("insufficient_data");
    }
  });

  test("19. 카테고리별 모델 분리", () => {
    const scores = makeScores(25, {
      pattern: (i) => 2 + (i % 3),
    });
    const features = makeFeatures(
      scores.map((s) => s.localDate),
      { signal: true }
    );
    const a = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    const b = trainCategoryModel({
      userId: "u1",
      categoryKey: "emotion_balance",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.model.categoryKey).not.toBe(b.model.categoryKey);
      expect(a.model.trainingRunKey).not.toBe(b.model.trainingRunKey);
    }
  });
});

describe("Phase 4 — 개인화 Ridge MVP · 평가", () => {
  test("20–26. baseline/Ridge MAE · degraded · confidence", () => {
    // 신호 없는 데이터 → Ridge가 baseline보다 나쁠 가능성 높음
    const scores = makeScores(40, { pattern: (i) => 2 + (i % 4) });
    const features = makeFeatures(
      scores.map((s) => s.localDate),
      { signal: false }
    );
    const result = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const m = result.model;
    expect(Number.isFinite(m.modelMetrics.baselineMae)).toBe(true);
    expect(Number.isFinite(m.modelMetrics.ridgeMae)).toBe(true);

    if (m.modelMetrics.ridgeMae >= m.modelMetrics.baselineMae - 1e-9) {
      expect(["degraded", "insufficient_signal"]).toContain(m.modelStatus);
      expect(m.predictionVisible).toBe(false);
    }

    expect(m.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(m.confidenceScore).toBeLessThanOrEqual(100);

    const comps = computeConfidenceComponents({
      validSampleCount: 40,
      coverage30d: 0.5,
      lowVariance: false,
      std: 1,
      daysSinceLastSample: 1,
      metrics: m.modelMetrics,
      prevCoefCorrelation: null,
    });
    const scored = scoreConfidence(comps, "active");
    expect(scored.score).toBeGreaterThanOrEqual(0);
    expect(scored.score).toBeLessThanOrEqual(100);

    const dir = directionAccuracy([1, -1, 1], [0.5, -0.2, 0.1], 0);
    expect(dir).toBe(1);

    expect(DEFAULT_LAMBDA).toBe(10);
    expect(ALLOWLIST_VERSION).toBe(FEATURE_CATALOG_VERSION);
  });
});

describe("Phase 4 — 개인화 Ridge MVP · 버전·저장", () => {
  test("27. 모델 버전 병존", async () => {
    const storage = new MemoryPersonalizationStorage();
    const scores = makeScores(20, { pattern: (i) => 2 + (i % 3) });
    const features = makeFeatures(scores.map((s) => s.localDate), {
      signal: true,
    });
    const r1 = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c1",
      theoryVersion: "t",
      featureSchemaVersion: "f1",
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    await saveTrainingRun(storage, r1.model);

    const scores2 = makeScores(23, { pattern: (i) => 2 + (i % 3) });
    const features2 = makeFeatures(scores2.map((s) => s.localDate), {
      signal: true,
    });
    const r2 = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores: scores2,
      featureRows: features2,
      calculationVersion: "c1",
      theoryVersion: "t",
      featureSchemaVersion: "f1",
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.model.trainingRunKey).not.toBe(r1.model.trainingRunKey);
    await saveTrainingRun(storage, r2.model);
    expect(storage.models).toHaveLength(2);
    expect(storage.models.filter((m) => !m.deprecatedAt)).toHaveLength(1);
  });

  test("28–29. schema/allowlist 변경 시 재학습", () => {
    expect(
      shouldRetrain({
        lastTrainAt: new Date().toISOString(),
        lastValidCount: 20,
        currentValidCount: 20,
        lastCalculationVersion: "c1",
        lastFeatureSchemaVersion: "f1",
        lastAllowlistVersion: "a1",
        lastModelCodeVersion: MODEL_CODE_VERSION,
        calculationVersion: "c1",
        featureSchemaVersion: "f2",
        allowlistVersion: "a1",
        modelCodeVersion: MODEL_CODE_VERSION,
        now: new Date(),
      })
    ).toBe(true);

    expect(
      shouldRetrain({
        lastTrainAt: new Date().toISOString(),
        lastValidCount: 20,
        currentValidCount: 20,
        lastCalculationVersion: "c1",
        lastFeatureSchemaVersion: "f1",
        lastAllowlistVersion: "a1",
        lastModelCodeVersion: MODEL_CODE_VERSION,
        calculationVersion: "c1",
        featureSchemaVersion: "f1",
        allowlistVersion: "a2",
        modelCodeVersion: MODEL_CODE_VERSION,
        now: new Date(),
      })
    ).toBe(true);
  });

  test("30. 동일 조건 중복 학습 방지", async () => {
    const storage = new MemoryPersonalizationStorage();
    const scores = makeScores(20, { pattern: (i) => 2 + (i % 3) });
    const features = makeFeatures(scores.map((s) => s.localDate), {
      signal: true,
    });
    const r = trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const first = await saveTrainingRun(storage, r.model);
    const second = await saveTrainingRun(storage, { ...r.model, id: "other" });
    expect(first.reused).toBe(false);
    expect(second.reused).toBe(true);
    expect(storage.models).toHaveLength(1);
  });

  test("31. 사용자별 모델 격리", async () => {
    const storage = new MemoryPersonalizationStorage();
    const scores = makeScores(20, { pattern: (i) => 2 + (i % 3) });
    const features = makeFeatures(scores.map((s) => s.localDate), {
      signal: true,
    });
    for (const userId of ["uA", "uB"]) {
      const r = trainCategoryModel({
        userId,
        categoryKey: "energy",
        scores,
        featureRows: features,
        calculationVersion: "c",
        theoryVersion: "t",
        featureSchemaVersion: "f",
      });
      expect(r.ok).toBe(true);
      if (r.ok) await saveTrainingRun(storage, r.model);
    }
    const a = await storage.listByUser("uA");
    const b = await storage.listByUser("uB");
    expect(a.every((m) => m.userId === "uA")).toBe(true);
    expect(b.every((m) => m.userId === "uB")).toBe(true);
    expect(a[0]!.trainingRunKey).not.toBe(b[0]!.trainingRunKey);
  });

  test("32. trainingRunKey에 사용자 포함 (RLS 격리 전제)", () => {
    const k1 = buildTrainingRunKey({
      userId: "uA",
      categoryKey: "energy",
      validSampleCount: 20,
      calculationVersion: "c",
      featureSchemaVersion: "f",
      allowlistVersion: ALLOWLIST_VERSION,
      modelCodeVersion: MODEL_CODE_VERSION,
      endDate: "2025-01-20",
    });
    const k2 = buildTrainingRunKey({
      userId: "uB",
      categoryKey: "energy",
      validSampleCount: 20,
      calculationVersion: "c",
      featureSchemaVersion: "f",
      allowlistVersion: ALLOWLIST_VERSION,
      modelCodeVersion: MODEL_CODE_VERSION,
      endDate: "2025-01-20",
    });
    expect(k1).not.toBe(k2);
  });
});

describe("Phase 4 — 개인화 Ridge MVP · 회귀(원본 불변)", () => {
  test("33–34. journal/astrology 원본을 학습이 변이하지 않음", () => {
    const scores = makeScores(20, { pattern: (i) => 2 + (i % 3) });
    const features = makeFeatures(scores.map((s) => s.localDate), {
      signal: true,
    });
    const scoresSnap = JSON.stringify(scores);
    const featSnap = JSON.stringify(features);
    trainCategoryModel({
      userId: "u1",
      categoryKey: "energy",
      scores,
      featureRows: features,
      calculationVersion: "c",
      theoryVersion: "t",
      featureSchemaVersion: "f",
    });
    expect(JSON.stringify(scores)).toBe(scoresSnap);
    expect(JSON.stringify(features)).toBe(featSnap);
  });

  test("matrix build skips natal-only alone", () => {
    const dates = makeScores(16).map((s) => s.localDate);
    const matrix = buildAlignedMatrix({
      stage: "early_signal",
      dates,
      featureRows: makeFeatures(dates, { signal: true }),
    });
    for (const k of NATAL_ONLY_KEYS) {
      expect(matrix.keys).not.toContain(k);
    }
    expect(matrix.keys.some((k) => (EARLY_BASE_KEYS as readonly string[]).includes(k))).toBe(
      true
    );
  });

  test("predict uses stored preprocess", () => {
    const fit = fitRidge(
      [
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      [1, 2, 3, 4],
      10
    );
    expect("error" in fit).toBe(false);
    if ("error" in fit) return;
    const p = predictRidge(fit, [2.5, 3.5]);
    expect(Number.isFinite(p)).toBe(true);
    expect(mae([1, 2], [1, 2])).toBe(0);
  });
});
