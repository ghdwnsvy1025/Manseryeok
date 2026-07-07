// ============================================================
// 일기용 날짜 → 일주/월주 계산 래퍼
// ============================================================

import { kstToJDE } from "@/lib/saju/jdn";
import { getDayPillar, type DayPillarResult } from "@/lib/saju/dayPillar";
import { getYearPillar } from "@/lib/saju/yearPillar";
import { getMonthPillar } from "@/lib/saju/monthPillar";
import { mod } from "@/lib/saju/jdn";
import type { DiaryDayPillar } from "./types";

const DIARY_HOUR = 12;
const DIARY_DAY_RULE = "midnight" as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDateString(dateStr: string): boolean {
  return DATE_RE.test(dateStr.trim());
}

export function resolveDateString(dateStr?: string | null): string {
  const trimmed = dateStr?.trim();
  if (trimmed && isValidDateString(trimmed)) return trimmed;
  return todayDateString();
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const trimmed = dateStr.trim();
  const match = DATE_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function toDiaryDayPillar(result: DayPillarResult): DiaryDayPillar {
  const { pillar, ganjiIndex } = result;
  return {
    ganji: pillar.ganji,
    ganjiKo: pillar.ganjiKo,
    ganjiIndex,
    stem: { hanja: pillar.stem.hanja, ko: pillar.stem.ko },
    branch: { hanja: pillar.branch.hanja, ko: pillar.branch.ko },
  };
}

export function getDayPillarForDate(dateStr: string): DiaryDayPillar {
  const { year, month, day } = parseDateString(dateStr);
  const result = getDayPillar(year, month, day, DIARY_HOUR, DIARY_DAY_RULE);
  return toDiaryDayPillar(result);
}

export function getPillarsForDate(dateStr: string): {
  dayPillar: DiaryDayPillar;
  monthPillarKo: string;
} {
  const { year, month, day } = parseDateString(dateStr);
  const birthJDE = kstToJDE(year, month, day, DIARY_HOUR, 0);
  const yearResult = getYearPillar(birthJDE, year);
  const yearStemIndex = mod(yearResult.sajuYear - 4, 10);
  const monthResult = getMonthPillar(birthJDE, yearResult.sajuYear, yearStemIndex);
  const dayResult = getDayPillar(year, month, day, DIARY_HOUR, DIARY_DAY_RULE);

  return {
    dayPillar: toDiaryDayPillar(dayResult),
    monthPillarKo: monthResult.pillar.ganjiKo,
  };
}

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
