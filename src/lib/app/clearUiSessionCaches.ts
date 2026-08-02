/**
 * 로그아웃·계정 전환 시 UI 캐시 일괄 삭제.
 * 사주 프로필 스냅샷과 별개로, 다른 사용자 문구/초안이 남지 않게 한다.
 */

const EXACT_KEYS = [
  "manseryeok:last-saved-checkin:v2",
  "manseryeok:home-sentence-cache:v1",
  "manseryeok:recent-status:v1",
  "manseryeok:week-topic-support:v4",
  "manseryeok:keyword-bias:v1",
  "manseryeok:day-quote-cache:v1",
] as const;

const PREFIXES = [
  "manseryeok:today-fortune-v2.10:",
  "manseryeok:today-question-v3:",
  "manseryeok:checkin-draft:v1:",
  "manseryeok:day-quote-cache:v2:",
  "manseryeok:question-feedback:",
  "manseryeok:content-feedback:",
  "manseryeok:content-exposure:",
] as const;

function removeExact(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

function removeByPrefixes(store: Storage, prefixes: readonly string[]): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key) continue;
      if (prefixes.some((p) => key.startsWith(p))) toRemove.push(key);
    }
    for (const key of toRemove) store.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** 현재 기기 local/session 의 사용자 민감 UI 캐시를 비운다. */
export function clearUiSessionCaches(): void {
  if (typeof window === "undefined") return;

  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const key of EXACT_KEYS) {
      removeExact(store, key);
    }
    removeByPrefixes(store, PREFIXES);
  }
}
