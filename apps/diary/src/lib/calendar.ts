// 나 화면 달력 보기 (2026-10-10 사용자 결정 Q6 = B). 순수 함수 — 화면은 결과만 그린다.
import { EARLIEST_ENTRY_DATE } from "./entry";

export interface CalendarDay {
  /** YYYY-MM-DD. 앞뒤 빈 칸이면 null */
  date: string | null;
  day: number | null;
  happiness: number | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarMonth {
  /** "2026-10" */
  ym: string;
  year: number;
  month: number;
  /** 일요일 시작, 7칸씩 */
  weeks: CalendarDay[][];
  /** 이전·다음 달 "YYYY-MM". 2020-01 이전이나 이번 달 뒤면 null */
  prev: string | null;
  next: string | null;
  /** 이 달 기록 수와 평균 행복도 */
  count: number;
  mean: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "?m=" 값을 검사. 잘못됐거나 미래면 오늘의 달 */
export function resolveMonth(param: string | undefined, today: string): string {
  const cur = today.slice(0, 7);
  if (!param || !/^\d{4}-\d{2}$/.test(param)) return cur;
  const mm = Number(param.slice(5));
  if (mm < 1 || mm > 12) return cur;
  if (param > cur || param < EARLIEST_ENTRY_DATE.slice(0, 7)) return cur;
  return param;
}

function shift(ym: string, delta: number): string {
  let y = Number(ym.slice(0, 4));
  let m = Number(ym.slice(5)) + delta;
  while (m < 1) {
    m += 12;
    y--;
  }
  while (m > 12) {
    m -= 12;
    y++;
  }
  return `${y}-${pad(m)}`;
}

export function buildMonth(ym: string, entries: { entry_date: string; happiness: number }[], today: string): CalendarMonth {
  const year = Number(ym.slice(0, 4));
  const month = Number(ym.slice(5));
  const byDate = new Map(entries.filter((e) => e.entry_date.startsWith(ym)).map((e) => [e.entry_date, e.happiness]));
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarDay[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null, day: null, happiness: null, isToday: false, isFuture: false });
  for (let d = 1; d <= daysIn; d++) {
    const date = `${ym}-${pad(d)}`;
    cells.push({ date, day: d, happiness: byDate.get(date) ?? null, isToday: date === today, isFuture: date > today });
  }
  while (cells.length % 7) cells.push({ date: null, day: null, happiness: null, isToday: false, isFuture: false });
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const hs = [...byDate.values()];
  const prev = shift(ym, -1);
  const next = shift(ym, 1);
  return {
    ym,
    year,
    month,
    weeks,
    prev: prev >= EARLIEST_ENTRY_DATE.slice(0, 7) ? prev : null,
    next: next <= today.slice(0, 7) ? next : null,
    count: hs.length,
    mean: hs.length ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10 : null,
  };
}
