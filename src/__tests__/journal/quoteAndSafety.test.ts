import { describe, expect, test } from "@jest/globals";
import {
  validateFortuneText,
  validateTodaySentenceText,
} from "@/lib/journal/contentSafety";
import { filterSafeQuotes } from "@/lib/journal/quote/safetyFilter";
import { selectBestQuote } from "@/lib/journal/quote/select";
import { isQuoteExposable, type QuoteLibraryItem } from "@/lib/journal/quote/types";
import { isTooSimilar, jaccardSimilarity } from "@/lib/journal/contentOverlap";
import { buildTodaySentenceTemplate } from "@/lib/journal/todayQuote";
import { pickTemplateSentence } from "@/lib/journal/quote/templates";
import type { JournalEntry } from "@/lib/journal/types";
import type { BTheme } from "@/lib/journal/bTheme";

function quote(partial: Partial<QuoteLibraryItem> & { id: string; quoteTextKo: string }): QuoteLibraryItem {
  return {
    originalText: null,
    authorName: "작가",
    workTitle: "작품",
    publicationInfo: null,
    sourceUrl: null,
    sourceType: "book",
    translator: null,
    language: "ko",
    themes: ["회복"],
    emotionalTone: ["차분"],
    suitableStates: [],
    unsuitableStates: [],
    rightsStatus: "public_domain",
    verificationStatus: "primary_source_verified",
    attributionConfidence: 0.9,
    active: true,
    ...partial,
  };
}

const b: BTheme = {
  tenGod: null,
  keywords: ["균형"],
  focusCategoryHints: [],
  plainSummary: "균형이 필요한 날",
};

describe("content safety", () => {
  test("blocks forbidden fortune phrases", () => {
    expect(validateFortuneText("반드시 좋은 일이 생긴다").ok).toBe(false);
    expect(validateFortuneText("속도를 조절하기 좋은 날입니다").ok).toBe(true);
  });

  test("blocks long or attributed sentences", () => {
    expect(validateTodaySentenceText("짧은 문장입니다.").ok).toBe(true);
    expect(
      validateTodaySentenceText("아".repeat(120)).ok
    ).toBe(false);
    expect(validateTodaySentenceText("십신이 비겁이라서 오늘은 힘들어요").ok).toBe(
      false
    );
  });
});

describe("quote library filters", () => {
  test("rejects unverified or prohibited rights", () => {
    expect(
      isQuoteExposable(
        quote({
          id: "1",
          quoteTextKo: "괜찮아요",
          verificationStatus: "unverified",
        })
      )
    ).toBe(false);
    expect(
      isQuoteExposable(
        quote({
          id: "2",
          quoteTextKo: "괜찮아요",
          rightsStatus: "prohibited",
        })
      )
    ).toBe(false);
  });

  test("hard day filters overly positive quotes", () => {
    const safe = filterSafeQuotes(
      [
        quote({
          id: "a",
          quoteTextKo: "모든 것은 마음먹기에 달려 있다",
        }),
        quote({
          id: "b",
          quoteTextKo: "오늘 견딘 마음도 기록될 가치가 있어요",
          emotionalTone: ["인정", "동행"],
        }),
      ],
      { hardDay: true, moods: ["슬픔"] }
    );
    expect(safe.map((q) => q.id)).toEqual(["b"]);
  });

  test("selectBestQuote returns null when score too low", () => {
    const best = selectBestQuote(
      [
        quote({
          id: "x",
          quoteTextKo: " unrelated text about ships ",
          attributionConfidence: 0.2,
          themes: [],
        }),
      ],
      {
        moods: ["슬픔"],
        tags: [],
        hardDay: true,
        recentQuoteIds: ["x"],
        recentAuthors: [],
        primaryKeyword: "회복",
      }
    );
    expect(best).toBeNull();
  });
});

describe("today sentence templates", () => {
  test("template length stays within policy", () => {
    const entry = {
      id: "e",
      userId: "u",
      entryDate: "2026-07-25",
      userTimezone: "Asia/Seoul",
      content: "",
      overallSatisfaction: 3,
      happinessScore: 3,
      moodLabel: "지침",
      moodLabels: ["지침"],
      mainEventText: null,
      source: "new_diary",
      scores: [],
      tags: [],
      coreStates: null,
      domainScores: null,
      checkinVersion: 2,
      xpGranted: true,
      xpAwarded: 10,
      schemaVersion: 4,
      createdAt: "",
      updatedAt: "",
    } as JournalEntry;
    const s = buildTodaySentenceTemplate({
      b,
      entry,
      recentAOverall: 3,
      trend: { delta: null, direction: "unknown" },
    });
    expect(s.length).toBeGreaterThan(8);
    expect(s.length).toBeLessThanOrEqual(100);
  });

  test("pickTemplateSentence avoids recent", () => {
    const first = pickTemplateSentence("recovery");
    const second = pickTemplateSentence("recovery", [first]);
    expect(second).not.toBe(first);
  });
});

describe("overlap", () => {
  test("detects similar sentences", () => {
    expect(
      jaccardSimilarity("오늘 속도를 낮춰보세요", "오늘 속도를 조금 낮춰보세요")
    ).toBeGreaterThan(0.4);
    expect(
      isTooSimilar("오늘 속도를 낮춰보세요", ["오늘 속도를 조금 낮춰보세요"], 0.4)
    ).toBe(true);
  });
});
