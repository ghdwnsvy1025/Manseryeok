import {
  MAX_ENABLED_CATEGORIES,
  MIN_ENABLED_CATEGORIES,
  type CategoryCode,
  type CategoryScoreRecord,
} from "./types";
import { isCategoryCode } from "./categoryCatalog";
import { isKnownTagCode } from "./eventTagCatalog";

export function assertValidRawScore(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
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
  rawScore: number | null;
  isNotApplicable: boolean;
}): { ok: boolean; error?: string } {
  if (!isCategoryCode(input.categoryCode)) {
    return { ok: false, error: "알 수 없는 카테고리입니다." };
  }
  if (input.isNotApplicable) {
    if (input.rawScore != null) {
      return { ok: false, error: "해당 없음은 점수와 함께 저장할 수 없습니다." };
    }
    return { ok: true };
  }
  if (input.rawScore == null) {
    return { ok: true }; // unset — skip persist or omit
  }
  if (!assertValidRawScore(input.rawScore)) {
    return { ok: false, error: "점수는 1~5만 허용됩니다." };
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

/** 통계용: 해당 없음·미입력 제외한 rawScore만 */
export function validScoresForStats(
  scores: CategoryScoreRecord[]
): Array<1 | 2 | 3 | 4 | 5> {
  return scores
    .filter((s) => !s.isNotApplicable && s.rawScore != null)
    .map((s) => s.rawScore as 1 | 2 | 3 | 4 | 5);
}

export function averageValidScores(scores: CategoryScoreRecord[]): number | null {
  const vals = validScoresForStats(scores);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
