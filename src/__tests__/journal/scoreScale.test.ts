import { describe, expect, test } from "@jest/globals";
import {
  migrateScoreToTen,
  scaleLegacyFivePointToTen,
  JOURNAL_SCORE_TEN_SCHEMA,
} from "@/lib/journal/scoreScale";
import { isValidUserScore, isValidAiScore } from "@/lib/journal/finalScore";

describe("journal score 1~10", () => {
  test("legacy 1~5 → 1~10", () => {
    expect(scaleLegacyFivePointToTen(1)).toBe(1);
    expect(scaleLegacyFivePointToTen(3)).toBe(6);
    expect(scaleLegacyFivePointToTen(5)).toBe(10);
  });

  test("migrateScoreToTen respects schema", () => {
    expect(migrateScoreToTen(3, 2)).toBe(6);
    expect(migrateScoreToTen(3, JOURNAL_SCORE_TEN_SCHEMA)).toBe(3);
    expect(migrateScoreToTen(8, JOURNAL_SCORE_TEN_SCHEMA)).toBe(8);
  });

  test("validators accept 1~10", () => {
    expect(isValidUserScore(7)).toBe(true);
    expect(isValidUserScore(11)).toBe(false);
    expect(isValidAiScore(10)).toBe(true);
    expect(isValidAiScore(5.5)).toBe(false);
  });
});
