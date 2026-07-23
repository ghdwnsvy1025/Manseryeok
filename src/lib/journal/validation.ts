import {
  MAX_ENABLED_CATEGORIES,
  MIN_ENABLED_CATEGORIES,
  type CategoryCode,
  type CategoryScoreRecord,
} from "./types";
import { isCategoryCode } from "./categoryCatalog";
import { isKnownTagCode } from "./eventTagCatalog";
import { isValidUserScore } from "./finalScore";
import type { JournalScore } from "./scoreScale";

export function assertValidRawScore(value: unknown): value is JournalScore {
  return isValidUserScore(value);
}

export function validateEnabledCategorySelection(codes: CategoryCode[]): {
  ok: boolean;
  error?: string;
} {
  const unique = Array.from(new Set(codes));
  if (unique.length !== codes.length) {
    return { ok: false, error: "중복된 카테고리가 있습니다." };
  }
  for (const code of unique) {
    if (!isCategoryCode(code)) {
      return { ok: false, error: `알 수 없는 카테고리: ${code}` };
    }
  }
  if (unique.length < MIN_ENABLED_CATEGORIES) {
    return {
      ok: false,
      error: `최소 ${MIN_ENABLED_CATEGORIES}개 카테고리를 선택해주세요.`,
    };
  }
  if (unique.length > MAX_ENABLED_CATEGORIES) {
    return {
      ok: false,
      error: `최대 ${MAX_ENABLED_CATEGORIES}개까지 선택할 수 있어요.`,
    };
  }
  return { ok: true };
}

export function validateScorePayload(input: {
  categoryCode: string;
  rawScore?: number | null;
  userScore?: number | null;
  isNotApplicable: boolean;
}): { ok: boolean; error?: string } {
  if (!isCategoryCode(input.categoryCode)) {
    return { ok: false, error: "알 수 없는 카테고리입니다." };
  }
  const userScore =
    input.userScore !== undefined ? input.userScore : input.rawScore ?? null;

  if (input.isNotApplicable) {
    if (userScore != null) {
      return { ok: false, error: "해당 없음은 점수와 함께 저장할 수 없습니다." };
    }
    return { ok: true };
  }
  if (userScore == null) {
    // 단건 검증에서는 unset 허용 — 저장 시 validateSaveScores에서 거부(1A)
    return { ok: true };
  }
  if (!isValidUserScore(userScore)) {
    return { ok: false, error: "점수는 1~10만 허용됩니다." };
  }
  return { ok: true };
}

/**
 * 저장 직전 일괄 검증 (1A).
 * - 활성 카테고리만
 * - 중복 없음
 * - 미입력 거부 (1~10 또는 해당 없음 필수)
 */
export function validateSaveScores(input: {
  enabledCodes: CategoryCode[];
  scores: Array<{
    categoryCode: string;
    userScore?: number | null;
    rawScore?: number | null;
    isNotApplicable: boolean;
  }>;
}): { ok: boolean; error?: string } {
  const enabledCheck = validateEnabledCategorySelection(input.enabledCodes);
  if (!enabledCheck.ok) return enabledCheck;

  const enabledSet = new Set(input.enabledCodes);
  const codes = input.scores.map((s) => s.categoryCode);

  if (new Set(codes).size !== codes.length) {
    return { ok: false, error: "중복된 카테고리 점수가 있습니다." };
  }

  for (const row of input.scores) {
    if (!enabledSet.has(row.categoryCode as CategoryCode)) {
      return {
        ok: false,
        error: `비활성 카테고리는 저장할 수 없습니다: ${row.categoryCode}`,
      };
    }
    const check = validateScorePayload(row);
    if (!check.ok) return check;

    const userScore =
      row.userScore !== undefined ? row.userScore : row.rawScore ?? null;
    if (!row.isNotApplicable && userScore == null) {
      return {
        ok: false,
        error: "모든 활성 카테고리에 점수 또는 「해당 없음」을 입력해주세요.",
      };
    }
  }

  for (const code of input.enabledCodes) {
    if (!codes.includes(code)) {
      return {
        ok: false,
        error: "모든 활성 카테고리에 점수 또는 「해당 없음」을 입력해주세요.",
      };
    }
  }

  return { ok: true };
}

export function validateTagCodes(tagCodes: string[]): { ok: boolean; error?: string } {
  for (const code of tagCodes) {
    if (!isKnownTagCode(code)) {
      return { ok: false, error: `알 수 없는 태그: ${code}` };
    }
  }
  if (new Set(tagCodes).size !== tagCodes.length) {
    return { ok: false, error: "중복 태그가 있습니다." };
  }
  return { ok: true };
}

/** 통계용: 해당 없음·미입력 제외한 finalScore (없으면 userScore) */
export function validScoresForStats(scores: CategoryScoreRecord[]): number[] {
  return scores
    .filter((s) => !s.isNotApplicable)
    .map((s) => (s.finalScore != null ? s.finalScore : s.userScore))
    .filter((v): v is number => v != null);
}

export function averageValidScores(scores: CategoryScoreRecord[]): number | null {
  const vals = validScoresForStats(scores);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
