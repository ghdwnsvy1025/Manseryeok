import { describe, expect, test } from "@jest/globals";
import { computeFinalScore } from "@/lib/journal/finalScore";
import { validateSaveScores } from "@/lib/journal/validation";
import { recomputeD1Aggregates } from "@/lib/journal/d1Aggregates";
import type { CategoryScoreRecord, JournalEntry } from "@/lib/journal/types";
import { DEFAULT_RECOMMENDED_CODES } from "@/lib/journal/categoryCatalog";

describe("computeFinalScore", () => {
  test("둘 다 있으면 평균", () => {
    expect(
      computeFinalScore({ userScore: 4, aiScore: 2, isNotApplicable: false })
    ).toBe(3);
    expect(
      computeFinalScore({ userScore: 4, aiScore: 3, isNotApplicable: false })
    ).toBe(3.5);
  });

  test("해당 없음이면 AI 있어도 null", () => {
    expect(
      computeFinalScore({ userScore: null, aiScore: 5, isNotApplicable: true })
    ).toBeNull();
  });

  test("한쪽만", () => {
    expect(
      computeFinalScore({ userScore: 4, aiScore: null, isNotApplicable: false })
    ).toBe(4);
    expect(
      computeFinalScore({ userScore: null, aiScore: 2, isNotApplicable: false })
    ).toBe(2);
  });
});

describe("validateSaveScores 1A", () => {
  test("미입력 거부", () => {
    const codes = DEFAULT_RECOMMENDED_CODES;
    const scores = codes.map((categoryCode, i) => ({
      categoryCode,
      userScore: (i === 0 ? null : 3) as import("@/lib/journal/types").JournalScore | null,
      isNotApplicable: false,
    }));
    expect(validateSaveScores({ enabledCodes: codes, scores }).ok).toBe(false);
  });

  test("전부 점수 또는 해당 없음이면 통과", () => {
    const codes = DEFAULT_RECOMMENDED_CODES;
    const scores = codes.map((categoryCode, i) =>
      i === 0
        ? { categoryCode, userScore: null, isNotApplicable: true }
        : { categoryCode, userScore: 3 as const, isNotApplicable: false }
    );
    expect(validateSaveScores({ enabledCodes: codes, scores }).ok).toBe(true);
  });
});

describe("D-1 recompute", () => {
  test("한 건부터 평균 표시", () => {
    const score = (code: "energy", final: number): CategoryScoreRecord => ({
      id: "1",
      entryId: "e1",
      userId: "u",
      categoryCode: code,
      userScore: 4,
      aiScore: null,
      finalScore: final,
      rawScore: 4,
      isNotApplicable: false,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: "",
      updatedAt: "",
    });
    const entry: JournalEntry = {
      id: "e1",
      userId: "u",
      entryDate: "2026-07-21",
      userTimezone: "Asia/Seoul",
      content: "",
      overallSatisfaction: 4,
      moodLabel: null,
      mainEventText: null,
      source: "new_diary",
      scores: [score("energy", 4)],
      tags: [],
      xpGranted: true,
      xpAwarded: 10,
      schemaVersion: 2,
      createdAt: "",
      updatedAt: "",
    };
    const agg = recomputeD1Aggregates([entry]);
    expect(agg.some((a) => a.categoryCode === "energy" && a.average === 4)).toBe(
      true
    );
    expect(agg.every((a) => a.validCount >= 1)).toBe(true);
  });
});
