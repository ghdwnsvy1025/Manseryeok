import { MOOD_OPTIONS } from "@/lib/journal/types";
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
  MAX_CHECKIN_TAGS,
  MAX_MOODS,
  NONE_SPECIAL_TAG,
  OTHER_EVENT_TAG,
  ordinalToJournalScore,
} from "@/lib/journal/checkin/catalog";
import { HAPPINESS_ANCHORS, isHappinessScore } from "@/lib/journal/happinessScale";
import {
  selectDailyDomains,
  scoreDomainPriority,
} from "@/lib/journal/checkin/selectDomains";
import { validateCheckInSave } from "@/lib/journal/checkin/validation";
import { isKnownTagCode } from "@/lib/journal/eventTagCatalog";
import type { JournalEntry } from "@/lib/journal/types";

function validCore() {
  return {
    energy: { ordinal: 4 as const, isNotApplicable: false },
    focus_execution: { ordinal: 3 as const, isNotApplicable: false },
    physical_condition: { ordinal: 3 as const, isNotApplicable: false },
    emotional_balance: { ordinal: 4 as const, isNotApplicable: false },
  };
}

function entryWithScore(
  date: string,
  code: JournalEntry["scores"][0]["categoryCode"],
  value: number,
  content = ""
): JournalEntry {
  return {
    id: `e-${date}-${code}`,
    userId: "u",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content,
    overallSatisfaction: value as JournalEntry["overallSatisfaction"],
    happinessScore: value,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores: [
      {
        id: `s-${date}`,
        entryId: `e-${date}`,
        userId: "u",
        categoryCode: code,
        userScore: value as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
        aiScore: null,
        finalScore: value,
        rawScore: value as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: 2,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: "",
    updatedAt: "",
  };
}

describe("checkin v2 contract (step 3)", () => {
  test("mood catalog is exactly 9 including 답답함", () => {
    expect([...MOOD_OPTIONS]).toEqual([
      "기쁨",
      "평온",
      "설렘",
      "불안",
      "분노",
      "답답함",
      "슬픔",
      "지침",
      "무덤덤",
    ]);
    expect(MOOD_OPTIONS).toHaveLength(9);
    expect(MAX_MOODS).toBe(3);
  });

  test("core states are the 4 required labels' codes", () => {
    expect([...CORE_STATE_CODES]).toEqual([
      "energy",
      "focus_execution",
      "physical_condition",
      "emotional_balance",
    ]);
    expect(DOMAIN_POOL_CODES).toContain("recovery_sleep");
  });

  test("happiness anchors 0/5/10 always defined", () => {
    expect(isHappinessScore(0)).toBe(true);
    expect(HAPPINESS_ANCHORS.map((a) => a.value)).toEqual([0, 5, 10]);
    expect(HAPPINESS_ANCHORS.find((a) => a.value === 0)?.label).toContain(
      "힘들"
    );
    expect(HAPPINESS_ANCHORS.find((a) => a.value === 5)?.label).toContain(
      "보통"
    );
    expect(HAPPINESS_ANCHORS.find((a) => a.value === 10)?.label).toContain(
      "좋"
    );
  });

  test("특별한 일 없음 and 기타 exist; exclusivity enforced", () => {
    expect(isKnownTagCode(NONE_SPECIAL_TAG)).toBe(true);
    expect(isKnownTagCode(OTHER_EVENT_TAG)).toBe(true);
    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["평온"],
        tagCodes: [NONE_SPECIAL_TAG, "conflict"],
        core: validCore(),
        domains: [],
      }).ok
    ).toBe(false);
    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["평온"],
        tagCodes: [NONE_SPECIAL_TAG],
        core: validCore(),
        domains: [],
      }).ok
    ).toBe(true);
  });

  test("rejects more than 3 moods and unknown/duplicate moods", () => {
    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["기쁨", "평온", "설렘", "지침"],
        tagCodes: [],
        core: validCore(),
        domains: [],
      }).ok
    ).toBe(false);
    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["기쁨", "기쁨"],
        tagCodes: [],
        core: validCore(),
        domains: [],
      }).ok
    ).toBe(false);
    expect(
      validateCheckInSave({
        happiness: 5,
        moods: ["존재하지않음"],
        tagCodes: [],
        core: validCore(),
        domains: [],
      }).ok
    ).toBe(false);
  });

  test("ordinal maps to 1~10", () => {
    expect(ordinalToJournalScore(1)).toBe(1);
    expect(ordinalToJournalScore(5)).toBe(10);
    expect(MAX_CHECKIN_TAGS).toBe(3);
  });

  test("sleep decline selects recovery_sleep", () => {
    const recent = [
      entryWithScore("2026-07-20", "recovery_sleep", 2),
      entryWithScore("2026-07-21", "recovery_sleep", 3),
      entryWithScore("2026-07-22", "recovery_sleep", 2),
    ];
    const domains = selectDailyDomains({
      tagCodes: ["work_pressure"],
      recentEntries: recent,
      asOfDate: "2026-07-25",
    });
    expect(domains[0]).toBe("recovery_sleep");
  });

  test("conflict selects relationship", () => {
    const domains = selectDailyDomains({
      tagCodes: ["conflict"],
      asOfDate: "2026-07-25",
    });
    expect(domains).toContain("relationship");
    expect(domains[0]).toBe("relationship");
  });

  test("big spend selects finance_resource", () => {
    const domains = selectDailyDomains({
      tagCodes: ["big_spend"],
      asOfDate: "2026-07-25",
    });
    expect(domains[0]).toBe("finance_resource");
  });

  test("long-unasked domain rotates in", () => {
    const domains = selectDailyDomains({
      tagCodes: [],
      asOfDate: "2026-07-25",
      lastAskedByDomain: {
        recovery_sleep: "2026-07-24",
        work_study: "2026-07-24",
        relationship: "2026-07-24",
        finance_resource: "2026-01-01",
        change_opportunity: "2026-07-20",
      },
    });
    expect(domains).toContain("finance_resource");
  });

  test("identical context yields identical domains (deterministic)", () => {
    const ctx = {
      tagCodes: ["conflict", "big_spend"],
      asOfDate: "2026-07-25",
      recentEntries: [entryWithScore("2026-07-20", "relationship", 3)],
    };
    expect(selectDailyDomains(ctx)).toEqual(selectDailyDomains(ctx));
    const a = scoreDomainPriority("relationship", ctx);
    const b = scoreDomainPriority("relationship", ctx);
    expect(a.total).toBe(b.total);
  });

  test("tag order does not change top domain for same tags", () => {
    const a = selectDailyDomains({
      tagCodes: ["conflict", "big_spend"],
      asOfDate: "2026-07-25",
    });
    const b = selectDailyDomains({
      tagCodes: ["big_spend", "conflict"],
      asOfDate: "2026-07-25",
    });
    expect(a).toEqual(b);
  });
});
