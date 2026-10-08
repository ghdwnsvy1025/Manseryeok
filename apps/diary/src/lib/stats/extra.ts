// 행복도 말고 보여 주는 지표 (2026-10-09 사용자 결정 Q4: 포인트 실행률 · 기분 분포 · 연속 기록) + 30일 그래프 데이터 (Q7).
// 전부 이미 저장된 기록에서 읽을 때 계산한다. 행복도 자체는 바꾸지 않는다 (Q3: 사용자가 매긴 숫자 그대로).
import { addDays } from "../time";

export interface StatEntry {
  entry_date: string;
  happiness: number;
  moods?: string[] | null;
  promise?: "kept" | "missed" | "na" | null;
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

export interface SeriesPoint {
  date: string;
  /** 그날 행복도(1~10). 기록 없으면 null — 그래프에서 끊긴다 */
  happiness: number | null;
  /** 행복도를 운세와 같은 10점 척도로 ((h−1)/9×10). null이면 끊김 */
  happiness10: number | null;
  /** 그날까지 7일 창 안 기록들의 평균(10점 척도). 창 안 기록이 2건 미만이면 null */
  avg7: number | null;
  /** 그날 운세 점수(10점). 운세를 안 연 날은 null — 비워 둔다 (사용자 결정) */
  fortune: number | null;
}

/** 오늘 포함 최근 days일. 오래된 날 → 오늘 순 */
export function happinessSeries(entries: StatEntry[], fortunes: { fortune_date: string; score: number }[], today: string, days = 30): SeriesPoint[] {
  const byDate = new Map(entries.map((e) => [e.entry_date, e.happiness]));
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
    });
  }
  return out;
}
