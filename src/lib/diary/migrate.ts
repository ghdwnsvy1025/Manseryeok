import type { DiaryAnalysis } from "./dimensions";
import { createEmptyScoreReasons } from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
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

function backfillPillarKo(entry: DiaryEntry): DiaryEntry {
  let monthPillarKo = entry.monthPillarKo;
  let yearPillarKo = entry.yearPillarKo;

  if (!monthPillarKo || !yearPillarKo) {
    try {
      const pillars = getPillarsForDate(entry.date);
      monthPillarKo = monthPillarKo ?? pillars.monthPillarKo;
      yearPillarKo = yearPillarKo ?? pillars.yearPillarKo;
    } catch {
      // 날짜 파싱 실패 시 기존 값 유지
    }
  }

  if (monthPillarKo === entry.monthPillarKo && yearPillarKo === entry.yearPillarKo) {
    return entry;
  }

  return { ...entry, monthPillarKo, yearPillarKo };
}

/** 구버전 scores/aiSummary 필드를 analysis로 마이그레이션 */
export function normalizeDiaryEntry(raw: Record<string, unknown>): DiaryEntry {
  if (raw.analysis && typeof raw.analysis === "object") {
    const entry = raw as unknown as DiaryEntry;
    return backfillPillarKo({
      ...entry,
      analysis: entry.analysis ? normalizeAnalysis(entry.analysis) : null,
    });
  }

  const entry = raw as unknown as DiaryEntry & {
    scores?: unknown;
    aiSummary?: string | null;
  };

  return backfillPillarKo({
    id: entry.id,
    date: entry.date,
    content: entry.content,
    dayPillar: entry.dayPillar,
    monthPillarKo: entry.monthPillarKo,
    yearPillarKo: entry.yearPillarKo,
    analysis: null,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

export function analysisToDbJson(analysis: DiaryAnalysis): DiaryAnalysis {
  return analysis;
}
