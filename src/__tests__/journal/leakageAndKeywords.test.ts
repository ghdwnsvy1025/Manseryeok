import { describe, expect, test } from "@jest/globals";
import {
  buildContentScoreBundle,
} from "@/lib/journal/contentD";
import {
  computeRecentAByCategory,
  entriesStrictlyBefore,
} from "@/lib/journal/recentA";
import { KEYWORD_COUNT, KEYWORD_CATALOG } from "@/lib/journal/keywords/catalog";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { JournalEntry } from "@/lib/journal/types";

function entry(
  date: string,
  energyFinal: number,
  tags: string[] = []
): JournalEntry {
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
    scores: [
      {
        id: `s-${date}`,
        entryId: `e-${date}`,
        userId: "u",
        categoryCode: "energy",
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
    ],
    tags: tags.map((tagCode) => ({
      tagCode,
      source: "user" as const,
      confirmedByUser: true,
    })),
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

describe("today leakage guard", () => {
  test("entriesStrictlyBefore drops today", () => {
    const list = [
      entry("2026-07-23", 9),
      entry("2026-07-24", 2),
      entry("2026-07-25", 1),
    ];
    expect(entriesStrictlyBefore(list, "2026-07-25").map((e) => e.entryDate)).toEqual([
      "2026-07-23",
      "2026-07-24",
    ]);
  });

  test("recent A with includeAsOfDate:false ignores today's extreme score", () => {
    const list = [entry("2026-07-24", 8), entry("2026-07-25", 1)];
    const inclusive = computeRecentAByCategory(
      list,
      "2026-07-25",
      ["energy"],
      7,
      { includeAsOfDate: true }
    );
    const prior = computeRecentAByCategory(
      list,
      "2026-07-25",
      ["energy"],
      7,
      { includeAsOfDate: false }
    );
    expect(inclusive.energy).toBe(4.5);
    expect(prior.energy).toBe(8);
  });

  test("buildContentScoreBundle excludeToday ignores today's A", () => {
    const list = [entry("2026-07-24", 9), entry("2026-07-25", 1)];
    const leaky = buildContentScoreBundle({
      entries: list,
      todayDate: "2026-07-25",
      enabledCodes: ["energy"],
    });
    const safe = buildContentScoreBundle({
      entries: list,
      todayDate: "2026-07-25",
      enabledCodes: ["energy"],
      excludeToday: true,
    });
    expect(leaky.recentAByCategory.energy).toBe(5);
    expect(safe.recentAByCategory.energy).toBe(9);
  });
});

describe("keyword catalog", () => {
  test("exactly 16 keywords", () => {
    expect(KEYWORD_COUNT).toBe(16);
    expect(KEYWORD_CATALOG).toHaveLength(16);
  });

  test("rankKeywords prefers low recent energy ??health/rest", () => {
    const prior = [entry("2026-07-24", 2, ["illness"])];
    const bundle = buildContentScoreBundle({
      entries: prior,
      todayDate: "2026-07-25",
      enabledCodes: ["energy", "physical_condition", "recovery_sleep"],
      excludeToday: true,
    });
    const b = buildBTheme(buildDailySajuContext("2026-07-25", null));
    const ranked = rankKeywordsForQuestion({
      bundle,
      priorEntries: prior,
      b,
      topN: 5,
    });
    expect(ranked.top.length).toBeGreaterThan(0);
    const codes = ranked.top.map((k) => k.code);
    expect(
      codes.some((c) =>
        ["health", "recovery", "rest", "focus"].includes(c)
      )
    ).toBe(true);
  });
});
