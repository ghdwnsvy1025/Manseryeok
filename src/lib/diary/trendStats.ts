import { filterRealEntries } from "./dataOrigin";
import type { HappinessRating } from "./happiness";
import type { ConditionRating, DiaryEntry } from "./types";

export type TrendPoint = {
  date: string;
  value: number | null;
  label: string;
};

export type RatingTrend = {
  days: number;
  kind: "happiness" | "condition";
  points: TrendPoint[];
  sampleSize: number;
  average: number | null;
};

function dateOffset(base: Date, delta: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function buildRatingTrend(
  entries: DiaryEntry[],
  days: number,
  kind: "happiness" | "condition",
  endDate: Date = new Date()
): RatingTrend {
  const real = filterRealEntries(entries).filter(
    (e) => e.happinessSource !== "default"
  );
  const byDate = new Map(real.map((e) => [e.date, e]));
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const points: TrendPoint[] = [];
  const values: number[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = dateOffset(end, -i);
    const entry = byDate.get(date);
    let value: number | null = null;
    if (entry) {
      if (kind === "happiness" && typeof entry.happinessRating === "number") {
        value = entry.happinessRating;
      }
      if (kind === "condition" && typeof entry.conditionRating === "number") {
        value = entry.conditionRating;
      }
    }
    if (value != null) values.push(value);
    points.push({
      date,
      value,
      label: date.slice(5),
    });
  }

  return {
    days,
    kind,
    points,
    sampleSize: values.length,
    average:
      values.length > 0
        ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
        : null,
  };
}

export function weekdayAverages(entries: DiaryEntry[]): Array<{
  weekday: number;
  label: string;
  avgHappiness: number | null;
  sampleSize: number;
}> {
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  const real = filterRealEntries(entries);
  return labels.map((label, weekday) => {
    const matched = real.filter(
      (e) => e.weekday === weekday && typeof e.happinessRating === "number"
    );
    const vals = matched.map((e) => e.happinessRating as HappinessRating);
    return {
      weekday,
      label,
      avgHappiness:
        vals.length > 0
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : null,
      sampleSize: vals.length,
    };
  });
}

export function weekendComparison(entries: DiaryEntry[]): {
  weekdayAvg: number | null;
  weekendAvg: number | null;
  weekdaySample: number;
  weekendSample: number;
} {
  const real = filterRealEntries(entries);
  const weekday = real.filter(
    (e) => e.isWeekend === false && typeof e.happinessRating === "number"
  );
  const weekend = real.filter(
    (e) => e.isWeekend === true && typeof e.happinessRating === "number"
  );
  const avg = (list: DiaryEntry[]) => {
    const vals = list.map((e) => e.happinessRating as HappinessRating);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };
  return {
    weekdayAvg: avg(weekday),
    weekendAvg: avg(weekend),
    weekdaySample: weekday.length,
    weekendSample: weekend.length,
  };
}

export function topEmotions(entries: DiaryEntry[], limit = 5): Array<{ emotion: string; count: number }> {
  const counts = new Map<string, number>();
  for (const entry of filterRealEntries(entries)) {
    for (const emotion of entry.emotions ?? []) {
      counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([emotion, count]) => ({ emotion, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function monthAverage(
  entries: DiaryEntry[],
  year: number,
  month: number
): { avgHappiness: number | null; avgCondition: number | null; sampleSize: number } {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const matched = filterRealEntries(entries).filter((e) => e.date.startsWith(prefix));
  const h = matched
    .map((e) => e.happinessRating)
    .filter((v): v is HappinessRating => typeof v === "number");
  const c = matched
    .map((e) => e.conditionRating)
    .filter((v): v is ConditionRating => typeof v === "number");
  return {
    avgHappiness:
      h.length > 0 ? Math.round((h.reduce((a, b) => a + b, 0) / h.length) * 10) / 10 : null,
    avgCondition:
      c.length > 0 ? Math.round((c.reduce((a, b) => a + b, 0) / c.length) * 10) / 10 : null,
    sampleSize: matched.length,
  };
}

export function happinessRankInRecentDays(
  entries: DiaryEntry[],
  date: string,
  days = 7
): { rank: number; total: number } | null {
  const end = new Date(`${date}T12:00:00`);
  const trend = buildRatingTrend(entries, days, "happiness", end);
  const today = trend.points.find((p) => p.date === date);
  if (today?.value == null) return null;
  const scored = trend.points
    .filter((p) => p.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const rank = scored.findIndex((p) => p.date === date) + 1;
  if (rank <= 0) return null;
  return { rank, total: scored.length };
}
