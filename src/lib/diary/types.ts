import type { DiaryAnalysis } from "./dimensions";

export type DiaryDayPillar = {
  ganji: string;
  ganjiKo: string;
  ganjiIndex: number;
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
};

export type DiaryEntry = {
  id: string;
  date: string;
  content: string;
  dayPillar: DiaryDayPillar;
  monthPillarKo?: string;
  analysis: DiaryAnalysis | null;
  createdAt: string;
  updatedAt: string;
};

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
