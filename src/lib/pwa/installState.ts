const DISMISS_UNTIL_KEY = "manseryeok:install_nudge_until_v1";

/** 홈 설치 유도 숨김 기간 */
export const INSTALL_NUDGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** 카카오톡 인앱 브라우저 — PWA 설치 불가, 외부 브라우저로 열어야 함 */
export function isKakaoTalkInApp(): boolean {
  if (typeof navigator === "undefined") return false;
  return /KAKAOTALK/i.test(navigator.userAgent);
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function isInstallNudgeDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(DISMISS_UNTIL_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function dismissInstallNudge(
  cooldownMs: number = INSTALL_NUDGE_COOLDOWN_MS
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISS_UNTIL_KEY,
      String(Date.now() + cooldownMs)
    );
  } catch {
    /* ignore */
  }
}

export async function copyAppUrl(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const url = window.location.origin;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
