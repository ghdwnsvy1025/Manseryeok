/**
 * 하루 동안 같은 「오늘의 명언/문장」을 재사용.
 * 서버 delivery 캐시와 별도로, 게스트·재방문·수정 저장에서도 즉시 복원.
 * 비로그인/구글은 프로필 지문으로 분리한다.
 */
export const DAY_QUOTE_CACHE_KEY = "manseryeok:day-quote-cache:v1";
const DAY_QUOTE_CACHE_PREFIX_V2 = "manseryeok:day-quote-cache:v2:";

export type DayQuoteCache = {
  entryDate: string;
  quote: string;
  contentType: string | null;
  sourceLabel: string | null;
  authorName: string | null;
  workTitle: string | null;
  deliveryId: string | null;
  at: number;
  /** 사주 프로필 지문 — 없으면 레거시 공통 캐시 */
  profileKey?: string;
};

function scopedKey(entryDate: string, profileKey: string): string {
  return `${DAY_QUOTE_CACHE_PREFIX_V2}${entryDate}:${profileKey || "none"}`;
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.sessionStorage.getItem(key);
    if (s) return s;
  } catch {
    /* ignore */
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, raw: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, raw);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    /* ignore */
  }
}

function parseQuote(raw: string | null, entryDate: string): DayQuoteCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DayQuoteCache;
    if (!parsed?.entryDate || !parsed.quote?.trim()) return null;
    if (parsed.entryDate !== entryDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * @param profileKey 사주 지문(또는 none). 있으면 계정/게스트 분리 캐시 우선.
 */
export function peekDayQuote(
  entryDate: string,
  profileKey?: string | null
): DayQuoteCache | null {
  const pk = profileKey?.trim() || "none";
  const scoped = parseQuote(readRaw(scopedKey(entryDate, pk)), entryDate);
  if (scoped) return scoped;
  // 레거시 단일 키 — 같은 날짜면 허용 (마이그레이션)
  return parseQuote(readRaw(DAY_QUOTE_CACHE_KEY), entryDate);
}

export function setDayQuote(
  cache: DayQuoteCache,
  profileKey?: string | null
): void {
  const pk = profileKey?.trim() || cache.profileKey || "none";
  const payload: DayQuoteCache = {
    ...cache,
    profileKey: pk,
    at: Date.now(),
  };
  try {
    const raw = JSON.stringify(payload);
    writeRaw(scopedKey(cache.entryDate, pk), raw);
    // 하위 호환: 마지막 저장본도 레거시 키에 유지
    writeRaw(DAY_QUOTE_CACHE_KEY, raw);
  } catch {
    /* ignore */
  }
}
