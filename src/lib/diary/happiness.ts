import { clampScore } from "./dimensions";

/** 사용자 입력 행복도 (1–10) */
export type HappinessRating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const HAPPINESS_RATING_LABELS: Record<HappinessRating, string> = {
  1: "최악",
  2: "매우 힘듦",
  3: "힘듦",
  4: "조금 힘듦",
  5: "보통↓",
  6: "보통",
  7: "괜찮음",
  8: "좋음",
  9: "매우 좋음",
  10: "최고",
};

export const DEFAULT_HAPPINESS_RATING: HappinessRating = 6;

export function isHappinessRating(value: unknown): value is HappinessRating {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 10
  );
}

/** 구버전 1–5 → 1–10 (1→1, 3→6, 5→10) */
export function scaleLegacyFivePointToTen(value: number): HappinessRating {
  const scaled = Math.round(1 + ((value - 1) * 9) / 4);
  return Math.max(1, Math.min(10, scaled)) as HappinessRating;
}

/** 1–10 → 0–100 (분석·통계 원본과 호환) */
export function happinessRatingToScore(rating: HappinessRating): number {
  return clampScore(((rating - 1) / 9) * 100);
}

/**
 * 0–100 → 1–10
 * 10등분 근사 (각 약 10점 폭)
 */
export function scoreToHappinessRating(score: number): HappinessRating {
  const s = clampScore(score);
  const rating = Math.round(1 + (s / 100) * 9);
  return Math.max(1, Math.min(10, rating)) as HappinessRating;
}

export function normalizeHappinessRating(
  value: unknown,
  fallback: HappinessRating = DEFAULT_HAPPINESS_RATING
): HappinessRating {
  if (isHappinessRating(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1 && value <= 10) {
      return Math.round(value) as HappinessRating;
    }
    if (value >= 0 && value <= 100) {
      return scoreToHappinessRating(value);
    }
  }
  return fallback;
}
