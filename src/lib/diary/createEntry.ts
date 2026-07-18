import type { DiaryAnalysis } from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
import { DEFAULT_HAPPINESS_RATING } from "./happiness";
import { DIARY_SCHEMA_VERSION, type DiaryEntry } from "./types";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDiaryEntry(
  date: string,
  content: string,
  opts?: {
    analysis?: DiaryAnalysis | null;
    id?: string;
    happinessRating?: DiaryEntry["happinessRating"];
    emotions?: string[];
    tags?: string[];
    inputMode?: DiaryEntry["inputMode"];
    emotionSource?: DiaryEntry["emotionSource"];
    sajuProfileId?: string | null;
  }
): DiaryEntry {
  const { dayPillar, monthPillarKo, yearPillarKo } = getPillarsForDate(date);
  const now = new Date().toISOString();
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();

  return {
    id: opts?.id ?? generateId(),
    date,
    content,
    dayPillar,
    monthPillarKo,
    yearPillarKo,
    analysis: opts?.analysis ?? null,
    happinessRating: opts?.happinessRating ?? DEFAULT_HAPPINESS_RATING,
    emotions: opts?.emotions ?? [],
    tags: opts?.tags ?? [],
    heavenlyStem: dayPillar.stem.ko,
    earthlyBranch: dayPillar.branch.ko,
    weekday,
    isWeekend: weekday === 0 || weekday === 6,
    inputMode: opts?.inputMode,
    emotionSource: opts?.emotionSource,
    sajuProfileId: opts?.sajuProfileId ?? null,
    schemaVersion: DIARY_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
