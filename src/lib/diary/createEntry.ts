import type { DiaryAnalysis } from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
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
    happinessSource?: DiaryEntry["happinessSource"];
    conditionRating?: DiaryEntry["conditionRating"];
    energyRating?: DiaryEntry["energyRating"];
    focusRating?: DiaryEntry["focusRating"];
    tenGod?: DiaryEntry["tenGod"];
    primaryArea?: DiaryEntry["primaryArea"];
    emotions?: string[];
    tags?: string[];
    inputMode?: DiaryEntry["inputMode"];
    emotionSource?: DiaryEntry["emotionSource"];
    sajuProfileId?: string | null;
    dataOrigin?: DiaryEntry["dataOrigin"];
    sleepSatisfaction?: DiaryEntry["sleepSatisfaction"];
    activityLevel?: DiaryEntry["activityLevel"];
    socialMet?: DiaryEntry["socialMet"];
    workIntensity?: DiaryEntry["workIntensity"];
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
    happinessRating: opts?.happinessRating,
    happinessSource: opts?.happinessSource ?? (opts?.happinessRating != null ? "selected" : undefined),
    conditionRating: opts?.conditionRating ?? null,
    energyRating: opts?.energyRating ?? null,
    focusRating: opts?.focusRating ?? null,
    tenGod: opts?.tenGod ?? null,
    primaryArea: opts?.primaryArea ?? null,
    emotions: opts?.emotions ?? [],
    tags: opts?.tags ?? [],
    heavenlyStem: dayPillar.stem.ko,
    earthlyBranch: dayPillar.branch.ko,
    weekday,
    isWeekend: weekday === 0 || weekday === 6,
    sleepSatisfaction: opts?.sleepSatisfaction ?? null,
    activityLevel: opts?.activityLevel ?? null,
    socialMet: opts?.socialMet ?? null,
    workIntensity: opts?.workIntensity ?? null,
    inputMode: opts?.inputMode,
    emotionSource: opts?.emotionSource,
    dataOrigin: opts?.dataOrigin ?? "user",
    sajuProfileId: opts?.sajuProfileId ?? null,
    schemaVersion: DIARY_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
