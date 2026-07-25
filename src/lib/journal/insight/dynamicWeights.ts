/**
 * 데이터량 기반 동적 가중치
 * — 기록이 없을 때는 사주 prior 비중이 크고, 개인 기록이 쌓일수록
 *   최근 상태(개인 데이터) 비중이 커진다.
 * — 온보딩 6문항을 완료하면 콜드스타트에서 개인 신호를 일부 확보한 것으로 보고
 *   유효 데이터일수에 보너스를 준다.
 */

export const BLEND_WEIGHT_VERSION = "blend-weights-v1.0.0";

/** 성숙도 상한 — 이 일수 이상이면 개인 데이터 비중이 최대 */
export const MATURITY_DAYS = 60;
/** 온보딩 완료 시 인정하는 유효 데이터일수 보너스 */
export const ONBOARDING_DAY_BONUS = 7;

export type DataMaturityTier = "cold" | "warming" | "warm" | "mature";

export type BlendWeights = {
  /** 최근 상태(개인 기록) */
  recent: number;
  /** 키워드 랭킹 */
  keyword: number;
  /** 사주 prior */
  natal: number;
  /** 0~1 성숙도 */
  maturity: number;
  tier: DataMaturityTier;
  effectiveDays: number;
  version: string;
};

const COLD = { recent: 0.25, keyword: 0.3, natal: 0.45 } as const;
const MATURE = { recent: 0.65, keyword: 0.25, natal: 0.1 } as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function dataMaturityTier(effectiveDays: number): DataMaturityTier {
  if (effectiveDays < 7) return "cold";
  if (effectiveDays < 30) return "warming";
  if (effectiveDays < MATURITY_DAYS) return "warm";
  return "mature";
}

export function computeBlendWeights(opts: {
  priorUniqueDays: number;
  onboardingCompleted?: boolean;
}): BlendWeights {
  const base = Math.max(0, Math.floor(opts.priorUniqueDays || 0));
  const effectiveDays =
    base + (opts.onboardingCompleted ? ONBOARDING_DAY_BONUS : 0);
  const t = clamp01(effectiveDays / MATURITY_DAYS);

  const recent = round3(COLD.recent + (MATURE.recent - COLD.recent) * t);
  const keyword = round3(COLD.keyword + (MATURE.keyword - COLD.keyword) * t);
  // 합이 정확히 1이 되도록 natal은 잔여로 계산
  const natal = round3(1 - recent - keyword);

  return {
    recent,
    keyword,
    natal,
    maturity: round3(t),
    tier: dataMaturityTier(effectiveDays),
    effectiveDays,
    version: BLEND_WEIGHT_VERSION,
  };
}
