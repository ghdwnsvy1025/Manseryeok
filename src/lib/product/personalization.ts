/**
 * 개인화 단계 — "정확도" 표현 사용 금지
 * ForecastMaturity(base/early/personal/flow)와 정렬
 */
export type PersonalizationLevel =
  | "base"
  | "early_signal"
  | "personal_pattern"
  | "my_flow";

export const PERSONALIZATION_THRESHOLDS = {
  baseMax: 6,
  earlyMax: 19,
  personalMax: 49,
} as const;

export function resolvePersonalizationLevel(
  recordCount: number
): PersonalizationLevel {
  if (recordCount <= PERSONALIZATION_THRESHOLDS.baseMax) return "base";
  if (recordCount <= PERSONALIZATION_THRESHOLDS.earlyMax) return "early_signal";
  if (recordCount <= PERSONALIZATION_THRESHOLDS.personalMax)
    return "personal_pattern";
  return "my_flow";
}

export const PERSONALIZATION_LABELS: Record<PersonalizationLevel, string> = {
  base: "기본 해석",
  early_signal: "초기 신호",
  personal_pattern: "개인 패턴",
  my_flow: "나의 흐름",
};

export const PERSONALIZATION_SUMMARIES: Record<PersonalizationLevel, string> = {
  base: "아직 개인 기록이 적어 기본적인 사주 흐름을 중심으로 보여드려요.",
  early_signal: "일부 반복되는 신호가 보이기 시작했어요.",
  personal_pattern: "비슷한 흐름에서 반복된 개인 패턴을 반영하고 있어요.",
  my_flow: "장기 기록과 최근 상태를 함께 비교할 수 있어요.",
};

export function nextLevelRemaining(recordCount: number): {
  next: PersonalizationLevel | null;
  remaining: number;
  hint: string;
} {
  if (recordCount <= PERSONALIZATION_THRESHOLDS.baseMax) {
    return {
      next: "early_signal",
      remaining: PERSONALIZATION_THRESHOLDS.baseMax + 1 - recordCount,
      hint: "기록이 더 쌓이면 반복되는 신호를 비교할 수 있어요.",
    };
  }
  if (recordCount <= PERSONALIZATION_THRESHOLDS.earlyMax) {
    return {
      next: "personal_pattern",
      remaining: PERSONALIZATION_THRESHOLDS.earlyMax + 1 - recordCount,
      hint: "기록이 더 쌓이면 십신·간지별 감정 차이를 볼 수 있어요.",
    };
  }
  if (recordCount <= PERSONALIZATION_THRESHOLDS.personalMax) {
    return {
      next: "my_flow",
      remaining: PERSONALIZATION_THRESHOLDS.personalMax + 1 - recordCount,
      hint: "기록이 더 쌓이면 장기 흐름을 더 세밀하게 비교할 수 있어요.",
    };
  }
  return { next: null, remaining: 0, hint: "장기 기록으로 나의 흐름을 보고 있어요." };
}

export function maturityToPersonalization(
  maturity: "base" | "early" | "personal" | "flow"
): PersonalizationLevel {
  switch (maturity) {
    case "base":
      return "base";
    case "early":
      return "early_signal";
    case "personal":
      return "personal_pattern";
    case "flow":
      return "my_flow";
  }
}
