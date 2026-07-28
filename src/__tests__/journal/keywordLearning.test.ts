import { describe, expect, test } from "@jest/globals";
import {
  aggregateKeywordBiasesFromEvents,
  applyFeedbackToKeywordBiases,
  resolveKeywordCodes,
} from "@/lib/journal/keywords/learning";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { JournalEntry } from "@/lib/journal/types";

function entry(date: string, energyFinal: number): JournalEntry {
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

describe("keyword feedback learning", () => {
  test("resolves plain labels to codes", () => {
    expect(resolveKeywordCodes(["recovery", "focus"])).toEqual(
      expect.arrayContaining(["recovery", "focus"])
    );
  });

  test("fit_good boosts and fit_bad lowers", () => {
    let biases = applyFeedbackToKeywordBiases({
      biases: {},
      eventType: "fit_good",
      keywords: ["recovery"],
    });
    expect(biases.recovery).toBeGreaterThan(0);
    biases = applyFeedbackToKeywordBiases({
      biases,
      eventType: "fit_bad",
      keywords: ["recovery"],
    });
    expect(biases.recovery!).toBeLessThan(0.8);
  });

  test("aggregate events then changes ranking", () => {
    const biases = aggregateKeywordBiasesFromEvents([
      { eventType: "fit_bad", keywords: ["work"] },
      { eventType: "fit_bad", keywords: ["work"] },
      { eventType: "fit_good", keywords: ["rest"] },
      { eventType: "led_to_write", keywords: ["rest"] },
    ]);
    expect(biases.work!).toBeLessThan(0);
    expect(biases.rest!).toBeGreaterThan(0);

    const prior = [entry("2026-07-24", 5)];
    const bundle = buildContentScoreBundle({
      entries: prior,
      todayDate: "2026-07-25",
      enabledCodes: ["energy", "work_study", "recovery_sleep"],
      excludeToday: true,
    });
    const b = buildBTheme(buildDailySajuContext("2026-07-25", null));
    const withBias = rankKeywordsForQuestion({
      bundle,
      priorEntries: prior,
      b,
      topN: 5,
      keywordBiases: biases,
    });
    expect(withBias.feedbackBiasApplied).toBe(true);
    const rest = withBias.ranked.find((k) => k.code === "rest");
    const work = withBias.ranked.find((k) => k.code === "work");
    expect(rest?.reasons.some((r) => r.startsWith("feedback_bias"))).toBe(true);
    expect(work?.reasons.some((r) => r.startsWith("feedback_bias"))).toBe(true);
  });
});
