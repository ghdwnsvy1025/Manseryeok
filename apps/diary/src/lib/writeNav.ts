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
