/**
 * 오늘의 운세 "근거" 요약 — UI 근거보기 패널에서 그대로 쓸 수 있는 형태.
 * 점수 자체(FortuneDomainResult)와 별개로, 어떤 신호를 얼마나 섞었는지를 설명한다.
 */
import type { DailyInsightContext } from "@/lib/journal/insight/types";
import {
  computeBlendWeights,
  PERSONALIZATION_MATURITY_LEVEL,
  type BlendWeights,
  type DataMaturityTier,
} from "@/lib/journal/insight/dynamicWeights";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { progressFromTotalXp } from "@/lib/product/personalizationLevel";

export type FortuneEvidenceKeyword = {
  code: string;
  plainLabel: string;
  /** 상대 강도(내부 누적 점수) */
  score: number;
};

export type FortuneEvidenceDomain = {
  domain: string;
  tensionKind: string;
  tensionPlain: string;
  keywordLabels: string[];
  natalPlain: string[];
  todayPlain: string[];
};

export type FortuneEvidence = {
  /** 유효 XP = 누적 XP(+온보딩 보너스) */
  effectiveXp: number;
  /** 맞춤도 100% XP */
  maturityTargetXp: number;
  /** 순수 기록 일수 (참고) */
  priorUniqueDays: number;
  /** 현재 Lv (XP 기준) */
  level: number;
  /** 맞춤도 포화 레벨 */
  maturityLevel: number;
  onboardingCompleted: boolean;
  /** 0~1 성숙도 */
  maturity: number;
  tier: DataMaturityTier;
  tierLabel: string;
  /** 신호 혼합 비율 (합 = 1) */
  weights: {
    recent: number;
    keyword: number;
    natal: number;
  };
  overallConfidence: number;
  primaryKeyword: string | null;
  tensionKeyword: string | null;
  topKeywords: FortuneEvidenceKeyword[];
  /** 원국×일진 (있을 때) */
  natalDay: {
    ganjiKo: string;
    overallTraitPlain: string;
    todayStemGod: string | null;
    relationLabels: string[];
    domains: FortuneEvidenceDomain[];
  } | null;
  version: string;
};

const TIER_LABEL: Record<DataMaturityTier, string> = {
  cold: "시작 단계",
  warming: "데이터 모으는 중",
  warm: "안정화 중",
  mature: "성숙 단계",
};

export function buildFortuneEvidence(
  insight: Pick<
    DailyInsightContext,
    | "priorUniqueDays"
    | "overallConfidence"
    | "primaryKeyword"
    | "tensionKeyword"
    | "topKeywords"
    | "natalDay"
  >,
  opts: {
    onboardingCompleted?: boolean;
    totalXp?: number;
    weights?: BlendWeights;
  } = {}
): FortuneEvidence {
  const priorUniqueDays = Math.max(0, Math.floor(insight.priorUniqueDays || 0));
  const totalXp = Math.max(0, Math.floor(opts.totalXp || 0));
  const w =
    opts.weights ??
    computeBlendWeights({
      totalXp,
      onboardingCompleted: opts.onboardingCompleted,
    });
  const level = progressFromTotalXp(totalXp).level;

  const natalDay: NatalDayInsight | null = insight.natalDay ?? null;

  return {
    effectiveXp: w.effectiveXp,
    maturityTargetXp: w.maturityTargetXp,
    priorUniqueDays,
    level,
    maturityLevel: PERSONALIZATION_MATURITY_LEVEL,
    onboardingCompleted: Boolean(opts.onboardingCompleted),
    maturity: w.maturity,
    tier: w.tier,
    tierLabel: TIER_LABEL[w.tier],
    weights: {
      recent: w.recent,
      keyword: w.keyword,
      natal: w.natal,
    },
    overallConfidence: Math.round((insight.overallConfidence ?? 0) * 100) / 100,
    primaryKeyword: insight.primaryKeyword ?? null,
    tensionKeyword: insight.tensionKeyword ?? null,
    topKeywords: (insight.topKeywords ?? []).slice(0, 5).map((k) => ({
      code: k.code,
      plainLabel: k.plainLabel,
      score: Math.round(k.score * 100) / 100,
    })),
    natalDay: natalDay
      ? {
          ganjiKo: natalDay.ganjiKo,
          overallTraitPlain: natalDay.overallTraitPlain,
          todayStemGod: natalDay.todayStemGod,
          relationLabels: natalDay.relationLabels,
          domains: (["work", "relationship", "finance", "health"] as const).map(
            (d) => {
              const s = natalDay.byDomain[d];
              return {
                domain: d,
                tensionKind: s.tensionKind,
                tensionPlain: s.tensionPlain,
                keywordLabels: s.keywordLabels,
                natalPlain: s.natalPlain,
                todayPlain: s.todayPlain,
              };
            }
          ),
        }
      : null,
    version: w.version,
  };
}
