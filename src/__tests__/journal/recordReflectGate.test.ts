import {
  applyRecordDayGate,
  journalShareCapForDays,
  pillarInfluenceFromDays,
  recordDayPhase,
  resolveGatedBlend,
  sajuHypothesisWeightFromDays,
} from "@/lib/journal/insight/recordReflectGate";
import { computeBlendWeights } from "@/lib/journal/insight/dynamicWeights";
import { sajuHypothesisWeight } from "@/lib/journal/questionFeedback";

describe("recordReflectGate", () => {
  it("caps journal share by unique days even when XP is high", () => {
    const xpHeavy = computeBlendWeights({
      totalXp: 5000,
      onboardingCompleted: true,
    });
    expect(xpHeavy.recent + xpHeavy.keyword).toBeGreaterThan(0.7);

    const gatedBoot = applyRecordDayGate(xpHeavy, 3);
    expect(gatedBoot.dayPhase).toBe("boot");
    expect(gatedBoot.journalShare).toBeLessThanOrEqual(0.151);
    expect(gatedBoot.sajuShare).toBeGreaterThanOrEqual(0.84);

    const gatedFirst = applyRecordDayGate(xpHeavy, 10);
    expect(gatedFirst.dayPhase).toBe("first_feel");
    expect(gatedFirst.journalShare).toBeLessThanOrEqual(0.351);

    const gatedStable = applyRecordDayGate(xpHeavy, 20);
    expect(gatedStable.dayPhase).toBe("stable");
    expect(gatedStable.journalShare).toBeLessThanOrEqual(0.551);

    const gatedPersonal = applyRecordDayGate(xpHeavy, 40);
    expect(gatedPersonal.dayPhase).toBe("personal");
    expect(gatedPersonal.journalShare).toBeGreaterThan(0.7);
  });

  it("unlocks pillar influence by day thresholds", () => {
    expect(pillarInfluenceFromDays(5).ganji).toBe("off");
    expect(pillarInfluenceFromDays(20).stem).toBe("hint");
    expect(pillarInfluenceFromDays(20).ganji).toBe("off");
    expect(pillarInfluenceFromDays(40).ganji).toBe("hint");
    expect(pillarInfluenceFromDays(70).ganji).toBe("apply");
  });

  it("aligns saju hypothesis weight with day phases", () => {
    expect(sajuHypothesisWeight(0)).toBe(sajuHypothesisWeightFromDays(0));
    expect(sajuHypothesisWeight(3)).toBeGreaterThan(sajuHypothesisWeight(20));
    expect(sajuHypothesisWeight(60)).toBe(0.2);
  });

  it("exports caps and phases consistently", () => {
    expect(journalShareCapForDays(0)).toBe(0.15);
    expect(journalShareCapForDays(7)).toBe(0.35);
    expect(journalShareCapForDays(14)).toBe(0.55);
    expect(journalShareCapForDays(28)).toBe(1);
    expect(recordDayPhase(0)).toBe("boot");
    expect(resolveGatedBlend({ totalXp: 0, priorUniqueDays: 0 }).guideKo).toMatch(
      /시동/
    );
  });
});
