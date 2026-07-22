import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import type { DailyForecast } from "@/lib/forecast/types";
import type { PersonalizationLevel } from "@/lib/product/personalization";
import type { UserExperienceMode } from "@/lib/product/modes";
import type { AnalysisFeedback, ReflectionSource } from "@/lib/product/lifeAreas";

export type ServiceResultState =
  | "ready"
  | "loading"
  | "empty"
  | "insufficient_data"
  | "no_saju"
  | "no_today_entry"
  | "ai_unavailable"
  | "error";

export type DiaryAnalysisInput = {
  entry: DiaryEntry;
  entries: DiaryEntry[];
  sajuProfile: SajuProfile | null;
  mode: UserExperienceMode;
};

export type DiaryAnalysisResult = {
  state: ServiceResultState;
  mindSummary: string;
  hiddenSignal: {
    text: string;
    isHypothesis: boolean;
    aiConnected: boolean;
  };
  neededCondition: string;
  oneAction: { action: string; reason: string };
  reflection: {
    text: string;
    source: ReflectionSource;
  };
  personalization: PersonalizationLevel;
  recordCount: number;
  feedbackPrompt: AnalysisFeedback[];
};

export type ForecastInput = {
  todayDate: string;
  todayEntry: DiaryEntry | null;
  entries: DiaryEntry[];
  sajuProfile: SajuProfile | null;
  mode: UserExperienceMode;
};

export type ForecastResult = {
  state: ServiceResultState;
  forecast: DailyForecast | null;
  message?: string;
};

export type PatternSummaryInput = {
  entries: DiaryEntry[];
  sajuProfile: SajuProfile | null;
  mode: UserExperienceMode;
};

export type PatternSummaryResult = {
  state: ServiceResultState;
  totalDays: number;
  monthDays: number;
  avgHappiness: number | null;
  avgEnergy: number | null;
  topEmotion: string | null;
  topArea: string | null;
  personalization: PersonalizationLevel;
  summary: string;
};

export interface DiaryAnalysisService {
  analyzeDiary(input: DiaryAnalysisInput): Promise<DiaryAnalysisResult>;
}

export interface ForecastService {
  createForecast(input: ForecastInput): Promise<ForecastResult>;
}

export interface PatternInsightService {
  createPatternSummary(
    input: PatternSummaryInput
  ): Promise<PatternSummaryResult>;
}
