// ============================================================
// 일기용 날짜 → 일주/월주 계산 래퍼
// ============================================================

import { kstToJDE } from "@/lib/saju/jdn";
import { getDayPillar, type DayPillarResult } from "@/lib/saju/dayPillar";
import { getYearPillar } from "@/lib/saju/yearPillar";
import { getMonthPillar } from "@/lib/saju/monthPillar";
import { mod } from "@/lib/saju/jdn";
import type { DiaryDayPillar, DiaryPillar } from "./types";

const DIARY_HOUR = 12;
const DIARY_DAY_RULE = "midnight" as const;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;

function isSupportedDateParts(year: number, month: number, day: number): boolean {
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidDateString(dateStr: string): boolean {
  const match = DATE_RE.exec(dateStr.trim());
  if (!match) return false;

  return isSupportedDateParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  );
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
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!isSupportedDateParts(year, month, day)) {
    throw new Error(`지원 범위(1900-2100)의 올바른 날짜를 입력해주세요: ${dateStr}`);
  }

  return { year, month, day };
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

function toDiaryPillar(pillar: { ganji: string; ganjiKo: string; stem: { hanja: string; ko: string }; branch: { hanja: string; ko: string } }): DiaryPillar {
  return {
    ganji: pillar.ganji,
    ganjiKo: pillar.ganjiKo,
    stem: { hanja: pillar.stem.hanja, ko: pillar.stem.ko },
    branch: { hanja: pillar.branch.hanja, ko: pillar.branch.ko },
  };
}

export function getPillarsForDate(dateStr: string): {
  dayPillar: DiaryDayPillar;
  monthPillar: DiaryPillar;
  yearPillar: DiaryPillar;
  /** 하위 호환용 Ko 문자열 */
  monthPillarKo: string;
  yearPillarKo: string;
} {
  const { year, month, day } = parseDateString(dateStr);
  const birthJDE = kstToJDE(year, month, day, DIARY_HOUR, 0);
  const yearResult = getYearPillar(birthJDE, year);
  const yearStemIndex = mod(yearResult.sajuYear - 4, 10);
  const monthResult = getMonthPillar(birthJDE, yearResult.sajuYear, yearStemIndex);
  const dayResult = getDayPillar(year, month, day, DIARY_HOUR, DIARY_DAY_RULE);

  const monthPillar = toDiaryPillar(monthResult.pillar);
  const yearPillar = toDiaryPillar(yearResult.pillar);

  return {
    dayPillar: toDiaryDayPillar(dayResult),
    monthPillar,
    yearPillar,
    monthPillarKo: monthPillar.ganjiKo,
    yearPillarKo: yearPillar.ganjiKo,
  };
}

export function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DiaryDateFields = {
  year: string;
  month: string;
  day: string;
};

export type PartialDiaryPillars = {
  yearPillar: DiaryPillar | null;
  monthPillar: DiaryPillar | null;
  dayPillar: DiaryDayPillar | null;
};

function parseYearField(value: string): number | null {
  if (value.length !== 4) return null;
  const year = Number(value);
  if (!Number.isInteger(year) || year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) return null;
  return year;
}

function parseMonthField(value: string): number | null {
  if (!value) return null;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return month;
}

function parseDayField(value: string): number | null {
  if (!value) return null;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return day;
}

function computeYearMonthPillars(year: number, month: number, day: number): {
  yearPillar: DiaryPillar;
  monthPillar: DiaryPillar;
} {
  const birthJDE = kstToJDE(year, month, day, DIARY_HOUR, 0);
  const yearResult = getYearPillar(birthJDE, year);
  const yearStemIndex = mod(yearResult.sajuYear - 4, 10);
  const monthResult = getMonthPillar(birthJDE, yearResult.sajuYear, yearStemIndex);
  return {
    yearPillar: toDiaryPillar(yearResult.pillar),
    monthPillar: toDiaryPillar(monthResult.pillar),
  };
}

/** 일기 날짜 입력 필드로 점진적 간지 계산 (미리보기용) */
export function getPartialPillarsForFields(fields: DiaryDateFields): PartialDiaryPillars {
  const parsedYear = parseYearField(fields.year);
  if (parsedYear === null) {
    return { yearPillar: null, monthPillar: null, dayPillar: null };
  }

  const parsedMonth = parseMonthField(fields.month);
  if (parsedMonth === null) {
    const { yearPillar } = computeYearMonthPillars(parsedYear, 6, 15);
    return { yearPillar, monthPillar: null, dayPillar: null };
  }

  const parsedDay = parseDayField(fields.day);
  if (parsedDay === null || !isSupportedDateParts(parsedYear, parsedMonth, parsedDay)) {
    const { yearPillar, monthPillar } = computeYearMonthPillars(parsedYear, parsedMonth, 1);
    return { yearPillar, monthPillar, dayPillar: null };
  }

  const full = getPillarsForDate(
    `${String(parsedYear).padStart(4, "0")}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`
  );
  return {
    yearPillar: full.yearPillar,
    monthPillar: full.monthPillar,
    dayPillar: full.dayPillar,
  };
}
