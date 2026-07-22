import type {
  DiaryAnalysisService,
  ForecastService,
  PatternInsightService,
} from "./types";
import { MockDiaryAnalysisService } from "./mock/MockDiaryAnalysisService";
import { MockForecastService } from "./mock/MockForecastService";
import { MockPatternInsightService } from "./mock/MockPatternInsightService";

let diaryAnalysis: DiaryAnalysisService | null = null;
let forecast: ForecastService | null = null;
let patternInsight: PatternInsightService | null = null;

/** 현재는 목업만. 이후 AIDiaryAnalysisService 등으로 교체 */
export function getDiaryAnalysisService(): DiaryAnalysisService {
  if (!diaryAnalysis) diaryAnalysis = new MockDiaryAnalysisService();
  return diaryAnalysis;
}

export function getForecastService(): ForecastService {
  if (!forecast) forecast = new MockForecastService();
  return forecast;
}

export function getPatternInsightService(): PatternInsightService {
  if (!patternInsight) patternInsight = new MockPatternInsightService();
  return patternInsight;
}

export type {
  DiaryAnalysisService,
  ForecastService,
  PatternInsightService,
  DiaryAnalysisResult,
  ForecastResult,
  PatternSummaryResult,
  ServiceResultState,
} from "./types";
