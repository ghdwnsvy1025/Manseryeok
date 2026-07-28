/**
 * Journal 연속 기록(스트릭)
 * - 오늘 기록이 있으면 오늘부터 거꾸로 센다
 * - 오늘만 비어 있고 어제까지 이어지면 어제부터 센다 (오늘 아직 안 쓴 상태 허용)
 * - 이틀 이상 비면 0
 */
import { todayDateString } from "@/lib/diary/dayPillar";

export const JOURNAL_PROGRESS_CHANGED_EVENT =
  "manseryeok_journal_progress_changed";

export function notifyJournalProgressChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(JOURNAL_PROGRESS_CHANGED_EVENT));
}

function shiftIsoDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type JournalStreak = {
  /** 연속 기록 일수 (오늘 미기록이어도 어제까지면 유지) */
  days: number;
  /** 오늘 일기가 있는지 */
  recordedToday: boolean;
  /** 스트릭이 '위험' 상태 — 오늘 아직 안 써서 끊길 수 있음 */
  atRisk: boolean;
};

export function computeJournalStreak(
  entryDates: Iterable<string>,
  today: string = todayDateString()
): JournalStreak {
  const dateSet = new Set<string>();
  for (const d of entryDates) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dateSet.add(d);
  }

  const recordedToday = dateSet.has(today);
  let cursor = today;
  if (!recordedToday) {
    const yesterday = shiftIsoDate(today, -1);
    if (!dateSet.has(yesterday)) {
      return { days: 0, recordedToday: false, atRisk: false };
    }
    cursor = yesterday;
  }

  let days = 0;
  while (dateSet.has(cursor)) {
    days += 1;
    cursor = shiftIsoDate(cursor, -1);
  }

  return {
    days,
    recordedToday,
    atRisk: days > 0 && !recordedToday,
  };
}
