import { describe, expect, test } from "@jest/globals";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import {
  buildRidgeShadowReport,
  decideTodayQuestion,
} from "@/lib/journal/questionDecision";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import { generateTodayQuestion } from "@/lib/journal/todayQuestion";
import type { JournalEntry } from "@/lib/journal/types";
import {
  DEFAULT_FEATURE_FLAGS,
  isRagQuestionWordingEnabled,
  isRidgeQuestionLiveEnabled,
} from "@/lib/app/featureFlags";

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

describe("RAG / Ridge isolation for today question", () => {
  test("flags: RAG wording default ON, Ridge live default OFF", () => {
    expect(DEFAULT_FEATURE_FLAGS.ragQuestionWordingEnabled).toBe(true);
    expect(DEFAULT_FEATURE_FLAGS.ridgeQuestionLiveEnabled).toBe(false);
    expect(isRidgeQuestionLiveEnabled()).toBe(false);
    expect(isRagQuestionWordingEnabled()).toBe(true);
  });

  test("decideTodayQuestion does not need RAG and locks focus/keywords", () => {
    const prior = [entry("2026-07-24", 3)];
    const bundle = buildContentScoreBundle({
      entries: prior,
      todayDate: "2026-07-25",
      enabledCodes: ["energy", "emotional_balance"],
      excludeToday: true,
    });
    const b = buildBTheme(buildDailySajuContext("2026-07-25", null));
    const ranking = rankKeywordsForQuestion({
      bundle,
      priorEntries: prior,
      b,
      topN: 3,
    });
    const decision = decideTodayQuestion({
      b,
      bundle,
      enabledCodes: ["energy", "emotional_balance"],
      keywordRanking: ranking,
    });
    expect(decision.topKeywords.length).toBeGreaterThan(0);
    expect(decision.templateHint.length).toBeGreaterThan(5);
    expect(decision.evidence.dSources.energy).not.toBe("ridge");
  });

  test("Ridge changes shadow bundle but not live when live disabled", () => {
    const prior = [entry("2026-07-24", 8)];
    const live = buildContentScoreBundle({
      entries: prior,
      todayDate: "2026-07-25",
      enabledCodes: ["energy"],
      excludeToday: true,
    });
    const shadow = buildContentScoreBundle({
      entries: prior,
      todayDate: "2026-07-25",
      enabledCodes: ["energy"],
      ridgeByCategory: { energy: 2 },
      excludeToday: true,
    });
    expect(live.dByCategory.energy.source).not.toBe("ridge");
    expect(shadow.dByCategory.energy.source).toBe("ridge");
    expect(shadow.dByCategory.energy.value).toBe(2);

    const report = buildRidgeShadowReport({
      live,
      shadow,
      enabledCodes: ["energy"],
    });
    expect(report[0].shadowDSource).toBe("ridge");
    expect(report[0].liveDSource).not.toBe("ridge");
    expect(report[0].delta).not.toBeNull();
  });

  test("generateTodayQuestion keeps locked decision when RAG wording off", async () => {
    const prevKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const prior = [entry("2026-07-24", 4)];
      const bundle = buildContentScoreBundle({
        entries: prior,
        todayDate: "2026-07-25",
        enabledCodes: ["energy"],
        excludeToday: true,
      });
      const b = buildBTheme(buildDailySajuContext("2026-07-25", null));
      const ranking = rankKeywordsForQuestion({
        bundle,
        priorEntries: prior,
        b,
        topN: 2,
      });
      const decision = decideTodayQuestion({
        b,
        bundle,
        enabledCodes: ["energy"],
        keywordRanking: ranking,
      });
      const result = await generateTodayQuestion({
        b,
        decision,
        allowRagWording: false,
      });
      expect(result.decisionLocked).toBe(true);
      expect(result.focusCategory).toBe(decision.focusCategory);
      expect(result.contentScore).toBe(decision.contentScore);
      expect(result.theoryUsed).toBe(false);
      expect(result.question).toBe(decision.templateHint);
    } finally {
      if (prevKey != null) process.env.OPENAI_API_KEY = prevKey;
    }
  });
});
