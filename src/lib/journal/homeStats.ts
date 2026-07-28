/**
 * E — 홈 통계용 journal A 집계 (1~10)
 */
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { bestWorstCategories } from "@/lib/journal/d1Aggregates";
import {
  CORE_STATE_CODES,
  DOMAIN_POOL_CODES,
} from "@/lib/journal/checkin/catalog";
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

export type CategoryAverage = {
  code: CategoryCode;
  name: string;
  average: number;
};

function toNamed(
  row: { code: CategoryCode; average: number } | null
): CategoryAverage | null {
  if (!row) return null;
  return {
    code: row.code,
    name: getCategoryByCode(row.code)?.name ?? row.code,
    average: row.average,
  };
}

export type HomeEStats = {
  avg7: number | null;
  avg30: number | null;
  series30: HappinessPoint[];
  /** 핵심 상태 Best/Worst (매일 필수 4항목) */
  coreBest: CategoryAverage | null;
  coreWorst: CategoryAverage | null;
  /** 선택 생활영역 Best/Worst (찍힌 날만 평균) */
  domainBest: CategoryAverage | null;
  domainWorst: CategoryAverage | null;
  /**
   * @deprecated coreBest 와 동일 — 기존 호출부 호환
   */
  best: CategoryAverage | null;
  /**
   * @deprecated coreWorst 와 동일 — 기존 호출부 호환
   */
  worst: CategoryAverage | null;
  level: PersonalizationLevelProgress;
  uniqueDays: number;
};

export function buildHomeEStats(
  entries: JournalEntry[],
  today: string,
  _enabledCodes: CategoryCode[]
): HomeEStats {
  const from7 = shiftDate(today, -6);
  const from30 = shiftDate(today, -29);

  // 핵심/선택은 체크인 카탈로그 기준으로 분리 비교 (설정 enabled 와 무관)
  const core = bestWorstCategories(
    entries,
    from7,
    today,
    [...CORE_STATE_CODES]
  );
  const domain = bestWorstCategories(
    entries,
    from7,
    today,
    [...DOMAIN_POOL_CODES]
  );

  const coreBest = toNamed(core.best);
  const coreWorst = toNamed(core.worst);
  const domainBest = toNamed(domain.best);
  const domainWorst = toNamed(domain.worst);

  return {
    avg7: averageHappinessInRange(entries, from7, today),
    avg30: averageHappinessInRange(entries, from30, today),
    series30: happinessSeries(entries, from30, today),
    coreBest,
    coreWorst,
    domainBest,
    domainWorst,
    best: coreBest,
    worst: coreWorst,
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
