// 날짜는 모두 한국 시간 기준 "YYYY-MM-DD" 문자열로 다룬다.
// 기록의 날짜·일진이 서버(UTC)와 브라우저 시간대에 따라 하루 어긋나지 않게 하려는 것.

export const APP_TIMEZONE = "Asia/Seoul";

const ymdFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  hour: "numeric",
  hourCycle: "h23",
});

export function todayKST(now: Date = new Date()): string {
  return ymdFormatter.format(now);
}

export function hourKST(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

export interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** 형식과 달력상 존재 여부까지 확인한다. 2026-02-30 같은 값은 null. */
export function parseYmd(value: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function addDays(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) throw new Error(`잘못된 날짜: ${ymd}`);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "10월 4일 토요일" */
export function formatKoreanDate(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const weekday = WEEKDAYS[new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()];
  return `${p.month}월 ${p.day}일 ${weekday}요일`;
}
