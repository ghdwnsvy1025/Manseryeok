import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { scoreFortuneDomains, FORTUNE_SCORE_VERSION } from "@/lib/journal/fortune/score";
import { FORTUNE_DOMAIN_ORDER } from "@/lib/journal/fortune/domains";
import type { JournalEntry } from "@/lib/journal/types";

function entry(
  date: string,
  energyFinal: number,
  extraScores: Array<{ code: JournalEntry["scores"][0]["categoryCode"]; value: number }> = []
): JournalEntry {
  const scores = [
    {
      id: `s-energy-${date}`,
      entryId: `e-${date}`,
      userId: "u",
      categoryCode: "energy" as const,
      userScore: energyFinal as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      aiScore: null,
      finalScore: energyFinal,
      rawScore: energyFinal as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      isNotApplicable: false,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: "",
      updatedAt: "",
    },
    ...extraScores.map((s) => ({
      id: `s-${s.code}-${date}`,
      entryId: `e-${date}`,
      userId: "u",
      categoryCode: s.code,
      userScore: s.value as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      aiScore: null,
      finalScore: s.value,
      rawScore: s.value as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      isNotApplicable: false,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: "",
      updatedAt: "",
    })),
  ];

  return {
    id: `e-${date}`,
    userId: "u",
    sajuProfileId: "p1",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "",
    overallSatisfaction: energyFinal as JournalEntry["overallSatisfaction"],
    happinessScore: energyFinal,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores,
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: null,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: "",
    updatedAt: "",
  };
}

const ENABLED = [
  "emotional_balance",
  "energy",
  "focus_execution",
  "work_study",
  "relationship",
  "recovery_sleep",
  "finance_resource",
  "physical_condition",
] as const;

describe("DailyInsightContext", () => {
  test("excludes today entries from context", () => {
    const today = "2026-07-25";
    const ctx = buildDailyInsightContext({
      eventDate: today,
      entries: [
        entry("2026-07-24", 8),
        entry(today, 1, [{ code: "emotional_balance", value: 1 }]),
      ],
      enabledCodes: [...ENABLED],
    });
    expect(ctx.dataCutoffAt.startsWith(today)).toBe(true);
    expect(ctx.priorUniqueDays).toBeGreaterThanOrEqual(1);
    expect(ctx.overallConfidence).toBeGreaterThan(0);
  });

  test("builds empty-safe context with no prior entries", () => {
    const ctx = buildDailyInsightContext({
      eventDate: "2026-07-25",
      entries: [],
      enabledCodes: [...ENABLED],
    });
    expect(ctx.priorUniqueDays).toBe(0);
    expect(ctx.engineVersion).toContain("insight");
    expect(ctx.bTheme).toBeTruthy();
  });
});

describe("fortune domain scoring", () => {
  test("returns 5 domains with required fields", () => {
    const ctx = buildDailyInsightContext({
      eventDate: "2026-07-25",
      entries: [
        entry("2026-07-20", 7, [
          { code: "work_study", value: 8 },
          { code: "relationship", value: 4 },
        ]),
        entry("2026-07-21", 6),
        entry("2026-07-22", 5),
      ],
      enabledCodes: [...ENABLED],
    });
    const domains = scoreFortuneDomains(ctx);
    expect(domains.map((d) => d.domain)).toEqual([...FORTUNE_DOMAIN_ORDER]);
    for (const d of domains) {
      expect(d.headline.length).toBeGreaterThan(0);
      expect(d.summary.length).toBeGreaterThan(0);
      expect(d.opportunity.length).toBeGreaterThan(0);
      expect(d.caution.length).toBeGreaterThan(0);
      expect(d.action.length).toBeGreaterThan(0);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(1);
      expect(["supportive", "balanced", "caution"]).toContain(d.tone);
    }
    expect(FORTUNE_SCORE_VERSION).toContain("fortune-score");
  });
});
