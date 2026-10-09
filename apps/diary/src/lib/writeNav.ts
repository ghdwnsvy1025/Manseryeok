// 쓰기 화면의 날짜 앞뒤 이동 (B7). 순수 함수 — 화면은 결과만 그린다.
import { EARLIEST_ENTRY_DATE } from "./entry";
import { addDays, parseYmd } from "./time";

export interface WriteDateLinks {
  /** 하루 전 `/write?date=`. 가장 이른 날(2020-01-01)이면 null */
  prev: string | null;
  /** 하루 뒤 `/write?date=`. 오늘이면 null — 내일 기록은 없다 */
  next: string | null;
}

export function writeDateLinks(date: string, today: string): WriteDateLinks {
  if (!parseYmd(date) || !parseYmd(today)) return { prev: null, next: null };
  const prev = date > EARLIEST_ENTRY_DATE ? addDays(date, -1) : null;
  const next = date < today ? addDays(date, 1) : null;
  return {
    prev: prev ? `/write?date=${prev}` : null,
    next: next ? `/write?date=${next}` : null,
  };
}

/** 이 시각(한국) 전까지는 날짜 없이 쓰기를 열 때 "어젯밤" 기록으로 연다 (2026-10-09 사용자 결정: 밤 일기가 자정을 넘기는 일이 많다) */
export const NIGHT_CUTOFF_HOUR = 4;

/**
 * 0~4시에 날짜 없이 쓰기를 열었고 어제 기록이 아직 없으면 어제 날짜. 아니면 null(오늘 그대로).
 * 어제 기록이 이미 있으면 오늘로 — 두 번 쓰지 않게.
 */
export function nightCarryDate(today: string, hour: number, hasYesterdayEntry: boolean): string | null {
  if (hour >= NIGHT_CUTOFF_HOUR || hasYesterdayEntry) return null;
  return addDays(today, -1);
}

export interface ResolvedWriteDate {
  date: string;
  /** 요청한 날짜가 없거나 잘못됐거나 미래(또는 2020-01-01 이전)라 오늘로 바꿨으면 true → "오늘 날짜로 열었어요" */
  adjusted: boolean;
}

/** `/write?date=` 값을 실제 열 날짜로. 값이 없으면 오늘(adjusted=false), 잘못됐거나 미래면 오늘(adjusted=true) */
export function resolveWriteDate(param: string | null | undefined, today: string): ResolvedWriteDate {
  if (param == null || param === "") return { date: today, adjusted: false };
  const ok = !!parseYmd(param) && param <= today && param >= EARLIEST_ENTRY_DATE;
  return ok ? { date: param, adjusted: false } : { date: today, adjusted: true };
}
