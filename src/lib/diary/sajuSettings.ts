/**
 * 사주 기록 범위 설정
 *
 * 목적: 일기 × 사주 통계 분석을 위해 각 일기 항목에 얼마나 많은 사주 정보를
 * 함께 저장할지 선택합니다. 범위가 넓을수록 더 깊은 통계 분석이 가능합니다.
 *
 * - day:   일진(일주)만 저장  → 일주 × 감정 상관관계
 * - month: 월주까지 저장      → 월주 × 일주 복합 분석
 * - year:  년주까지 저장      → 년/월/일주 복합 분석
 * - full:  사주팔자까지 저장  → 개인 사주팔자와 일진의 상호작용 분석
 */

import { getDayPillar as getSajuDayPillar } from "@/lib/saju/dayPillar";
import { getYearPillar } from "@/lib/saju/yearPillar";
import { getMonthPillar } from "@/lib/saju/monthPillar";
import { getHourPillar } from "@/lib/saju/hourPillar";
import { kstToJDE, mod } from "@/lib/saju/jdn";
import type { SajuDepth, UserBirthPillarDetail, UserBirthPillars } from "./types";
import type { SajuResult } from "@/lib/saju/types";

const STORAGE_KEY = "manseryeok_saju_settings";
const MIN_SUPPORTED_YEAR = 1900;
const MAX_SUPPORTED_YEAR = 2100;

export type SajuSettings = {
  depth: SajuDepth;
  /** 사용자 생년월일 (YYYY-MM-DD) */
  birthDate?: string;
  /** 사용자 출생 시 (0-23, 없으면 시주 미포함) */
  birthHour?: number;
  /** 사용자 출생 분 (0-59) */
  birthMinute?: number;
  /** 만세력 기둥 표시 여부 (true = 사용/표시) */
  pillarVisibility?: PillarVisibility;
};

export type BirthPillarSlot = "hour" | "day" | "month" | "year";
export type DiaryPillarSlot = "year" | "month" | "day";

export type PillarVisibility = {
  birth: Record<BirthPillarSlot, boolean>;
  diary: Record<DiaryPillarSlot, boolean>;
};

export const DEFAULT_PILLAR_VISIBILITY: PillarVisibility = {
  birth: { hour: true, day: true, month: true, year: true },
  diary: { year: true, month: true, day: true },
};

const DEFAULT_SETTINGS: SajuSettings = {
  depth: "full",
  pillarVisibility: DEFAULT_PILLAR_VISIBILITY,
};

export type BirthDateTimeFields = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

export type BirthDateTimeValidation =
  | {
      ok: true;
      birthDate: string;
      birthHour?: number;
      birthMinute?: number;
    }
  | {
      ok: false;
      reason: "incomplete" | "invalid";
      message: string;
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

function isValidGregorianDate(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseHourField(value: string): number | null {
  if (!value) return null;
  const hour = Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function parseMinuteField(value: string): number | null {
  if (!value) return null;
  const minute = Number(value);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return minute;
}

function formatBirthDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 생년월일시 입력 필드 검증 – 완료·유효 시 사주 계산에 바로 사용 가능 */
export function validateBirthDateTimeFields(fields: BirthDateTimeFields): BirthDateTimeValidation {
  const { year, month, day, hour, minute } = fields;
  const dateFieldsComplete = year.length === 4 && month !== "" && day !== "";

  if (!dateFieldsComplete) {
    return { ok: false, reason: "incomplete", message: "" };
  }

  const parsedYear = parseYearField(year);
  const parsedMonth = parseMonthField(month);
  const parsedDay = parseDayField(day);

  if (
    parsedYear === null ||
    parsedMonth === null ||
    parsedDay === null ||
    !isValidGregorianDate(parsedYear, parsedMonth, parsedDay)
  ) {
    return { ok: false, reason: "invalid", message: "생년월일을 다시 입력해주세요." };
  }

  const parsedHour = parseHourField(hour);
  const parsedMinute = parseMinuteField(minute);

  if (hour !== "" && parsedHour === null) {
    return { ok: false, reason: "invalid", message: "출생 시각을 다시 입력해주세요." };
  }

  if (minute !== "" && parsedMinute === null) {
    return { ok: false, reason: "invalid", message: "출생 시각을 다시 입력해주세요." };
  }

  if (minute !== "" && hour === "") {
    return { ok: false, reason: "invalid", message: "출생 시각을 다시 입력해주세요." };
  }

  return {
    ok: true,
    birthDate: formatBirthDate(parsedYear, parsedMonth, parsedDay),
    birthHour: parsedHour ?? undefined,
    birthMinute: parsedMinute ?? undefined,
  };
}

export function splitBirthDate(birthDate?: string): { year: string; month: string; day: string } {
  const parts = birthDate?.split("-") ?? [];
  return {
    year: parts[0] ?? "",
    month: parts[1] ? String(Number(parts[1])) : "",
    day: parts[2] ? String(Number(parts[2])) : "",
  };
}

function isSupportedBirthDate(birthDate: unknown): birthDate is string {
  if (typeof birthDate !== "string") return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate.trim());
  if (!match) return false;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (y < MIN_SUPPORTED_YEAR || y > MAX_SUPPORTED_YEAR) return false;

  return isValidGregorianDate(y, m, d);
}

function isSupportedBirthHour(birthHour: unknown): birthHour is number {
  return (
    typeof birthHour === "number" &&
    Number.isInteger(birthHour) &&
    birthHour >= 0 &&
    birthHour <= 23
  );
}

function isSupportedBirthMinute(birthMinute: unknown): birthMinute is number {
  return (
    typeof birthMinute === "number" &&
    Number.isInteger(birthMinute) &&
    birthMinute >= 0 &&
    birthMinute <= 59
  );
}

function isSupportedPillarVisibility(value: unknown): value is PillarVisibility {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<PillarVisibility>;
  const birth = v.birth;
  const diary = v.diary;
  if (!birth || !diary || typeof birth !== "object" || typeof diary !== "object") return false;

  const birthSlots: BirthPillarSlot[] = ["hour", "day", "month", "year"];
  const diarySlots: DiaryPillarSlot[] = ["year", "month", "day"];

  return (
    birthSlots.every((slot) => typeof birth[slot] === "boolean") &&
    diarySlots.every((slot) => typeof diary[slot] === "boolean")
  );
}

export function resolvePillarVisibility(settings?: Pick<SajuSettings, "pillarVisibility">): PillarVisibility {
  const raw = settings?.pillarVisibility;
  if (!raw) return DEFAULT_PILLAR_VISIBILITY;
  return {
    birth: { ...DEFAULT_PILLAR_VISIBILITY.birth, ...raw.birth },
    diary: { ...DEFAULT_PILLAR_VISIBILITY.diary, ...raw.diary },
  };
}

export function loadSajuSettings(): SajuSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SajuSettings>;
    return {
      depth: "full",
      birthDate: isSupportedBirthDate(parsed.birthDate) ? parsed.birthDate : undefined,
      birthHour: isSupportedBirthHour(parsed.birthHour) ? parsed.birthHour : undefined,
      birthMinute: isSupportedBirthMinute(parsed.birthMinute) ? parsed.birthMinute : undefined,
      pillarVisibility: isSupportedPillarVisibility(parsed.pillarVisibility)
        ? parsed.pillarVisibility
        : DEFAULT_PILLAR_VISIBILITY,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSajuSettings(settings: SajuSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, depth: "full" }));
}

/** 만세력 계산 결과에서 생년월일시를 일기 설정과 공유 */
export function saveBirthFromSajuResult(result: SajuResult): void {
  const current = loadSajuSettings();
  const date = result.input.normalizedSolarDate;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return;

  const birthDate = date;
  const hour = result.input.original.hour;
  const minute = result.input.original.minute;

  saveSajuSettings({
    ...current,
    birthDate,
    birthHour: hour !== undefined ? hour : undefined,
    birthMinute: minute !== undefined && hour !== undefined ? minute : undefined,
  });
}

/** 일기에 저장된 생년월일시를 만세력 입력 폼 초기값으로 */
export function getBirthPrefillForForm(): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
} | null {
  const settings = loadSajuSettings();
  if (!settings.birthDate) return null;
  const parts = splitBirthDate(settings.birthDate);
  return {
    ...parts,
    hour: settings.birthHour !== undefined ? String(settings.birthHour) : "",
    minute: settings.birthMinute !== undefined ? String(settings.birthMinute) : "",
  };
}

function toPillarDetail(pillar: {
  ganji: string;
  ganjiKo: string;
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
}): UserBirthPillarDetail {
  return {
    stemHanja: pillar.stem.hanja,
    branchHanja: pillar.branch.hanja,
    stemKo: pillar.stem.ko,
    branchKo: pillar.branch.ko,
    ganjiKo: pillar.ganjiKo,
  };
}

/** 생년월일(시분)로 사주팔자를 계산해 UserBirthPillars 반환 */
export function computeUserBirthPillars(
  birthDate: string,
  birthHour?: number,
  birthMinute?: number
): UserBirthPillars | null {
  try {
    const [y, m, d] = birthDate.split("-").map(Number);
    // 미완성 연도(1900 미만 등) 방어
    if (!y || !m || !d || y < MIN_SUPPORTED_YEAR || y > MAX_SUPPORTED_YEAR) return null;

    const hour = birthHour ?? 12;
    const minute = birthMinute ?? 0;
    const birthJDE = kstToJDE(y, m, d, hour, minute);
    const yearResult = getYearPillar(birthJDE, y);
    const yearStemIndex = mod(yearResult.sajuYear - 4, 10);
    const monthResult = getMonthPillar(birthJDE, yearResult.sajuYear, yearStemIndex);
    const dayResult = getSajuDayPillar(y, m, d, hour, "midnight");

    let hour_: UserBirthPillarDetail | undefined;
    if (birthHour !== undefined) {
      const hourResult = getHourPillar(dayResult.stemIndex, hour, minute);
      hour_ = toPillarDetail(hourResult.pillar);
    }

    return {
      year: toPillarDetail(yearResult.pillar),
      month: toPillarDetail(monthResult.pillar),
      day: toPillarDetail(dayResult.pillar),
      hour: hour_,
    };
  } catch {
    return null;
  }
}
