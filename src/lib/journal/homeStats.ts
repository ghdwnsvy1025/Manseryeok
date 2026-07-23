/**
 * E — 홈 통계용 journal A 집계 (1~10)
 */
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { bestWorstCategories } from "@/lib/journal/d1Aggregates";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  progressFromTotalXp,
  totalJournalXp,
  type PersonalizationLevelProgress,
} from "@/lib/product/personalizationLevel";

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 하루 행복도: overallSatisfaction 우선, 없으면 finalScore 평균 */
export function dayHappiness(entry: JournalEntry): number | null {
  if (entry.overallSatisfaction != null) return entry.overallSatisfaction;
  const vals = entry.scores
    .filter((s) => !s.isNotApplicable && s.finalScore != null)
    .map((s) => s.finalScore as number);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function averageHappinessInRange(
  entries: JournalEntry[],
  from: string,
  to: string
): number | null {
  const vals: number[] = [];
  for (const e of entries) {
    if (e.entryDate < from || e.entryDate > to) continue;
    const h = dayHappiness(e);
    if (h != null) vals.push(h);
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export type HappinessPoint = { date: string; value: number };

export function happinessSeries(
  entries: JournalEntry[],
  from: string,
  to: string
): HappinessPoint[] {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    if (e.entryDate < from || e.entryDate > to) continue;
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }
  const points: HappinessPoint[] = [];
  for (const e of Array.from(byDate.values()).sort((a, b) =>
    a.entryDate.localeCompare(b.entryDate)
  )) {
    const h = dayHappiness(e);
    if (h != null) points.push({ date: e.entryDate, value: h });
  }
  return points;
}

export type HomeEStats = {
  avg7: number | null;
  avg30: number | null;
  series30: HappinessPoint[];
  best: { code: CategoryCode; name: string; average: number } | null;
  worst: { code: CategoryCode; name: string; average: number } | null;
  level: PersonalizationLevelProgress;
  uniqueDays: number;
};

export function buildHomeEStats(
  entries: JournalEntry[],
  today: string,
  enabledCodes: CategoryCode[]
): HomeEStats {
  const from7 = shiftDate(today, -6);
  const from30 = shiftDate(today, -29);
  const { best, worst } = bestWorstCategories(
    entries,
    from7,
    today,
    enabledCodes
  );

  return {
    avg7: averageHappinessInRange(entries, from7, today),
    avg30: averageHappinessInRange(entries, from30, today),
    series30: happinessSeries(entries, from30, today),
    best: best
      ? {
          code: best.code,
          name: getCategoryByCode(best.code)?.name ?? best.code,
          average: best.average,
        }
      : null,
    worst: worst
      ? {
          code: worst.code,
          name: getCategoryByCode(worst.code)?.name ?? worst.code,
          average: worst.average,
        }
      : null,
    level: progressFromTotalXp(totalJournalXp(entries)),
    uniqueDays: new Set(entries.map((e) => e.entryDate)).size,
  };
}

/** 카테고리별 시계열 (통계 I용) */
export function categorySeries(
  entries: JournalEntry[],
  code: CategoryCode,
  from: string,
  to: string
): HappinessPoint[] {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    if (e.entryDate < from || e.entryDate > to) continue;
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }
  const points: HappinessPoint[] = [];
  for (const e of Array.from(byDate.values()).sort((a, b) =>
    a.entryDate.localeCompare(b.entryDate)
  )) {
    const s = e.scores.find((x) => x.categoryCode === code);
    if (!s || s.isNotApplicable || s.finalScore == null) continue;
    points.push({ date: e.entryDate, value: s.finalScore });
  }
  return points;
}
