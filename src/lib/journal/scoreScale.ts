/**
 * Journal A 점수 척도: 1~10
 * 구버전 1~5 → scaleLegacyFivePointToTen
 */
import { scaleLegacyFivePointToTen } from "@/lib/diary/happiness";

export type JournalScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const JOURNAL_SCORE_MIN = 1;
export const JOURNAL_SCORE_MAX = 10;
export const JOURNAL_SCORE_DEFAULT_HINT = 5;
/** 통계·정규화 중립점 (1~10 중앙) */
export const JOURNAL_SCORE_CENTER = 5.5;

/** schemaVersion 3부터 1~10 저장 */
export const JOURNAL_SCORE_TEN_SCHEMA = 3;

export const JOURNAL_SCORE_VALUES: JournalScore[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

export const JOURNAL_SCORE_LABELS: Record<JournalScore, string> = {
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

/** 1~10 밴드 (구 1~5의 2.2 / 3.2 / 4.0 대응) */
export function scoreBandLabel(score: number | null): string {
  if (score == null) return "알 수 없음";
  if (score <= 4.4) return "낮음";
  if (score <= 6.4) return "보통 이하";
  if (score <= 8.0) return "보통 이상";
  return "높음";
}

export function isLowJournalScore(score: number): boolean {
  return score <= 5;
}

export function isHighJournalScore(score: number): boolean {
  return score >= 8;
}

export function isJournalScore(value: unknown): value is JournalScore {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= JOURNAL_SCORE_MIN &&
    value <= JOURNAL_SCORE_MAX
  );
}

export function clampJournalScore(value: number): JournalScore {
  return Math.max(
    JOURNAL_SCORE_MIN,
    Math.min(JOURNAL_SCORE_MAX, Math.round(value))
  ) as JournalScore;
}

/** 구 1~5 값을 1~10으로 (이미 6~10이면 그대로) */
export function migrateScoreToTen(
  value: number | null | undefined,
  schemaVersion: number
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (schemaVersion >= JOURNAL_SCORE_TEN_SCHEMA) {
    return isJournalScore(value) ? value : clampJournalScore(value);
  }
  if (value >= 1 && value <= 5) {
    return scaleLegacyFivePointToTen(value);
  }
  return clampJournalScore(value);
}

export { scaleLegacyFivePointToTen };
