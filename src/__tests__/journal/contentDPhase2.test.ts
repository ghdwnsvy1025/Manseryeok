import { describe, expect, test } from "@jest/globals";
import {
  combineRecentAAndD,
  buildContentScoreBundle,
} from "@/lib/journal/contentD";
import { buildQuestionTemplate } from "@/lib/journal/todayQuestion";
import { buildQuoteTemplate } from "@/lib/journal/todayQuote";
import { buildBTheme } from "@/lib/journal/bTheme";
import { buildDailySajuContext } from "@/lib/product/dailySajuContext";
import type { JournalEntry } from "@/lib/journal/types";

describe("content D combine", () => {
  test("A와 D 모두 있으면 평균", () => {
    expect(combineRecentAAndD(2.5, 4).value).toBe(3.25);
    expect(combineRecentAAndD(2.5, 4).mode).toBe("a_and_d");
  });

  test("한쪽만", () => {
    expect(combineRecentAAndD(null, 4.2)).toEqual({
      value: 4.2,
      mode: "d_only",
    });
    expect(combineRecentAAndD(3, null)).toEqual({ value: 3, mode: "a_only" });
  });

  test("둘 다 없으면 none — 0으로 채우지 않음", () => {
    expect(combineRecentAAndD(null, null)).toEqual({
      value: null,
      mode: "none",
    });
  });
});

describe("question/quote templates", () => {
  test("질문 템플릿이 B 키워드를 포함", () => {
    const ctx = buildDailySajuContext("2026-07-23", null);
    const b = buildBTheme(ctx);
    const q = buildQuestionTemplate({
      b,
      focus: "relationship",
      contentScore: 2.5,
    });
    expect(q.length).toBeGreaterThan(10);
  });

  test("명언 템플릿 — 유명인 인용 없음", () => {
    const ctx = buildDailySajuContext("2026-07-23", null);
    const b = buildBTheme(ctx);
    const entry: JournalEntry = {
      id: "1",
      userId: "u",
      entryDate: "2026-07-23",
      userTimezone: "Asia/Seoul",
      content: "피곤했다",
      overallSatisfaction: 2,
      moodLabel: "지침",
      mainEventText: null,
      source: "new_diary",
      scores: [
        {
          id: "s",
          entryId: "1",
          userId: "u",
          categoryCode: "energy",
          userScore: 2,
          aiScore: null,
          finalScore: 2,
          rawScore: 2,
          isNotApplicable: false,
          normalizedZ: null,
          normalizationVersion: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
      tags: [],
      xpGranted: true,
      xpAwarded: 10,
      schemaVersion: 2,
      createdAt: "",
      updatedAt: "",
    };
    const quote = buildQuoteTemplate({
      b,
      entry,
      recentAOverall: 2.5,
      trend: { delta: -0.3, direction: "down" },
    });
    expect(quote.length).toBeGreaterThan(20);
    expect(quote.includes("http")).toBe(false);

    const bundle = buildContentScoreBundle({
      entries: [entry],
      todayDate: "2026-07-23",
      enabledCodes: ["energy"],
    });
    expect(bundle.dByCategory.energy?.source).toBe("d1");
  });
});
