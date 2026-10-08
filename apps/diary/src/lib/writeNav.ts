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
