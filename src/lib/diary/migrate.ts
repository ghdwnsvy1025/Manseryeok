import type { DiaryAnalysis } from "./dimensions";
import { createEmptyScoreReasons } from "./dimensions";
import type { DiaryEntry } from "./types";

function normalizeAnalysis(analysis: DiaryAnalysis): DiaryAnalysis {
  const withReasons = analysis.score_reasons
    ? analysis
    : { ...analysis, score_reasons: createEmptyScoreReasons() };
  return {
    ...withReasons,
    psychological_analysis: withReasons.psychological_analysis ?? null,
  };
}

/** 구버전 scores/aiSummary 필드를 analysis로 마이그레이션 */
export function normalizeDiaryEntry(raw: Record<string, unknown>): DiaryEntry {
  if (raw.analysis && typeof raw.analysis === "object") {
    const entry = raw as unknown as DiaryEntry;
    return {
      ...entry,
      analysis: entry.analysis ? normalizeAnalysis(entry.analysis) : null,
    };
  }

  const entry = raw as unknown as DiaryEntry & {
    scores?: unknown;
    aiSummary?: string | null;
  };

  return {
    id: entry.id,
    date: entry.date,
    content: entry.content,
    dayPillar: entry.dayPillar,
    monthPillarKo: entry.monthPillarKo,
    analysis: null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function analysisToDbJson(analysis: DiaryAnalysis): DiaryAnalysis {
  return analysis;
}
