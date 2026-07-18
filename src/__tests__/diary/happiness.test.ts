import { describe, expect, test } from "@jest/globals";
import {
  happinessRatingToScore,
  normalizeHappinessRating,
  scoreToHappinessRating,
} from "@/lib/diary/happiness";

describe("happinessRatingToScore / scoreToHappinessRating", () => {
  test("1–5 → 0–100 변환", () => {
    expect(happinessRatingToScore(1)).toBe(0);
    expect(happinessRatingToScore(2)).toBe(25);
    expect(happinessRatingToScore(3)).toBe(50);
    expect(happinessRatingToScore(4)).toBe(75);
    expect(happinessRatingToScore(5)).toBe(100);
  });

  test("0·50·100 및 경계값 역산", () => {
    expect(scoreToHappinessRating(0)).toBe(1);
    expect(scoreToHappinessRating(12)).toBe(1);
    expect(scoreToHappinessRating(13)).toBe(2);
    expect(scoreToHappinessRating(50)).toBe(3);
    expect(scoreToHappinessRating(100)).toBe(5);
    expect(scoreToHappinessRating(88)).toBe(5);
  });

  test("왕복 변환이 안정적", () => {
    for (const rating of [1, 2, 3, 4, 5] as const) {
      expect(scoreToHappinessRating(happinessRatingToScore(rating))).toBe(rating);
    }
  });

  test("normalizeHappinessRating은 1–5와 0–100을 모두 처리", () => {
    expect(normalizeHappinessRating(4)).toBe(4);
    expect(normalizeHappinessRating(100)).toBe(5);
    expect(normalizeHappinessRating("x")).toBe(3);
  });
});
