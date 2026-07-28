/**
 * DailyInsightContext — 질문·운세 공통 (체크인 전, 어제까지 데이터만)
 */
import type { BTheme } from "@/lib/journal/bTheme";
import type { KeywordScore } from "@/lib/journal/keywords/rank";
import type { CategoryCode } from "@/lib/journal/types";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";

export const INSIGHT_ENGINE_VERSION = "insight-v1.1.0";

export type FortuneDomainCode =
  | "overall"
  | "work"
  | "relationship"
  | "finance"
  | "health";

export type DailyInsightContext = {
  eventDate: string;
  timezone: string;
  dataCutoffAt: string;
  engineVersion: string;
  ganjiKo: string | null;
  bTheme: BTheme;
  recentState: {
    keywordScores: Array<{
      code: string;
      plainLabel: string;
      score: number;
    }>;
    contentScoreByCategory: Partial<
      Record<CategoryCode, number | null>
    >;
    recentAOverall: number | null;
    confidence: number;
  };
  natalPrior: {
    tenGod: string | null;
    keywords: string[];
    focusHints: string[];
    plainSummary: string;
    sajuWeight: number;
    confidence: number;
  };
  primaryKeyword: string | null;
  tensionKeyword: string | null;
  topKeywords: KeywordScore[];
  priorUniqueDays: number;
  feedbackBiasApplied: boolean;
  overallConfidence: number;
  /** 원국×오늘 일진 구조화 신호 (프로필 없으면 null) */
  natalDay: NatalDayInsight | null;
};

export type FortuneDomainResult = {
  domain: FortuneDomainCode;
  title: string;
  tone: "supportive" | "balanced" | "caution";
  score: number;
  confidence: number;
  headline: string;
  summary: string;
  opportunity: string;
  caution: string;
  action: string;
  evidenceCodes: string[];
};
