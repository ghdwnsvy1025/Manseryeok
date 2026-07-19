import type { DiaryAnalysis, EmotionLabel } from "./dimensions";
import { createEmptyScoreReasons, EMOTION_LABEL_KO } from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
import { normalizeTagList } from "./emotionTags";
import {
  DEFAULT_HAPPINESS_RATING,
  normalizeHappinessRating,
  scoreToHappinessRating,
  type HappinessRating,
} from "./happiness";
import { resolveDataOrigin, resolveHappinessSource } from "./dataOrigin";
import {
  DIARY_SCHEMA_VERSION,
  type ConditionRating,
  type DiaryEntry,
} from "./types";

function normalizeAnalysis(analysis: DiaryAnalysis): DiaryAnalysis {
  const withReasons = analysis.score_reasons
    ? analysis
    : { ...analysis, score_reasons: createEmptyScoreReasons() };
  return {
    ...withReasons,
    psychological_analysis: withReasons.psychological_analysis ?? null,
  };
}

function weekdayFromDate(date: string): { weekday: number; isWeekend: boolean } {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const weekday = dt.getDay();
  return { weekday, isWeekend: weekday === 0 || weekday === 6 };
}

function inferEmotionsFromLegacy(entry: Partial<DiaryEntry>): string[] {
  if (Array.isArray(entry.emotions) && entry.emotions.length > 0) {
    return normalizeTagList(entry.emotions);
  }
  const label = entry.analysis?.emotion_label;
  if (label && label in EMOTION_LABEL_KO) {
    return [EMOTION_LABEL_KO[label as EmotionLabel]];
  }
  return [];
}

function resolveHappinessRating(entry: Partial<DiaryEntry>): HappinessRating {
  if (entry.happinessRating != null) {
    return normalizeHappinessRating(entry.happinessRating);
  }
  if (entry.analysis?.daily_wellbeing_score != null) {
    return scoreToHappinessRating(entry.analysis.daily_wellbeing_score);
  }
  return DEFAULT_HAPPINESS_RATING;
}

function resolveConditionRating(
  entry: Partial<DiaryEntry>
): ConditionRating | null {
  const value = entry.conditionRating;
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  // 기존 기록의 컨디션은 행복도에서 추정하지 않음
  return null;
}

function backfillPillars(entry: DiaryEntry): DiaryEntry {
  let monthPillarKo = entry.monthPillarKo;
  let yearPillarKo = entry.yearPillarKo;
  let dayPillar = entry.dayPillar;
  let heavenlyStem = entry.heavenlyStem;
  let earthlyBranch = entry.earthlyBranch;

  try {
    const pillars = getPillarsForDate(entry.date);
    monthPillarKo = monthPillarKo ?? pillars.monthPillarKo;
    yearPillarKo = yearPillarKo ?? pillars.yearPillarKo;
    if (!dayPillar?.ganjiKo) {
      dayPillar = pillars.dayPillar;
    }
    heavenlyStem = heavenlyStem ?? dayPillar.stem.ko;
    earthlyBranch = earthlyBranch ?? dayPillar.branch.ko;
  } catch {
    // 날짜 파싱 실패 시 기존 값 유지
  }

  return {
    ...entry,
    dayPillar,
    monthPillarKo,
    yearPillarKo,
    heavenlyStem,
    earthlyBranch,
  };
}

/** 구버전 필드를 현재 DiaryEntry로 정규화하고 스키마 버전을 올린다 */
export function normalizeDiaryEntry(raw: Record<string, unknown>): DiaryEntry {
  const hadExplicitRating =
    raw.happinessRating === 1 ||
    raw.happinessRating === 2 ||
    raw.happinessRating === 3 ||
    raw.happinessRating === 4 ||
    raw.happinessRating === 5;

  const hasAnalysisObject =
    raw.analysis && typeof raw.analysis === "object";

  let base: DiaryEntry;
  if (hasAnalysisObject) {
    const entry = raw as unknown as DiaryEntry;
    base = {
      ...entry,
      analysis: entry.analysis ? normalizeAnalysis(entry.analysis) : null,
    };
  } else {
    const entry = raw as unknown as DiaryEntry & {
      scores?: unknown;
      aiSummary?: string | null;
    };
    base = {
      id: entry.id,
      date: entry.date,
      content: entry.content,
      dayPillar: entry.dayPillar,
      monthPillarKo: entry.monthPillarKo,
      yearPillarKo: entry.yearPillarKo,
      sajuDepth: entry.sajuDepth,
      userBirthPillars: entry.userBirthPillars,
      sajuProfileId: entry.sajuProfileId,
      analysis: null,
      happinessRating: entry.happinessRating,
      happinessSource: entry.happinessSource,
      conditionRating: entry.conditionRating,
      emotions: entry.emotions,
      tags: entry.tags,
      heavenlyStem: entry.heavenlyStem,
      earthlyBranch: entry.earthlyBranch,
      weekday: entry.weekday,
      isWeekend: entry.isWeekend,
      sleepScore: entry.sleepScore,
      sleepSatisfaction: entry.sleepSatisfaction,
      exerciseStatus: entry.exerciseStatus,
      activityLevel: entry.activityLevel,
      socialActivity: entry.socialActivity,
      socialMet: entry.socialMet,
      workIntensity: entry.workIntensity,
      weatherMetadata: entry.weatherMetadata,
      inputMode: entry.inputMode,
      emotionSource: entry.emotionSource,
      dataOrigin: entry.dataOrigin,
      userId: entry.userId,
      schemaVersion: entry.schemaVersion,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  const withPillars = backfillPillars(base);
  const { weekday, isWeekend } = weekdayFromDate(withPillars.date);
  const happinessRating = resolveHappinessRating(withPillars);

  return {
    ...withPillars,
    happinessRating,
    happinessSource: resolveHappinessSource(withPillars, hadExplicitRating),
    conditionRating: resolveConditionRating(withPillars),
    emotions: inferEmotionsFromLegacy(withPillars),
    tags: normalizeTagList(withPillars.tags),
    weekday: typeof withPillars.weekday === "number" ? withPillars.weekday : weekday,
    isWeekend:
      typeof withPillars.isWeekend === "boolean"
        ? withPillars.isWeekend
        : isWeekend,
    dataOrigin: resolveDataOrigin(withPillars),
    schemaVersion: DIARY_SCHEMA_VERSION,
  };
}

export function analysisToDbJson(analysis: DiaryAnalysis): DiaryAnalysis {
  return analysis;
}
