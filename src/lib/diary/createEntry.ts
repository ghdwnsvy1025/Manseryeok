import type { DiaryAnalysis } from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
import type { DiaryEntry } from "./types";

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
  }
): DiaryEntry {
  const { dayPillar, monthPillarKo, yearPillarKo } = getPillarsForDate(date);
  const now = new Date().toISOString();

  return {
    id: opts?.id ?? generateId(),
    date,
    content,
    dayPillar,
    monthPillarKo,
    yearPillarKo,
    analysis: opts?.analysis ?? null,
    createdAt: now,
    updatedAt: now,
  };
}
