import { clampScore } from "./dimensions";

/** 사용자 입력 행복도 (1–5) */
export type HappinessRating = 1 | 2 | 3 | 4 | 5;

export const HAPPINESS_RATING_LABELS: Record<HappinessRating, string> = {
  1: "매우 힘듦",
  2: "힘듦",
  3: "보통",
  4: "좋음",
  5: "매우 좋음",
};

export const DEFAULT_HAPPINESS_RATING: HappinessRating = 3;

export function isHappinessRating(value: unknown): value is HappinessRating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** 1–5 → 0–100 (분석·통계 원본과 호환) */
export function happinessRatingToScore(rating: HappinessRating): number {
  return clampScore((rating - 1) * 25);
}

/**
 * 0–100 → 1–5
 * 경계: 0–12→1, 13–37→2, 38–62→3, 63–87→4, 88–100→5
 */
export function scoreToHappinessRating(score: number): HappinessRating {
  const s = clampScore(score);
  if (s <= 12) return 1;
  if (s <= 37) return 2;
  if (s <= 62) return 3;
  if (s <= 87) return 4;
  return 5;
}

export function normalizeHappinessRating(
  value: unknown,
  fallback: HappinessRating = DEFAULT_HAPPINESS_RATING
): HappinessRating {
  if (isHappinessRating(value)) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1 && value <= 5) {
      return Math.round(value) as HappinessRating;
    }
    if (value >= 0 && value <= 100) {
      return scoreToHappinessRating(value);
    }
  }
  return fallback;
}
