import type { Element, YinYang } from "./constants";
import type { DaeunResult, Gender } from "./daeun";
import type { HiddenStemResult } from "./hiddenStems";

// ============================================================
// 사주 계산 공통 타입 정의
// ============================================================

export type CalendarType = "solar" | "lunar";
export type DayChangeRule = "midnight" | "ziHour";
export type TimeCorrection = "none" | "localMeanSolarTime" | "trueSolarTime";

export interface SajuOptions {
  calendarType: CalendarType;
  isLeapMonth?: boolean;
  timezone: string;
  location?: {
    name?: string;
    longitude?: number;
    latitude?: number;
  };
  dayChangeRule: DayChangeRule;
  timeCorrection: TimeCorrection;
}

export interface SajuInput {
  year: number;
  month: number;
  day: number;
  hour?: number;    // 0-23, undefined = 시간 모름
  minute?: number;  // 0-59
  gender?: Gender;
  options: SajuOptions;
}

export interface PillarStem {
  hanja: string;
  ko: string;
  yinYang: YinYang;
  element: Element;
}

export interface PillarBranch {
  hanja: string;
  ko: string;
  zodiacKo: string;
  yinYang: YinYang;
  element: Element;
}

export interface Pillar {
  stem: PillarStem;
  branch: PillarBranch;
  ganji: string;
  ganjiKo: string;
}

export interface SajuResult {
  input: {
    original: SajuInput;
    normalizedSolarDate: string;    // YYYY-MM-DD (KST 기준 날짜)
    normalizedSolarDateTime: string; // ISO 8601 with +09:00
    timezone: string;
    lunarConversion?: {
      inputLunar: string;
      outputSolar: string;
    };
  };

  options: SajuOptions;

  pillars: {
    year: Pillar;
    month: Pillar;
    day: Pillar;
    hour: Pillar | null;
  };

  daeun: DaeunResult;
  hiddenStems: HiddenStemResult;

  debug: {
    usedLichun: string;             // 사용한 입춘 시각 (KST ISO)
    usedMonthSolarTermStart: string; // 해당 월주 시작 절기 시각 (KST ISO)
    usedMonthSolarTermEnd: string;   // 해당 월주 끝 절기 시각 (KST ISO)
    usedMonthSolarTermName: string;  // 시작 절기 이름
    effectiveDateForDayPillar: string; // 일주 계산에 사용한 날짜
    jdnForDayPillar: number;
    dayGanjiIndex: number;
    hourBranchOrder?: number;
    timeCorrectionMinutes?: number;
    warnings: string[];
  };
}

export interface SajuError {
  code: string;
  message: string;
}
