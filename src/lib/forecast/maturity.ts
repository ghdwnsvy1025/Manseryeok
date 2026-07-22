import type { ForecastMaturity } from "./types";

/** 총 실기록 수 기준 개인화 단계 (정확도라는 표현 사용 금지) */
export const MATURITY_THRESHOLDS = {
  baseMax: 6,
  earlyMax: 19,
  personalMax: 49,
} as const;

export function resolveMaturity(realEntryCount: number): ForecastMaturity {
  if (realEntryCount <= MATURITY_THRESHOLDS.baseMax) return "base";
  if (realEntryCount <= MATURITY_THRESHOLDS.earlyMax) return "early";
  if (realEntryCount <= MATURITY_THRESHOLDS.personalMax) return "personal";
  return "flow";
}

export const MATURITY_LABELS: Record<ForecastMaturity, string> = {
  base: "기본 예보 — 아직 개인 기록이 적어 전통 명리 해석을 중심으로 예보합니다.",
  early: "초기 신호 — 일부 반복되는 반응이 보이기 시작했습니다.",
  personal: "개인 패턴 — 비슷한 흐름에서 반복된 개인 패턴을 예보에 반영했습니다.",
  flow: "나의 흐름 — 장기 기록과 최근 상태를 함께 비교해 예보했습니다.",
};
