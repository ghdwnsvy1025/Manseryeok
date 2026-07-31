/**
 * 앱 콘텐츠 진입 잠금 — 로그인 화면에서 Google/비로그인을 고르기 전엔 잠김.
 */
const ENTRY_KEY = "manseryeok_entry_unlocked_v1";
export const ENTRY_CHANGED_EVENT = "manseryeok:entry-changed";

export function isEntryUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ENTRY_KEY) === "1";
  } catch {
    return false;
  }
}

function notifyEntryChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ENTRY_CHANGED_EVENT));
}

export function unlockEntry(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENTRY_KEY, "1");
  } catch {
    /* ignore */
  }
  notifyEntryChanged();
}

export function lockEntry(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ENTRY_KEY);
  } catch {
    /* ignore */
  }
  notifyEntryChanged();
}

/** 사주 등록 중 등 — 헤더/하단 네비 숨김 */
const HIDE_CHROME_KEY = "manseryeok_hide_shell_chrome_v1";

export function hideShellChrome(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(HIDE_CHROME_KEY, "1");
  } catch {
    /* ignore */
  }
  notifyEntryChanged();
}

export function showShellChrome(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(HIDE_CHROME_KEY);
  } catch {
    /* ignore */
  }
  notifyEntryChanged();
}

export function isShellChromeHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(HIDE_CHROME_KEY) === "1";
  } catch {
    return false;
  }
}
