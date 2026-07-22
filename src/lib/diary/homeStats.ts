import type { DiaryEntry } from "./types";
import { ENERGY_RATING_LABELS } from "./types";
import {
  HAPPINESS_RATING_LABELS,
  type HappinessRating,
} from "./happiness";
import {
  FOCUS_RATING_LABELS,
  type FocusRating,
} from "@/lib/product/lifeAreas";

export type RatingSeriesPoint = {
  date: string;
  value: number | null;
};

export type AreaKey = "energy" | "focus" | "condition";

export type HomeAreaHighlight = {
  key: AreaKey;
  label: string;
  avg: number;
  /** 0–1 정규화 (서로 다른 척도 비교용) */
  normalized: number;
  max: number;
  hint: string;
  count: number;
};

export type HomeDiaryStats = {
  happiness30: {
    avg: number | null;
    count: number;
    hint: string;
  };
  highestArea: HomeAreaHighlight | null;
  lowestArea: HomeAreaHighlight | null;
  happinessSeries: RatingSeriesPoint[];
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function daysAgoStr(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function collect(
  entries: DiaryEntry[],
  pick: (e: DiaryEntry) => number | null | undefined
): number[] {
  const out: number[] = [];
  for (const e of entries) {
    const v = pick(e);
    if (typeof v === "number" && Number.isFinite(v)) out.push(v);
  }
  return out;
}

function clampRating10(n: number): HappinessRating {
  return Math.min(10, Math.max(1, Math.round(n))) as HappinessRating;
}

const AREA_DEFS: Array<{
  key: AreaKey;
  label: string;
  max: number;
  pick: (e: DiaryEntry) => number | null | undefined;
  formatHint: (a: number) => string;
}> = [
  {
    key: "energy",
    label: "에너지",
    max: 4,
    pick: (e) => e.energyRating,
    formatHint: (a) =>
      ENERGY_RATING_LABELS[
        Math.min(4, Math.max(1, Math.round(a))) as 1 | 2 | 3 | 4
      ],
  },
  {
    key: "focus",
    label: "집중",
    max: 10,
    pick: (e) => e.focusRating,
    formatHint: (a) =>
      FOCUS_RATING_LABELS[clampRating10(a) as FocusRating],
  },
  {
    key: "condition",
    label: "컨디션",
    max: 10,
    pick: (e) => e.conditionRating,
    formatHint: (a) =>
      a >= 8 ? "양호한 편" : a >= 5 ? "보통" : "회복 필요",
  },
];

/**
 * 홈용 일기 수치 통계.
 * - 최근 30일 행복 평균 (1–10)
 * - 행복 제외 영역 중 최고/최저 (정규화 비교)
 * - 행복도 일별 시리즈 (최근 14일)
 */
export function buildHomeDiaryStats(
  entries: DiaryEntry[],
  options?: { windowDays?: number; seriesDays?: number; today?: string }
): HomeDiaryStats {
  const windowDays = options?.windowDays ?? 30;
  const seriesDays = options?.seriesDays ?? 14;
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  const todayDate = new Date(`${today}T12:00:00`);

  const recentStart = daysAgoStr(windowDays - 1, todayDate);
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.filter((e) => e.date >= recentStart && e.date <= today);

  const happinessVals = collect(recent, (e) => e.happinessRating);
  const happinessAvg = avg(happinessVals);
  const happiness30 = {
    avg: happinessAvg,
    count: happinessVals.length,
    hint:
      happinessAvg == null
        ? "기록 없음"
        : HAPPINESS_RATING_LABELS[clampRating10(happinessAvg)],
  };

  const areas: HomeAreaHighlight[] = [];
  for (const def of AREA_DEFS) {
    const vals = collect(recent, def.pick);
    const a = avg(vals);
    if (a == null) continue;
    areas.push({
      key: def.key,
      label: def.label,
      avg: a,
      normalized: a / def.max,
      max: def.max,
      hint: def.formatHint(a),
      count: vals.length,
    });
  }

  let highestArea: HomeAreaHighlight | null = null;
  let lowestArea: HomeAreaHighlight | null = null;
  if (areas.length === 1) {
    highestArea = areas[0] ?? null;
  } else if (areas.length > 1) {
    const byNorm = [...areas].sort((a, b) => b.normalized - a.normalized);
    highestArea = byNorm[0] ?? null;
    lowestArea = byNorm[byNorm.length - 1] ?? null;
  }

  const byDate = new Map(sorted.map((e) => [e.date, e]));
  const happinessSeries: RatingSeriesPoint[] = [];
  for (let i = seriesDays - 1; i >= 0; i--) {
    const date = daysAgoStr(i, todayDate);
    const entry = byDate.get(date);
    happinessSeries.push({
      date,
      value:
        typeof entry?.happinessRating === "number"
          ? entry.happinessRating
          : null,
    });
  }

  return {
    happiness30,
    highestArea,
    lowestArea,
    happinessSeries,
  };
}
