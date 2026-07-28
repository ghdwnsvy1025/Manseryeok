/**
 * Gate A — 장애 주입 시 폴백 체인
 */
import { describe, expect, test } from "@jest/globals";
import { generateTodayQuote } from "@/lib/journal/todayQuote";
import { generateTodayFortuneV2 } from "@/lib/journal/todayFortune";
import { generateTodayQuestion } from "@/lib/journal/todayQuestion";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import { decideTodayQuestion } from "@/lib/journal/questionDecision";
import { rankKeywordsForQuestion } from "@/lib/journal/keywords/rank";
import { buildContentScoreBundle } from "@/lib/journal/contentD";
import type { JournalEntry } from "@/lib/journal/types";

function entry(date: string): JournalEntry {
  return {
    id: `e-${date}`,
    userId: "u-fallback",
    sajuProfileId: "p1",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "오늘은 조금 지침이 남았다.",
    overallSatisfaction: 3,
    happinessScore: 3,
    moodLabel: "지침",
    moodLabels: ["지침"],
    mainEventText: null,
    source: "new_diary",
    scores: [
      {
        id: "s1",
        entryId: `e-${date}`,
        userId: "u-fallback",
        categoryCode: "energy",
        userScore: 3,
        aiScore: null,
        finalScore: 3,
        rawScore: 3,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    tags: [{ tagCode: "rest", source: "user", confirmedByUser: true }],
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

describe("Gate A fallback chains", () => {
  test("fortune skipLlm / no API key returns template scores without throwing", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const insight = buildDailyInsightContext({
        eventDate: "2026-07-25",
        entries: [entry("2026-07-24")],
        enabledCodes: ["energy", "emotional_balance", "focus_execution"],
      });
      const res = await generateTodayFortuneV2(insight, { skipLlm: true });
      expect(res.overall.score).toBeGreaterThanOrEqual(0);
      expect(res.overall.score).toBeLessThanOrEqual(1);
      expect(res.domains.length).toBeGreaterThan(0);
      expect(res.openAi.kind).toBe("skipped");
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });

  test("question LLM missing falls back to template question", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const today = "2026-07-25";
      const prior = [entry("2026-07-24")];
      const b = buildBTheme(buildDailySajuContext(today, null));
      const bundle = buildContentScoreBundle({
        entries: prior,
        todayDate: today,
        enabledCodes: ["energy", "emotional_balance"],
        excludeToday: true,
      });
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
      const res = await generateTodayQuestion({ b, decision, ganjiKo: null });
      expect(res.question.length).toBeGreaterThan(0);
      expect(res.openAi.kind === "skipped" || res.openAi.kind === "failed").toBe(
        true
      );
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });

  test("empty quote library falls back to deterministic sentence", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const e = entry("2026-07-25");
      const b = buildBTheme(buildDailySajuContext(e.entryDate, null));
      const a = await generateTodayQuote({
        b,
        entry: e,
        recentAOverall: 3,
        trend: { delta: null, direction: "unknown" },
        quoteCandidates: [],
        recentDeliveries: [],
      });
      const again = await generateTodayQuote({
        b,
        entry: e,
        recentAOverall: 3,
        trend: { delta: null, direction: "unknown" },
        quoteCandidates: [],
        recentDeliveries: [],
      });
      expect(a.contentType).not.toBe("verified_quote");
      expect(a.sentence).toBe(again.sentence);
      expect(a.sentence.length).toBeGreaterThan(0);
    } finally {
      if (prev) process.env.OPENAI_API_KEY = prev;
    }
  });
});
