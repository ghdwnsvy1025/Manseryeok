import { describe, expect, test } from "@jest/globals";
import {
  happinessRatingToScore,
  normalizeHappinessRating,
  scaleLegacyFivePointToTen,
  scoreToHappinessRating,
} from "@/lib/diary/happiness";

describe("happinessRatingToScore / scoreToHappinessRating", () => {
  test("1–10 → 0–100 변환", () => {
    expect(happinessRatingToScore(1)).toBe(0);
    expect(happinessRatingToScore(6)).toBe(56); // round(((6-1)/9)*100) = 55.55 → 56
    expect(happinessRatingToScore(10)).toBe(100);
  });

  test("0·50·100 역산", () => {
    expect(scoreToHappinessRating(0)).toBe(1);
    expect(scoreToHappinessRating(50)).toBe(6);
    expect(scoreToHappinessRating(100)).toBe(10);
  });

  test("왕복 변환이 안정적", () => {
    for (const rating of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
      expect(scoreToHappinessRating(happinessRatingToScore(rating))).toBe(rating);
    }
  });

  test("normalizeHappinessRating은 1–10와 0–100을 모두 처리", () => {
    expect(normalizeHappinessRating(8)).toBe(8);
    expect(normalizeHappinessRating(100)).toBe(10);
    expect(normalizeHappinessRating("x")).toBe(6);
  });

  test("legacy 1–5 → 1–10 스케일", () => {
    expect(scaleLegacyFivePointToTen(1)).toBe(1);
    expect(scaleLegacyFivePointToTen(3)).toBe(6);
    expect(scaleLegacyFivePointToTen(5)).toBe(10);
  });
});
