import {
  NEGATIVE_SCORE_KEYS,
  POSITIVE_SCORE_KEYS,
  type DiaryAnalysis,
} from "./dimensions";
import { getPillarsForDate } from "./dayPillar";
import type { DayPillarStats, DiaryEntry, GroupStats, StatsGroupType } from "./types";

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

export function resolveYearPillarKo(entry: DiaryEntry): string | null {
  if (entry.yearPillarKo) return entry.yearPillarKo;
  try {
    return getPillarsForDate(entry.date).yearPillarKo;
  } catch {
    return null;
  }
}

export function resolveMonthPillarKo(entry: DiaryEntry): string | null {
  if (entry.monthPillarKo) return entry.monthPillarKo;
  try {
    return getPillarsForDate(entry.date).monthPillarKo;
  } catch {
    return null;
  }
}

export function getGroupKey(entry: DiaryEntry, type: StatsGroupType): string | null {
  switch (type) {
    case "year":
      return resolveYearPillarKo(entry);
    case "month":
      return resolveMonthPillarKo(entry);
    case "ganji":
      return entry.dayPillar.ganjiKo;
    case "stem":
      return entry.dayPillar.stem.ko;
    case "branch":
      return entry.dayPillar.branch.ko;
    default:
      return null;
  }
}

export function getGroupLabel(key: string, type: StatsGroupType): string {
  switch (type) {
    case "year":
      return `${key}년`;
    case "month":
      return `${key}월`;
    case "ganji":
      return `${key}일`;
    case "stem":
    case "branch":
      return key;
    default:
      return key;
  }
}

export function getOverallAvgWellbeing(entries: DiaryEntry[]): number {
  return averageAnalysis(entries).avgDailyWellbeing;
}

function buildGroupStats(
  groupType: StatsGroupType,
  key: string,
  matched: DiaryEntry[],
  overallAvg: number
): GroupStats {
  const sorted = [...matched].sort((a, b) => a.date.localeCompare(b.date));
  const { avgDailyWellbeing, avgScores } = averageAnalysis(sorted);

  return {
    groupType,
    key,
    label: getGroupLabel(key, groupType),
    entryCount: sorted.length,
    analyzedCount: sorted.filter((e) => e.analysis !== null).length,
    avgDailyWellbeing,
    avgScores,
    dates: sorted.map((e) => e.date),
    deltaFromOverall:
      avgDailyWellbeing > 0 ? avgDailyWellbeing - overallAvg : undefined,
  };
}

export function getEntriesForGroup(
  key: string,
  groupType: StatsGroupType,
  entries: DiaryEntry[]
): DiaryEntry[] {
  return entries
    .filter((e) => getGroupKey(e, groupType) === key)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getStatsForGroup(
  key: string,
  groupType: StatsGroupType,
  entries: DiaryEntry[],
  overallAvg?: number
): GroupStats {
  const matched = entries.filter((e) => getGroupKey(e, groupType) === key);
  const baseline = overallAvg ?? getOverallAvgWellbeing(entries);
  return buildGroupStats(groupType, key, matched, baseline);
}

export function aggregateByGroup(
  entries: DiaryEntry[],
  groupType: StatsGroupType
): GroupStats[] {
  const groups = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = getGroupKey(entry, groupType);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const overallAvg = getOverallAvgWellbeing(entries);

  return Array.from(groups.entries())
    .map(([key, group]) => buildGroupStats(groupType, key, group, overallAvg))
    .sort((a, b) => b.entryCount - a.entryCount);
}

export function getStatsForPillar(ganjiKo: string, entries: DiaryEntry[]): DayPillarStats {
  const stats = getStatsForGroup(ganjiKo, "ganji", entries);
  return {
    ganjiKo: stats.key,
    entryCount: stats.entryCount,
    analyzedCount: stats.analyzedCount,
    avgDailyWellbeing: stats.avgDailyWellbeing,
    avgScores: stats.avgScores,
    dates: stats.dates,
  };
}

export function aggregateByDayPillar(entries: DiaryEntry[]): DayPillarStats[] {
  return aggregateByGroup(entries, "ganji").map((s) => ({
    ganjiKo: s.key,
    entryCount: s.entryCount,
    analyzedCount: s.analyzedCount,
    avgDailyWellbeing: s.avgDailyWellbeing,
    avgScores: s.avgScores,
    dates: s.dates,
  }));
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

export function getUniqueEntryDays(entries: DiaryEntry[]): number {
  return new Set(entries.map((e) => e.date)).size;
}

export function getDaysUntilInsight(entries: DiaryEntry[], minDays = 7): number {
  return Math.max(0, minDays - getUniqueEntryDays(entries));
}

export function getWellbeingInsightCards(
  entries: DiaryEntry[],
  limit = 3,
  groupType: StatsGroupType = "ganji"
): GroupStats[] {
  return aggregateByGroup(entries, groupType)
    .filter((s) => s.entryCount >= 2 && s.avgDailyWellbeing > 0)
    .sort((a, b) => b.avgDailyWellbeing - a.avgDailyWellbeing)
    .slice(0, limit);
}
