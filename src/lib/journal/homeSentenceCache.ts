/**
 * 홈 「오늘의 한 문장」일일 캐시 — 한 번 보면 그날은 재계산하지 않음.
 */
export const HOME_SENTENCE_CACHE_KEY = "manseryeok:home-sentence-cache:v1";

export type HomeSentenceCache = {
  localDate: string;
  status: string;
  message: string;
  detail: string | null;
  at: number;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function peekHomeSentence(): HomeSentenceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(HOME_SENTENCE_CACHE_KEY) ??
      window.localStorage.getItem(HOME_SENTENCE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeSentenceCache;
    if (!parsed?.localDate || !parsed.message) return null;
    if (parsed.localDate !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setHomeSentence(
  payload: Omit<HomeSentenceCache, "localDate" | "at">
): void {
  if (typeof window === "undefined") return;
  try {
    const full: HomeSentenceCache = {
      ...payload,
      localDate: todayKey(),
      at: Date.now(),
    };
    const raw = JSON.stringify(full);
    window.sessionStorage.setItem(HOME_SENTENCE_CACHE_KEY, raw);
    window.localStorage.setItem(HOME_SENTENCE_CACHE_KEY, raw);
  } catch {
    /* ignore */
  }
}
