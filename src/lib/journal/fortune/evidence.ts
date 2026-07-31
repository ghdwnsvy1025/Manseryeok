/**
 * 오늘의 운세 "근거" 요약 — UI 근거보기 패널에서 그대로 쓸 수 있는 형태.
 * 점수 자체(FortuneDomainResult)와 별개로, 어떤 신호를 얼마나 섞었는지를 설명한다.
 */
import type { DailyInsightContext } from "@/lib/journal/insight/types";
import {
  PERSONALIZATION_MATURITY_LEVEL,
  type BlendWeights,
  type DataMaturityTier,
} from "@/lib/journal/insight/dynamicWeights";
import {
  resolveGatedBlend,
  type PillarInfluence,
  type RecordDayPhase,
} from "@/lib/journal/insight/recordReflectGate";
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
  /** 신호 혼합 비율 (합 = 1) — 일수 게이트 적용 후 */
  weights: {
    recent: number;
    keyword: number;
    natal: number;
  };
  dayPhase: RecordDayPhase;
  dayPhaseLabel: string;
  journalShareCap: number;
  guideKo: string;
  pillarInfluence: PillarInfluence;
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
  const gated = resolveGatedBlend({
    totalXp,
    onboardingCompleted: opts.onboardingCompleted,
    priorUniqueDays,
    weights: opts.weights,
  });
  const level = progressFromTotalXp(totalXp).level;

  const natalDay: NatalDayInsight | null = insight.natalDay ?? null;

  return {
    effectiveXp: gated.effectiveXp,
    maturityTargetXp: gated.maturityTargetXp,
    priorUniqueDays,
    level,
    maturityLevel: PERSONALIZATION_MATURITY_LEVEL,
    onboardingCompleted: Boolean(opts.onboardingCompleted),
    maturity: gated.maturity,
    tier: gated.tier,
    tierLabel: TIER_LABEL[gated.tier],
    weights: {
      recent: gated.recent,
      keyword: gated.keyword,
      natal: gated.natal,
    },
    dayPhase: gated.dayPhase,
    dayPhaseLabel: gated.dayPhaseLabel,
    journalShareCap: gated.journalShareCap,
    guideKo: gated.guideKo,
    pillarInfluence: gated.pillarInfluence,
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
          domains: (
            ["work", "relationships", "love", "money", "health"] as const
          )
            .map((d) => {
              const s = natalDay.byDomain?.[d];
              if (!s) return null;
              return {
                domain: d,
                tensionKind: s.tensionKind,
                tensionPlain: s.tensionPlain,
                keywordLabels: s.keywordLabels,
                natalPlain: s.natalPlain,
                todayPlain: s.todayPlain,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x != null),
        }
      : null,
    version: gated.version,
  };
}
