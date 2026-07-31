const FIRST_VISIT_WELCOME_KEY = "manseryeok_first_visit_welcome_v1";

export function hasSeenFirstVisitWelcome(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(FIRST_VISIT_WELCOME_KEY) === "1";
  } catch {
    return true;
  }
}

export function markFirstVisitWelcomeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FIRST_VISIT_WELCOME_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearFirstVisitWelcomeSeen(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(FIRST_VISIT_WELCOME_KEY);
  } catch {
    /* ignore */
  }
}

/** 소개 팝업은 홈(/)에서만 */
export function isFirstVisitWelcomePath(pathname: string): boolean {
  return pathname === "/";
}
