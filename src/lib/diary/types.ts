import type { DiaryAnalysis, EmotionLabel } from "./dimensions";
import type { HappinessRating } from "./happiness";
import type { DiaryInputMode } from "./manualScores";
import type {
  CalendarType,
  DayChangeRule,
  TimeCorrection,
} from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";

/** 현재 도메인 스키마 버전 */
export const DIARY_SCHEMA_VERSION = 3;

export type ExperienceMode = "beginner" | "expert";

export type DiaryDataOrigin = "user" | "import" | "demo";
export type HappinessSource = "selected" | "backfilled" | "default";

export type ConditionRating = 1 | 2 | 3 | 4 | 5;

export type SleepSatisfaction = "poor" | "fair" | "good" | "great";
export type ActivityLevel = "low" | "moderate" | "high";
export type SocialMet = "alone" | "few" | "many";
export type WorkIntensity = "light" | "normal" | "heavy";

export type DiaryDayPillar = {
  ganji: string;
  ganjiKo: string;
  ganjiIndex: number;
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
};

/** 일주 외 다른 기둥(월주·년주) 정보 */
export type DiaryPillar = {
  ganji: string;
  ganjiKo: string;
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
};

/**
 * 사주 기록 범위
 * - day: 일진(일주)만 저장
 * - month: 월주까지
 * - year: 년주까지
 * - full: 사용자의 사주팔자까지 함께 저장
 */
export type SajuDepth = "day" | "month" | "year" | "full";

/** 단일 기둥의 상세 정보 */
export type UserBirthPillarDetail = {
  stemHanja: string;
  branchHanja: string;
  stemKo: string;
  branchKo: string;
  ganjiKo: string;
};

/** 사용자의 태어난 날 사주팔자 (full 범위일 때 저장) */
export type UserBirthPillars = {
  year: UserBirthPillarDetail;
  month: UserBirthPillarDetail;
  day: UserBirthPillarDetail;
  hour?: UserBirthPillarDetail;
};

export type UserProfile = {
  id: string;
  locale?: string;
  timezone?: string;
  activeSajuProfileId?: string | null;
  experienceMode?: ExperienceMode | null;
  onboardingCompletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type SajuProfilePillars = {
  year: UserBirthPillarDetail;
  month: UserBirthPillarDetail;
  day: UserBirthPillarDetail;
  hour?: UserBirthPillarDetail | null;
};

export type SajuProfile = {
  id: string;
  userId?: string | null;
  label?: string;
  isPrimary: boolean;
  birthDate: string;
  birthHour?: number;
  birthMinute?: number;
  birthTimeUnknown: boolean;
  calendarType: CalendarType;
  isLeapMonth?: boolean;
  gender?: Gender;
  timezone: string;
  locationName?: string;
  longitude?: number;
  latitude?: number;
  dayChangeRule: DayChangeRule;
  timeCorrection: TimeCorrection;
  pillars: SajuProfilePillars;
  calculationVersion: string;
  inputHash?: string;
  solarTermBoundary?: {
    lichun?: string;
    monthStart?: string;
    monthEnd?: string;
    monthName?: string;
  };
  calculationMetadata?: Record<string, unknown>;
  reconstructed?: boolean;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
};

export type DiaryEntry = {
  id: string;
  date: string;
  content: string;
  dayPillar: DiaryDayPillar;
  monthPillarKo?: string;
  yearPillarKo?: string;
  /** 이 항목에 저장된 사주 기록 범위 */
  sajuDepth?: SajuDepth;
  /** 사용자의 사주팔자 (sajuDepth === "full" 일 때, legacy) */
  userBirthPillars?: UserBirthPillars;
  /** 연결된 사주 프로필 */
  sajuProfileId?: string | null;
  analysis: DiaryAnalysis | null;
  /** 사용자 입력 행복도 1–5 */
  happinessRating?: HappinessRating;
  /** 행복도 출처 */
  happinessSource?: HappinessSource;
  /** 생활 컨디션 1–5 (의료적 건강이 아님) */
  conditionRating?: ConditionRating | null;
  /** 다중 감정 태그 */
  emotions?: string[];
  /** 사건·사용자 정의 태그 */
  tags?: string[];
  heavenlyStem?: string;
  earthlyBranch?: string;
  weekday?: number;
  isWeekend?: boolean;
  sleepScore?: number | null;
  sleepSatisfaction?: SleepSatisfaction | null;
  exerciseStatus?: string | null;
  activityLevel?: ActivityLevel | null;
  socialActivity?: string | null;
  socialMet?: SocialMet | null;
  workIntensity?: WorkIntensity | null;
  weatherMetadata?: Record<string, unknown> | null;
  /** text: 글쓰기, scores: 슬라이더 점수 입력 */
  inputMode?: DiaryInputMode;
  /** 기분 라벨의 출처: 직접 선택 / 행복도 자동 추론 / AI 분석 */
  emotionSource?: "selected" | "inferred" | "ai";
  /** 데이터 출처 — 통계에서는 demo 제외 */
  dataOrigin?: DiaryDataOrigin;
  userId?: string | null;
  schemaVersion?: number;
  createdAt: string;
  updatedAt: string;
};

export type StatsGroupType = "year" | "month" | "ganji" | "stem" | "branch";

export type GroupStats = {
  groupType: StatsGroupType;
  key: string;
  label: string;
  entryCount: number;
  analyzedCount: number;
  avgDailyWellbeing: number;
  avgScores: Partial<Record<keyof DiaryAnalysis, number>>;
  explicitMoodCount: number;
  moodCounts: Partial<Record<EmotionLabel, number>>;
  dates: string[];
  deltaFromOverall?: number;
};

/** @deprecated GroupStats(ganji) 사용 권장 */
export type DayPillarStats = {
  ganjiKo: string;
  entryCount: number;
  analyzedCount: number;
  avgDailyWellbeing: number;
  avgScores: Partial<Record<keyof DiaryAnalysis, number>>;
  dates: string[];
};

export type DiaryListOptions = {
  limit?: number;
  offset?: number;
};

export type DiaryMonthRange = {
  year: number;
  month: number;
};

export type SampleLevel =
  | "insufficient"
  | "early"
  | "usable"
  | "comparable";

export function getSampleLevel(count: number): SampleLevel {
  if (count <= 2) return "insufficient";
  if (count <= 4) return "early";
  if (count <= 9) return "usable";
  return "comparable";
}

export const SAMPLE_LEVEL_LABELS: Record<SampleLevel, string> = {
  insufficient: "참고하기 어려움 (1~2회)",
  early: "초기 경향 (3~4회)",
  usable: "참고 가능한 경향 (5~9회)",
  comparable: "반복 비교 가능 (10회 이상)",
};
