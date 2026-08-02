const FIRST_VISIT_WELCOME_KEY = "manseryeok_first_visit_welcome_v2";

/** 환영 오버레이가 홈 연출을 가릴 때 — 닫힌 뒤 재생용 */
export const WELCOME_OVERLAY_EVENT = "manseryeok:welcome-overlay";

export type WelcomeOverlayPhase = "idle" | "pending" | "open" | "closed";

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

/** 환영 장면은 로그인 후 홈(/)에서만 (ClientShell에서 잠금 해제 후 마운트) */
export function isFirstVisitWelcomePath(pathname: string): boolean {
  return pathname === "/";
}

export function setWelcomeOverlayPhase(phase: WelcomeOverlayPhase): void {
  if (typeof window === "undefined") return;
  const blocking = phase === "pending" || phase === "open";
  document.documentElement.dataset.welcomeOverlay = blocking ? "1" : "0";
  window.dispatchEvent(
    new CustomEvent(WELCOME_OVERLAY_EVENT, { detail: { phase } })
  );
}

export function isWelcomeOverlayBlocking(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.dataset.welcomeOverlay === "1";
}

/**
 * 환영 창이 홈을 가리는 동안 false.
 * 이미 본 적이 있거나 창이 닫히면 true → 등장 연출 시작.
 */
export function shouldDeferHomeMotion(pathname: string): boolean {
  if (!isFirstVisitWelcomePath(pathname)) return false;
  if (hasSeenFirstVisitWelcome()) return false;
  return true;
}
