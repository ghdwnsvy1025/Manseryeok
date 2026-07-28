import { describe, expect, test } from "@jest/globals";
import {
  computeBlendWeights,
  dataMaturityTier,
  maturityTargetXp,
  ONBOARDING_XP_BONUS,
  PERSONALIZATION_MATURITY_LEVEL,
} from "@/lib/journal/insight/dynamicWeights";
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTION_COUNT,
  validateOnboardingAnswers,
  type OnboardingAnswers,
} from "@/lib/journal/onboarding/questions";
import { deriveOnboardingProfile } from "@/lib/journal/onboarding/profile";
import { cumulativeXpForLevel } from "@/lib/product/personalizationLevel";

describe("XP-driven dynamic weights", () => {
  test("weights always sum to 1", () => {
    for (const xp of [0, 50, 180, 500, 2000, 5000, 20000]) {
      const w = computeBlendWeights({ totalXp: xp });
      expect(Math.abs(w.recent + w.keyword + w.natal - 1)).toBeLessThan(1e-9);
    }
  });

  test("cold start leans on natal prior; mature leans on personal data", () => {
    const cold = computeBlendWeights({ totalXp: 0 });
    const mature = computeBlendWeights({
      totalXp: maturityTargetXp(),
    });

    expect(cold.natal).toBeGreaterThan(cold.recent);
    expect(mature.recent).toBeGreaterThan(mature.natal);
    expect(mature.recent).toBeGreaterThan(cold.recent);
    expect(mature.natal).toBeLessThan(cold.natal);
    expect(mature.maturity).toBe(1);
    expect(mature.tier).toBe("mature");
  });

  test("recent weight increases monotonically with XP", () => {
    let prev = -1;
    for (const xp of [0, 100, 400, 1000, 2043, 5000]) {
      const w = computeBlendWeights({ totalXp: xp });
      expect(w.recent).toBeGreaterThanOrEqual(prev);
      prev = w.recent;
    }
  });

  test("weights saturate at Lv5 target XP", () => {
    const target = maturityTargetXp();
    expect(target).toBe(cumulativeXpForLevel(PERSONALIZATION_MATURITY_LEVEL));
    const atTarget = computeBlendWeights({ totalXp: target });
    const beyond = computeBlendWeights({ totalXp: target * 3 });
    expect(beyond.recent).toBe(atTarget.recent);
    expect(beyond.natal).toBe(atTarget.natal);
    expect(beyond.tier).toBe("mature");
  });

  test("onboarding grants XP bonus at cold start", () => {
    const without = computeBlendWeights({ totalXp: 0 });
    const withOnb = computeBlendWeights({
      totalXp: 0,
      onboardingCompleted: true,
    });
    expect(withOnb.effectiveXp).toBe(ONBOARDING_XP_BONUS);
    expect(withOnb.recent).toBeGreaterThan(without.recent);
    expect(withOnb.natal).toBeLessThan(without.natal);
  });

  test("tiers by maturity", () => {
    expect(dataMaturityTier(0)).toBe("cold");
    expect(dataMaturityTier(0.1)).toBe("cold");
    expect(dataMaturityTier(0.12)).toBe("warming");
    expect(dataMaturityTier(0.39)).toBe("warming");
    expect(dataMaturityTier(0.4)).toBe("warm");
    expect(dataMaturityTier(0.99)).toBe("warm");
    expect(dataMaturityTier(1)).toBe("mature");
  });

  test("negative / NaN input is treated as zero", () => {
    expect(computeBlendWeights({ totalXp: -5 }).effectiveXp).toBe(0);
    expect(computeBlendWeights({ totalXp: NaN }).effectiveXp).toBe(0);
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
