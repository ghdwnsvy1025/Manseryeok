import type { TenGod } from "@/lib/saju/hiddenStems";

export const FORECAST_RULE_VERSION = "forecast-local-v1";
export const FORECAST_MODEL_VERSION = "local-template-v1";

export type ForecastMaturity = "base" | "early" | "personal" | "flow";

export type ForecastGenerationMode = "local" | "ai_assisted";

export type MatchFeedbackLevel = "match" | "partial" | "mismatch" | "unknown";

export type ActionHelpfulness =
  | "helped"
  | "no_difference"
  | "not_done"
  | "not_applicable";

export type ForecastEvidence = {
  kind: "traditional" | "observed" | "recent" | "caution";
  text: string;
};

export type ForecastDomainBlock = {
  forecast: string;
  evidence: ForecastEvidence[];
  caveat: string;
};

export type TraditionalFacts = {
  targetDate: string;
  ganji: string;
  ganjiKo: string;
  heavenlyStem: string;
  heavenlyStemHanja: string;
  earthlyBranch: string;
  earthlyBranchHanja: string;
  tenGod: TenGod | null;
  relations: Array<{ kind: string; label: string; description: string }>;
  natalDayGanjiKo?: string | null;
};

export type SampleSizes = {
  ganji: number;
  tenGod: number;
  stem: number;
  branch: number;
};

export type DailyForecast = {
  id: string;
  userId?: string | null;
  targetDate: string;
  sourceEntryId: string | null;
  sourceEntryDate: string | null;
  sajuProfileId: string | null;
  traditionalFacts: TraditionalFacts;
  maturity: ForecastMaturity;
  sampleSizes: SampleSizes;
  recentStateSummary: string;
  todaySummary: string;
  innerSignal: {
    text: string;
    isHypothesis: true;
  };
  neededCondition: {
    text: string;
    evidence: string[];
  };
  emotionForecast: ForecastDomainBlock;
  focusForecast: ForecastDomainBlock;
  conditionForecast: ForecastDomainBlock;
  oneAction: {
    action: string;
    reason: string;
  };
  reflectionSentence: string;
  disclaimer: string;
  generationMode: ForecastGenerationMode;
  ruleVersion: string;
  modelVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type ForecastFeedback = {
  id: string;
  forecastId: string;
  targetDate: string;
  matchLevel: MatchFeedbackLevel | null;
  actionExecuted: boolean | null;
  actionHelpfulness: ActionHelpfulness | null;
  innerSignalFeedback: MatchFeedbackLevel | null;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NightReportPayload = {
  forecast: DailyForecast;
  maturityLabel: string;
};
