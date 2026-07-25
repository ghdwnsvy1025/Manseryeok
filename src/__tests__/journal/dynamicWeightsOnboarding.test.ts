import { describe, expect, test } from "@jest/globals";
import {
  computeBlendWeights,
  dataMaturityTier,
  MATURITY_DAYS,
  ONBOARDING_DAY_BONUS,
} from "@/lib/journal/insight/dynamicWeights";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTION_COUNT,
  validateOnboardingAnswers,
  type OnboardingAnswers,
} from "@/lib/journal/onboarding/questions";
import { deriveOnboardingProfile } from "@/lib/journal/onboarding/profile";

describe("data-volume driven dynamic weights", () => {
  test("weights always sum to 1", () => {
    for (const days of [0, 1, 5, 15, 30, 45, 60, 120]) {
      const w = computeBlendWeights({ priorUniqueDays: days });
      expect(Math.abs(w.recent + w.keyword + w.natal - 1)).toBeLessThan(1e-9);
    }
  });

  test("cold start leans on natal prior; mature leans on personal data", () => {
    const cold = computeBlendWeights({ priorUniqueDays: 0 });
    const mature = computeBlendWeights({ priorUniqueDays: MATURITY_DAYS });

    expect(cold.natal).toBeGreaterThan(cold.recent);
    expect(mature.recent).toBeGreaterThan(mature.natal);
    expect(mature.recent).toBeGreaterThan(cold.recent);
    expect(mature.natal).toBeLessThan(cold.natal);
  });

  test("recent weight increases monotonically with data volume", () => {
    let prev = -1;
    for (const days of [0, 3, 10, 20, 40, 60, 90]) {
      const w = computeBlendWeights({ priorUniqueDays: days });
      expect(w.recent).toBeGreaterThanOrEqual(prev);
      prev = w.recent;
    }
  });

  test("weights saturate beyond maturity horizon", () => {
    const at60 = computeBlendWeights({ priorUniqueDays: 60 });
    const at365 = computeBlendWeights({ priorUniqueDays: 365 });
    expect(at365.recent).toBe(at60.recent);
    expect(at365.natal).toBe(at60.natal);
    expect(at365.tier).toBe("mature");
  });

  test("onboarding grants effective-day bonus at cold start", () => {
    const without = computeBlendWeights({ priorUniqueDays: 0 });
    const withOnb = computeBlendWeights({
      priorUniqueDays: 0,
      onboardingCompleted: true,
    });
    expect(withOnb.effectiveDays).toBe(ONBOARDING_DAY_BONUS);
    expect(withOnb.recent).toBeGreaterThan(without.recent);
    expect(withOnb.natal).toBeLessThan(without.natal);
  });

  test("tiers", () => {
    expect(dataMaturityTier(0)).toBe("cold");
    expect(dataMaturityTier(6)).toBe("cold");
    expect(dataMaturityTier(7)).toBe("warming");
    expect(dataMaturityTier(29)).toBe("warming");
    expect(dataMaturityTier(30)).toBe("warm");
    expect(dataMaturityTier(60)).toBe("mature");
  });

  test("negative / NaN input is treated as zero", () => {
    expect(computeBlendWeights({ priorUniqueDays: -5 }).effectiveDays).toBe(0);
    expect(computeBlendWeights({ priorUniqueDays: NaN }).effectiveDays).toBe(0);
  });
});

describe("onboarding 6-question survey", () => {
  test("exactly 6 questions with unique ids and ordered 1..6", () => {
    expect(ONBOARDING_QUESTION_COUNT).toBe(6);
    expect(ONBOARDING_QUESTIONS.map((q) => q.order)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(new Set(ONBOARDING_QUESTIONS.map((q) => q.id)).size).toBe(6);
    for (const q of ONBOARDING_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.options.map((o) => o.value)).size).toBe(
        q.options.length
      );
    }
  });

  test("validation rejects unknown question, unknown option, over-select, duplicates", () => {
    expect(
      validateOnboardingAnswers({ nope: ["x"] } as unknown as OnboardingAnswers)
        .ok
    ).toBe(false);
    expect(validateOnboardingAnswers({ focus_areas: ["nope"] }).ok).toBe(false);
    expect(
      validateOnboardingAnswers({
        focus_areas: ["work_study", "relationship", "finance_resource"],
      }).ok
    ).toBe(false);
    expect(
      validateOnboardingAnswers({ focus_areas: ["work_study", "work_study"] }).ok
    ).toBe(false);
    expect(validateOnboardingAnswers({ energy_baseline: ["low"] }).ok).toBe(
      true
    );
  });

  test("derives personal importance, keyword prior and baselines", () => {
    const profile = deriveOnboardingProfile({
      focus_areas: ["recovery_sleep", "work_study"],
      energy_baseline: ["low"],
      recovery_baseline: ["low"],
      stress_response: ["body"],
      change_context: ["ongoing"],
      record_goal: ["habit"],
    });

    expect(profile.completed).toBe(true);
    expect(profile.completeness).toBe(1);
    // 1순위로 고른 잠·휴식이 2순위 일·공부보다 중요도가 높아야 한다
    expect(profile.personalImportance.recovery_sleep!).toBeGreaterThan(
      profile.personalImportance.work_study!
    );
    expect(profile.keywordPrior.recovery!).toBeGreaterThan(0);
    expect(profile.baselines.energy).toBe(3);
    expect(profile.baselines.recovery_sleep).toBe(3);
    expect(profile.stressResponse).toBe("body");
    expect(profile.changeContext).toBe("ongoing");
    expect(profile.recordGoal).toBe("habit");
  });

  test("partial answers yield partial completeness and not completed", () => {
    const profile = deriveOnboardingProfile({ focus_areas: ["relationship"] });
    expect(profile.completed).toBe(false);
    expect(profile.completeness).toBeCloseTo(0.17, 2);
    expect(profile.personalImportance.relationship!).toBeGreaterThan(0);
  });

  test("empty answers are safe", () => {
    const profile = deriveOnboardingProfile({});
    expect(profile.completeness).toBe(0);
    expect(profile.personalImportance).toEqual({});
    expect(profile.keywordPrior).toEqual({});
  });

  test("importance and prior values stay within 0..1", () => {
    const profile = deriveOnboardingProfile({
      focus_areas: ["recovery_sleep", "physical_condition"],
      energy_baseline: ["low"],
      recovery_baseline: ["low"],
      stress_response: ["body"],
      change_context: ["none"],
      record_goal: ["self_understanding"],
    });
    for (const v of Object.values(profile.personalImportance)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (const v of Object.values(profile.keywordPrior)) {
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
