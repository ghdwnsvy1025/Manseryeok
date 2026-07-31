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

/** 소개 팝업을 띄울 메인 탭·관련 경로 */
export function isFirstVisitWelcomePath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/journal")) return true;
  if (pathname.startsWith("/stats")) return true;
  if (pathname.startsWith("/diary") && !pathname.startsWith("/diary/login")) {
    return true;
  }
  return false;
}
