/**
 * 하루 동안 같은 「오늘의 명언/문장」을 재사용.
 * 서버 delivery 캐시와 별도로, 게스트·재방문·수정 저장에서도 즉시 복원.
 */
export const DAY_QUOTE_CACHE_KEY = "manseryeok:day-quote-cache:v1";

export type DayQuoteCache = {
  entryDate: string;
  quote: string;
  contentType: string | null;
  sourceLabel: string | null;
  authorName: string | null;
  workTitle: string | null;
  deliveryId: string | null;
  at: number;
};

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.sessionStorage.getItem(DAY_QUOTE_CACHE_KEY);
    if (s) return s;
  } catch {
    /* ignore */
  }
  try {
    return window.localStorage.getItem(DAY_QUOTE_CACHE_KEY);
  } catch {
    return null;
  }
}

function writeRaw(raw: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DAY_QUOTE_CACHE_KEY, raw);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(DAY_QUOTE_CACHE_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function peekDayQuote(entryDate: string): DayQuoteCache | null {
  try {
    const raw = readRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DayQuoteCache;
    if (!parsed?.entryDate || !parsed.quote?.trim()) return null;
    if (parsed.entryDate !== entryDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setDayQuote(cache: DayQuoteCache): void {
  try {
    writeRaw(JSON.stringify({ ...cache, at: Date.now() }));
  } catch {
    /* ignore */
  }
}
