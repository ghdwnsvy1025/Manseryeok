/**
 * 체크인 v2 행복도: 0~10
 * (레거시 overallSatisfaction은 1~10)
 */

export type HappinessScore = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const HAPPINESS_MIN = 0;
export const HAPPINESS_MAX = 10;
export const HAPPINESS_DEFAULT_HINT = 5;

export const HAPPINESS_VALUES: HappinessScore[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

export const HAPPINESS_LABELS: Record<HappinessScore, string> = {
  0: "매우 힘들었어요",
  1: "최악",
  2: "매우 힘듦",
  3: "힘듦",
  4: "조금 힘듦",
  5: "보통이었어요",
  6: "보통↑",
  7: "괜찮음",
  8: "좋음",
  9: "매우 좋음",
  10: "매우 좋았어요",
};

/** 슬라이더에 항상 표시하는 앵커 (선택값으로 대체 금지) */
export const HAPPINESS_ANCHORS: Array<{
  value: HappinessScore;
  label: string;
}> = [
  { value: 0, label: "매우 힘들었어요" },
  { value: 5, label: "보통이었어요" },
  { value: 10, label: "매우 좋았어요" },
];

export function isHappinessScore(value: unknown): value is HappinessScore {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= HAPPINESS_MIN &&
    value <= HAPPINESS_MAX
  );
}

export function clampHappinessScore(value: number): HappinessScore {
  return Math.max(
    HAPPINESS_MIN,
    Math.min(HAPPINESS_MAX, Math.round(value))
  ) as HappinessScore;
}

/** 레거시 overallSatisfaction(1~10) 호환 — 0은 1로 */
export function happinessToLegacyOverall(
  value: HappinessScore
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  if (value === 0) return 1;
  return value;
}
