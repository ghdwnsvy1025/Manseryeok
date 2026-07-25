/**
 * 자유 일기 텍스트 alpha 융합
 *
 * 문제
 * - 지금은 사용자 점수와 AI 텍스트 추정 점수를 항상 50:50으로 평균한다.
 *   "오늘 피곤" 5글자로 뽑은 추정치와 500자 일기에서 뽑은 추정치가 같은 힘을 갖는다.
 *
 * 해결
 * - 텍스트 양·질과 모델 신뢰도로 alpha를 정하고 final = (1-α)·user + α·ai 로 융합한다.
 * - alpha는 MAX_TEXT_ALPHA를 넘지 않는다. 사용자가 직접 매긴 점수가
 *   텍스트 추론에 뒤집히면 안 된다.
 */
import { isValidAiScore, isValidUserScore } from "./finalScore";

export const TEXT_ALPHA_VERSION = "text-alpha-v1.0.0";

/** 이 글자 수 미만이면 텍스트 추정을 신뢰하지 않는다 */
export const MIN_TEXT_CHARS = 15;
/** 이 글자 수 이상이면 길이 요인이 최대 */
export const FULL_TEXT_CHARS = 250;
/** 사용자 점수가 있을 때 텍스트가 가질 수 있는 최대 비중 */
export const MAX_TEXT_ALPHA = 0.5;
/** 모델이 신뢰도를 주지 않았을 때의 기본값 */
export const DEFAULT_AI_CONFIDENCE = 0.5;
/** 문자 다양성이 이 값 미만이면 의미 없는 반복으로 간주 (예: "ㅋㅋㅋㅋㅋ") */
export const MIN_CHAR_DIVERSITY = 0.15;
/**
 * 다양성 포화 지점.
 * 고유문자/전체문자 비율을 그대로 쓰면 글이 길수록 알파벳 크기에 막혀
 * 비율이 떨어진다 — 잘 쓴 장문이 오히려 반복으로 오판된다.
 * 그래서 분모를 이 값으로 상한을 둬 길이 불변으로 만든다.
 */
export const DIVERSITY_SATURATION = 60;
/** 이 다양성 이상이면 다양성 요인이 최대 */
const FULL_DIVERSITY = 0.5;

export type TextQuality = {
  /** 공백 제거 후 글자 수 */
  effectiveLength: number;
  /** 고유 문자 비율 0~1 */
  diversity: number;
  /** 0~1 종합 품질 */
  quality: number;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function assessTextQuality(content: string | null | undefined): TextQuality {
  const raw = (content ?? "").trim();
  const compact = raw.replace(/\s+/g, "");
  const effectiveLength = compact.length;
  if (effectiveLength === 0) {
    return { effectiveLength: 0, diversity: 0, quality: 0 };
  }

  const distinctChars = new Set(compact).size;
  const diversity = clamp01(
    distinctChars / Math.min(effectiveLength, DIVERSITY_SATURATION)
  );

  const lengthFactor =
    effectiveLength < MIN_TEXT_CHARS
      ? 0
      : clamp01(
          (effectiveLength - MIN_TEXT_CHARS) /
            (FULL_TEXT_CHARS - MIN_TEXT_CHARS)
        );

  // 반복 문자열은 길어도 정보량이 없다
  const diversityFactor =
    diversity < MIN_CHAR_DIVERSITY ? 0 : clamp01(diversity / FULL_DIVERSITY);

  return {
    effectiveLength,
    diversity: round4(diversity),
    quality: round4(lengthFactor * diversityFactor),
  };
}

export type TextAlphaResult = {
  alpha: number;
  quality: TextQuality;
  aiConfidence: number;
  reason:
    | "no_ai_score"
    | "no_user_score"
    | "text_too_short"
    | "blended"
    | "not_applicable";
  version: string;
};

export function computeTextAlpha(input: {
  userScore: number | null;
  aiScore: number | null;
  aiConfidence?: number | null;
  content?: string | null;
  isNotApplicable?: boolean;
}): TextAlphaResult {
  const quality = assessTextQuality(input.content);
  const aiConfidence = clamp01(
    input.aiConfidence == null ? DEFAULT_AI_CONFIDENCE : input.aiConfidence
  );
  const base = { quality, aiConfidence, version: TEXT_ALPHA_VERSION };

  if (input.isNotApplicable) {
    return { ...base, alpha: 0, reason: "not_applicable" };
  }

  const userOk = isValidUserScore(input.userScore);
  const aiOk = isValidAiScore(input.aiScore);

  if (!aiOk) return { ...base, alpha: 0, reason: "no_ai_score" };
  // 사용자 점수가 없으면 텍스트 추정이 유일한 근거
  if (!userOk) return { ...base, alpha: 1, reason: "no_user_score" };
  if (quality.quality <= 0) {
    return { ...base, alpha: 0, reason: "text_too_short" };
  }

  return {
    ...base,
    alpha: round4(MAX_TEXT_ALPHA * quality.quality * aiConfidence),
    reason: "blended",
  };
}

export type FusedScore = {
  finalScore: number | null;
  alpha: number;
  reason: TextAlphaResult["reason"];
  quality: TextQuality;
};

/** final = (1-α)·user + α·ai */
export function fuseTextAndUserScore(input: {
  userScore: number | null;
  aiScore: number | null;
  aiConfidence?: number | null;
  content?: string | null;
  isNotApplicable?: boolean;
}): FusedScore {
  const a = computeTextAlpha(input);
  const shared = { alpha: a.alpha, reason: a.reason, quality: a.quality };

  if (input.isNotApplicable) return { ...shared, finalScore: null };

  const userOk = isValidUserScore(input.userScore);
  const aiOk = isValidAiScore(input.aiScore);

  if (!userOk && !aiOk) return { ...shared, finalScore: null };
  if (!aiOk) return { ...shared, finalScore: input.userScore };
  if (!userOk) return { ...shared, finalScore: input.aiScore };

  const fused =
    (1 - a.alpha) * (input.userScore as number) +
    a.alpha * (input.aiScore as number);
  return { ...shared, finalScore: Math.round(fused * 100) / 100 };
}
