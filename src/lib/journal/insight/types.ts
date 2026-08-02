/**
 * DailyInsightContext — 질문·운세 공통 (체크인 전, 어제까지 데이터만)
 */
import type { BTheme } from "@/lib/journal/bTheme";
import type { KeywordScore } from "@/lib/journal/keywords/rank";
import type { CategoryCode } from "@/lib/journal/types";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";

export const INSIGHT_ENGINE_VERSION = "insight-v1.2.0";

/** 개인화 오늘의 운세 영역 (Phase A: love는 relationships와 점수 공유·문장 분리) */
export type FortuneDomainCode =
  | "overall"
  | "work"
  | "relationships"
  | "love"
  | "money"
  | "health";

export type FortuneFlow = "최고" | "좋음" | "무난" | "아쉬움" | "주의";
export type FortuneConfidenceLabel = "높음" | "보통" | "낮음";
export type FortuneDataQuality = "충분" | "일부 누락" | "부족" | "축적 부족" | "없음";

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
  /** 내부 스코어 톤 (UI는 flow 우선) */
  tone: "supportive" | "balanced" | "caution";
  flow: FortuneFlow;
  score: number;
  confidence: number;
  confidenceLabel: FortuneConfidenceLabel;
  headline: string;
  /** 개인화 해석 본문 */
  interpretation: string;
  /**
   * DB·구 UI 호환 — interpretation과 동기화
   * @deprecated interpretation 사용
   */
  summary: string;
  /** DB 컬럼 호환 (UI에서는 사용하지 않을 수 있음) */
  opportunity: string;
  caution: string;
  action: string;
  reasonTags: string[];
  /**
   * @deprecated reasonTags 사용 — 키워드 코드
   */
  evidenceCodes: string[];
};

export type FortuneDataQualityBlock = {
  saju: FortuneDataQuality;
  diary: FortuneDataQuality;
  statistics: FortuneDataQuality;
};

export type FortunePresentationMeta = {
  date: string;
  timezone: string;
  todayGanji: string | null;
  dailyTheme: string;
  todayFocus: string;
  todayAvoid: string;
  luckyRoutine: string;
  /** 원국 특징 중 오늘 가장 울리는 한 줄 */
  signatureEcho: string | null;
  dataQuality: FortuneDataQualityBlock;
  notice: string;
};
