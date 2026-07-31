import { addDaysToDateString } from "@/lib/forecast/tomorrowContext";

/** 기록된 날짜 Set */
export function entryDateSet(
  entries: Array<{ entryDate: string }>
): Set<string> {
  return new Set(entries.map((e) => e.entryDate));
}

/** 어제 ISO (KST 기준 today 기준) */
export function yesterdayOf(todayIso: string): string {
  return addDaysToDateString(todayIso, -1);
}

export function isMissingDate(
  dateIso: string,
  dates: Set<string>,
  todayIso: string
): boolean {
  if (dateIso > todayIso) return false;
  return !dates.has(dateIso);
}

/** 해당 월에서 오늘 이전(포함) 빈 날 수 */
export function countEmptyDaysInMonth(input: {
  year: number;
  month: number;
  todayIso: string;
  dates: Set<string>;
}): number {
  const { year, month, todayIso, dates } = input;
  const lastDay = new Date(year, month, 0).getDate();
  let n = 0;
  for (let d = 1; d <= lastDay; d += 1) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (iso > todayIso) break;
    if (!dates.has(iso)) n += 1;
  }
  return n;
}

/** 최근 lookback일 중 빈 날 (최신순) */
export function listRecentEmptyDays(input: {
  todayIso: string;
  dates: Set<string>;
  lookback?: number;
}): string[] {
  const lookback = input.lookback ?? 30;
  const out: string[] = [];
  for (let i = 1; i <= lookback; i += 1) {
    const iso = addDaysToDateString(input.todayIso, -i);
    if (!input.dates.has(iso)) out.push(iso);
  }
  return out;
}
