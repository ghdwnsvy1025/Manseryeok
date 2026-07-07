import {
  NEGATIVE_SCORE_KEYS,
  POSITIVE_SCORE_KEYS,
  type DiaryAnalysis,
} from "./dimensions";
import type { DayPillarStats, DiaryEntry } from "./types";

function averageAnalysis(entries: DiaryEntry[]): {
  avgDailyWellbeing: number;
  avgScores: Partial<Record<keyof DiaryAnalysis, number>>;
} {
  const withAnalysis = entries.filter((e) => e.analysis !== null);
  if (withAnalysis.length === 0) {
    return { avgDailyWellbeing: 0, avgScores: {} };
  }

  const sums: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let wellbeingSum = 0;

  for (const entry of withAnalysis) {
    const a = entry.analysis!;
    wellbeingSum += a.daily_wellbeing_score;

    for (const key of [...POSITIVE_SCORE_KEYS, ...NEGATIVE_SCORE_KEYS]) {
      const v = a[key];
      if (v === null) continue;
      sums[key] = (sums[key] ?? 0) + v;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  const avgScores: Partial<Record<keyof DiaryAnalysis, number>> = {};
  for (const key of Object.keys(sums)) {
    avgScores[key as keyof DiaryAnalysis] = Math.round(sums[key] / counts[key]);
  }

  return {
    avgDailyWellbeing: Math.round(wellbeingSum / withAnalysis.length),
    avgScores,
  };
}

export function getStatsForPillar(ganjiKo: string, entries: DiaryEntry[]): DayPillarStats {
  const matched = entries
    .filter((e) => e.dayPillar.ganjiKo === ganjiKo)
    .sort((a, b) => a.date.localeCompare(b.date));

  const { avgDailyWellbeing, avgScores } = averageAnalysis(matched);

  return {
    ganjiKo,
    entryCount: matched.length,
    analyzedCount: matched.filter((e) => e.analysis !== null).length,
    avgDailyWellbeing,
    avgScores,
    dates: matched.map((e) => e.date),
  };
}

export function aggregateByDayPillar(entries: DiaryEntry[]): DayPillarStats[] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = entry.dayPillar.ganjiKo;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([ganjiKo, group]) => getStatsForPillar(ganjiKo, group))
    .sort((a, b) => b.entryCount - a.entryCount);
}

export function getTopDayPillars(entries: DiaryEntry[], limit = 5): DayPillarStats[] {
  return aggregateByDayPillar(entries).slice(0, limit);
}

export function getRecentAvgWellbeing(entries: DiaryEntry[], days = 30): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recent = entries.filter((e) => e.date >= cutoffStr);
  return averageAnalysis(recent).avgDailyWellbeing;
}
