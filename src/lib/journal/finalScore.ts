/**
 * 사용자 점수 + AI 추출 → 최종 A
 * - 해당 없음(isNotApplicable): final = null (AI 있어도 덮어쓰지 않음)
 * - 둘 다 유효: 평균 (소수점 유지)
 * - 한쪽만: 그 값
 * - 둘 다 없음: null
 */
import {
  isJournalScore,
  JOURNAL_SCORE_MAX,
  JOURNAL_SCORE_MIN,
  type JournalScore,
} from "@/lib/journal/scoreScale";

export type ScoreParts = {
  userScore: number | null;
  aiScore: number | null;
  isNotApplicable: boolean;
};

export function isValidUserScore(value: unknown): value is JournalScore {
  return isJournalScore(value);
}

/** AI 점수는 1~10 정수만 통계에 사용 (null = 근거 부족) */
export function isValidAiScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= JOURNAL_SCORE_MIN &&
    value <= JOURNAL_SCORE_MAX
  );
}

export function computeFinalScore(parts: ScoreParts): number | null {
  if (parts.isNotApplicable) return null;

  const userOk = isValidUserScore(parts.userScore);
  const aiOk = isValidAiScore(parts.aiScore);

  if (userOk && aiOk) {
    return (parts.userScore! + parts.aiScore!) / 2;
  }
  if (userOk) return parts.userScore;
  if (aiOk) return parts.aiScore;
  return null;
}

/** 화면 표시용 — 소수점 첫째 자리 */
export function formatFinalScore(score: number | null): string {
  if (score == null) return "-";
  return (Math.round(score * 10) / 10).toFixed(1).replace(/\.0$/, "");
}
