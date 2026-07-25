import {
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  ordinalToJournalScore,
} from "@/lib/journal/checkin/catalog";
import { selectDailyDomains } from "@/lib/journal/checkin/selectDomains";
import { validateCheckInSave } from "@/lib/journal/checkin/validation";
import { isHappinessScore } from "@/lib/journal/happinessScale";
import { isCheckinV2Enabled } from "@/lib/app/featureFlags";

describe("checkin v2 foundations", () => {
  test("feature flag defaults OFF", () => {
    expect(isCheckinV2Enabled()).toBe(false);
  });

  test("happiness 0 is valid", () => {
    expect(isHappinessScore(0)).toBe(true);
    expect(isHappinessScore(10)).toBe(true);
    expect(isHappinessScore(11)).toBe(false);
    expect(isHappinessScore(-1)).toBe(false);
  });

  test("ordinal maps to 1~10 A scores", () => {
    expect(ordinalToJournalScore(1)).toBe(1);
    expect(ordinalToJournalScore(3)).toBe(5);
    expect(ordinalToJournalScore(5)).toBe(10);
  });

  test("selectDailyDomains prefers tag hints then fills to 2", () => {
    const domains = selectDailyDomains(["illness", "income"]);
    expect(domains).toEqual(["physical_condition", "finance_resource"]);
    expect(selectDailyDomains([]).length).toBe(2);
  });

  test("validateCheckInSave enforces mood/tag caps and required core", () => {
    const core = {
      emotional_balance: { ordinal: 3 as const, isNotApplicable: false },
      energy: { ordinal: 4 as const, isNotApplicable: false },
      recovery_sleep: { ordinal: null, isNotApplicable: true },
      focus_execution: { ordinal: 2 as const, isNotApplicable: false },
    };

    expect(
      validateCheckInSave({
        happiness: 0,
        moods: ["기쁨", "평온", "설렘"],
        tagCodes: ["exercise", "rest", "learning"],
        core,
        domains: [
          { code: "physical_condition", ordinal: 3, isNotApplicable: false },
          { code: "work_study", ordinal: null, isNotApplicable: true },
        ],
      }).ok
    ).toBe(true);

    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["기쁨", "평온", "설렘", "지침"],
        tagCodes: [],
        core,
        domains: [],
      })
    ).toMatchObject({ ok: false });

    expect(MAX_MOODS).toBe(3);
    expect(MAX_CHECKIN_TAGS).toBe(3);
  });
});
