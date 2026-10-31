// 행복도 말고 보여 주는 지표 (2026-10-09 사용자 결정 Q4: 포인트 실행률 · 기분 분포 · 연속 기록) + 30일 그래프 데이터 (Q7).
// 전부 이미 저장된 기록에서 읽을 때 계산한다. 행복도 자체는 바꾸지 않는다 (Q3: 사용자가 매긴 숫자 그대로).
import { addDays } from "../time";
import { AREAS, type AreaKey, type Areas } from "../entry";

export interface StatEntry {
  entry_date: string;
  happiness: number;
  moods?: string[] | null;
  promise?: "kept" | "missed" | "na" | null;
  /** 영역별 5단계 (2026-10-31). 이전 기록은 null */
  areas?: Areas | null;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function mean(xs: number[]): number | null {
  return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

export interface PointStats {
  /** 해봤어요 + 못 했어요 (해당 없음·빈칸 제외) */
  answered: number;
  kept: number;
  /** 0~100 정수. answered가 0이면 null */
  rate: number | null;
  /** 해본 날 평균 행복도 / 못 한 날 평균 행복도 */
  keptMean: number | null;
  missedMean: number | null;
  /** v3.15: 최근 답 7개(최신 → 오래된). 도장 점 줄 */
  recent: ("kept" | "missed")[];
}

/** 오늘의 포인트("하면 좋아요")를 해본 비율과, 해본 날·못 한 날의 행복도 */
export function pointStats(entries: StatEntry[]): PointStats {
  const kept = entries.filter((e) => e.promise === "kept");
  const missed = entries.filter((e) => e.promise === "missed");
  const answered = kept.length + missed.length;
  return {
    answered,
    kept: kept.length,
    rate: answered ? Math.round((100 * kept.length) / answered) : null,
    keptMean: mean(kept.map((e) => e.happiness)),
    missedMean: mean(missed.map((e) => e.happiness)),
    recent: entries
      .filter((e) => e.promise === "kept" || e.promise === "missed")
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, 7)
      .map((e) => e.promise as "kept" | "missed"),
  };
}

export interface MoodCount {
  mood: string;
  n: number;
  /** 그 기분을 고른 날의 평균 행복도 */
  mean: number | null;
}

/** 자주 고른 기분 상위 limit개. 같은 횟수면 평균 행복도가 높은 쪽 먼저 */
export function moodTop(entries: StatEntry[], limit = 3): MoodCount[] {
  const acc = new Map<string, number[]>();
  for (const e of entries) for (const m of e.moods ?? []) acc.set(m, [...(acc.get(m) ?? []), e.happiness]);
  return [...acc.entries()]
    .map(([mood, hs]) => ({ mood, n: hs.length, mean: mean(hs) }))
    .sort((a, b) => b.n - a.n || (b.mean ?? 0) - (a.mean ?? 0))
    .slice(0, limit);
}

export interface Streak {
  /** 오늘(또는 어제)까지 이어진 날 수. 오늘 아직 안 썼어도 어제까지 이어졌으면 그 수 */
  current: number;
  best: number;
}

/** 연속 기록. 날짜 문자열(YYYY-MM-DD)만 본다 */
export function streakOf(entries: StatEntry[], today: string): Streak {
  const days = new Set(entries.map((e) => e.entry_date));
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && addDays(sorted[i - 1]!, 1) === sorted[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return { current, best };
}

export interface Habit {
  current: number;
  best: number;
  /** 이번 달 기록한 날 수 */
  thisMonth: number;
  /** 최근 30일 중 기록한 날 비율 (0~100) */
  rate30: number;
  total: number;
  /** v3.22 최근 30일, 오래된 날 → 오늘 순. true = 기록함 */
  last30: boolean[];
}

/** v3.21 기록 습관: 연속 · 최고 연속 · 이번 달 · 최근 30일 기록률 · 전체 */
export function habitOf(entries: StatEntry[], today: string): Habit {
  const s = streakOf(entries, today);
  const days = new Set(entries.map((e) => e.entry_date));
  const dots: boolean[] = [];
  for (let i = 29; i >= 0; i--) dots.push(days.has(addDays(today, -i)));
  const last30 = dots.filter(Boolean).length;
  return {
    current: s.current,
    best: s.best,
    thisMonth: [...days].filter((d) => d.startsWith(today.slice(0, 7))).length,
    rate30: Math.round((100 * last30) / 30),
    total: days.size,
    last30: dots,
  };
}

export interface SeriesPoint {
  date: string;
  /** 그날 행복도(1~10). 기록 없으면 null — 그래프에서 끊긴다 */
  happiness: number | null;
  /** 행복도를 운세와 같은 10점 척도로 ((h−1)/9×10). null이면 끊김 */
  happiness10: number | null;
  /** 그날까지 7일 창 안 기록들의 평균(10점 척도). 창 안 기록이 2건 미만이면 null */
  avg7: number | null;
  /** 그날 운세 점수(10점). 운세를 안 연 날은 null */
  fortune: number | null;
  /** 그날 영역별 5단계 (2026-10-31). 그래프 칩으로 영역 선을 볼 때 */
  areas: Areas | null;
}

/**
 * 그래프가 기록과 함께 자라게 (2026-10-09 사용자 결정): 첫 기록 날부터 오늘까지만 남긴다(최대 days일).
 * 이틀 기록하면 이틀이 가로 전체, 30일을 넘으면 최근 30일. 첫 기록 앞의 빈 날은 버리고, 그 뒤 빈 날은 null 그대로 비운다.
 */
export function growingSeries(series: SeriesPoint[]): SeriesPoint[] {
  const first = series.findIndex((p) => p.happiness !== null);
  return first < 0 ? [] : series.slice(first);
}

/** 오늘 포함 최근 days일. 오래된 날 → 오늘 순 */
export function happinessSeries(entries: StatEntry[], fortunes: { fortune_date: string; score: number }[], today: string, days = 30): SeriesPoint[] {
  const byDate = new Map(entries.map((e) => [e.entry_date, e.happiness]));
  const areasByDate = new Map(entries.map((e) => [e.entry_date, e.areas ?? null]));
  const fByDate = new Map(fortunes.map((f) => [f.fortune_date, Number(f.score)]));
  const to10 = (h: number) => round1(((h - 1) / 9) * 10);
  const out: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const h = byDate.get(date) ?? null;
    const win: number[] = [];
    for (let k = 0; k < 7; k++) {
      const v = byDate.get(addDays(date, -k));
      if (v !== undefined) win.push(to10(v));
    }
    out.push({
      date,
      happiness: h,
      happiness10: h === null ? null : to10(h),
      avg7: win.length >= 2 ? mean(win) : null,
      fortune: fByDate.has(date) ? round1(fByDate.get(date)!) : null,
      areas: areasByDate.get(date) ?? null,
    });
  }
  return out;
}

/** 행복도(1~10)를 그래프의 10점 척도로 — happinessSeries와 같은 식 */
export function happinessTo10(h: number): number {
  return round1(((h - 1) / 9) * 10);
}

/** 영역 5단계 → 그래프 10점 척도. 하루 행복도와 같은 식(단계 × 2를 행복도로 본다) */
export function areaTo10(level: number): number {
  return happinessTo10(level * 2);
}

export interface AreaAverage {
  key: AreaKey;
  label: string;
  /** 최근 days일 평균 단계(1~5, 소수 한 자리). 매긴 날이 없으면 null */
  mean: number | null;
  /** 매긴 날 수 */
  n: number;
}

/** 최근 days일(오늘 포함) 영역별 평균 단계 (2026-10-31, 나 탭 영역 막대). 영역 순서는 AREAS 그대로 */
export function areaAverages(entries: StatEntry[], today: string, days = 30): AreaAverage[] {
  const from = addDays(today, -(days - 1));
  const recent = entries.filter((e) => e.entry_date >= from && e.entry_date <= today && e.areas);
  return AREAS.map((a) => {
    const vals = recent.map((e) => e.areas?.[a.key]).filter((v): v is number => typeof v === "number");
    return { key: a.key, label: a.label, mean: mean(vals), n: vals.length };
  });
}

export interface PickedDay {
  date: string;
  happiness: number;
  moods: string[];
}

/**
 * 가장 행복한 날·가장 힘든 날 하루씩 (2026-10-31). 같은 점수면 최근 날. 기록이 하나뿐이거나 모두 같은 점수면 힘든 날은 없다.
 * month("YYYY-MM")를 주면 그 달 기록에서만.
 */
export function bestWorstDays(entries: StatEntry[], month?: string): { best: PickedDay | null; worst: PickedDay | null } {
  const list = month ? entries.filter((e) => e.entry_date.startsWith(month)) : entries;
  if (list.length === 0) return { best: null, worst: null };
  const pick = (better: (a: StatEntry, b: StatEntry) => boolean) =>
    list.reduce((acc, e) => (better(e, acc) || (e.happiness === acc.happiness && e.entry_date > acc.entry_date) ? e : acc));
  const best = pick((a, b) => a.happiness > b.happiness);
  const worst = pick((a, b) => a.happiness < b.happiness);
  const day = (e: StatEntry): PickedDay => ({ date: e.entry_date, happiness: e.happiness, moods: e.moods ?? [] });
  return { best: day(best), worst: worst.happiness < best.happiness ? day(worst) : null };
}
