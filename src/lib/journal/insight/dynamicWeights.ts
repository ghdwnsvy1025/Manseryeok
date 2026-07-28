/**
 * XP(레벨) 기반 동적 가중치
 * — 기록이 없을 때는 사주 prior 비중이 크고, XP가 쌓일수록
 *   최근 상태(개인 데이터) 비중이 커진다.
 * — 맞춤도(maturity)는 Lv5 누적 XP에서 100%로 포화.
 *   Lv6~10은 습관·성취용이며 운세 비중은 더 이상 변하지 않는다.
 * — 온보딩 완료 시 약 7일분 XP 보너스를 준다.
 */
import {
  cumulativeXpForLevel,
  XP_PER_DAY_TARGET,
} from "@/lib/product/personalizationLevel";

export const BLEND_WEIGHT_VERSION = "blend-weights-v2.0.0-xp";

/** 맞춤도 100%에 도달하는 레벨 (이 이상 XP는 비중 불변) */
export const PERSONALIZATION_MATURITY_LEVEL = 5;
/** 온보딩 완료 시 인정하는 XP 보너스 ≈ 7일 × 하루 목표 XP */
export const ONBOARDING_XP_BONUS = XP_PER_DAY_TARGET * 7;

export type DataMaturityTier = "cold" | "warming" | "warm" | "mature";

export type BlendWeights = {
  /** 최근 상태(개인 기록) */
  recent: number;
  /** 키워드 랭킹 */
  keyword: number;
  /** 사주 prior */
  natal: number;
  /** 0~1 성숙도 (맞춤도) */
  maturity: number;
  tier: DataMaturityTier;
  /** 온보딩 보너스 포함 유효 XP */
  effectiveXp: number;
  /** 맞춤도 100%에 필요한 XP */
  maturityTargetXp: number;
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

export function maturityTargetXp(): number {
  return cumulativeXpForLevel(PERSONALIZATION_MATURITY_LEVEL);
}

/** maturity 0~1 → 단계 */
export function dataMaturityTier(maturity: number): DataMaturityTier {
  const t = clamp01(maturity);
  if (t < 0.12) return "cold";
  if (t < 0.4) return "warming";
  if (t < 1) return "warm";
  return "mature";
}

export function computeBlendWeights(opts: {
  totalXp: number;
  onboardingCompleted?: boolean;
}): BlendWeights {
  const raw =
    typeof opts.totalXp === "number" && Number.isFinite(opts.totalXp)
      ? Math.max(0, Math.floor(opts.totalXp))
      : 0;
  const effectiveXp = raw + (opts.onboardingCompleted ? ONBOARDING_XP_BONUS : 0);
  const target = maturityTargetXp();
  const t = clamp01(target > 0 ? effectiveXp / target : 1);

  const recent = round3(COLD.recent + (MATURE.recent - COLD.recent) * t);
  const keyword = round3(COLD.keyword + (MATURE.keyword - COLD.keyword) * t);
  const natal = round3(1 - recent - keyword);

  return {
    recent,
    keyword,
    natal,
    maturity: round3(t),
    tier: dataMaturityTier(t),
    effectiveXp,
    maturityTargetXp: target,
    version: BLEND_WEIGHT_VERSION,
  };
}
