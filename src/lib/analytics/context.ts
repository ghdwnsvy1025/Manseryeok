/**
 * PostHog 공통 컨텍스트 — 민감정보 없이 기기/인증 상태만.
 */
import { isGuestMode } from "@/lib/auth/guestMode";
import { isStandaloneDisplay, isKakaoTalkInApp } from "@/lib/pwa/installState";

export type AuthProviderAnalytics = "guest" | "google" | "unknown";
export type InAppBrowser = "kakao" | "instagram" | "naver" | "other" | "none";

const GUEST_ANALYTICS_ID_KEY = "manseryeok:analytics_guest_id_v1";
const BETA_COHORT = "friends_2026_w31";

export function detectInAppBrowser(): InAppBrowser {
  if (typeof navigator === "undefined") return "none";
  const ua = navigator.userAgent;
  if (/KAKAOTALK/i.test(ua) || isKakaoTalkInApp()) return "kakao";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/NAVER/i.test(ua)) return "naver";
  if (/FBAN|FBAV|Line\//i.test(ua)) return "other";
  return "none";
}

export function resolveAuthProvider(): AuthProviderAnalytics {
  if (typeof window === "undefined") return "unknown";
  if (isGuestMode()) return "guest";
  return "unknown"; // Google은 identify 시점에 덮어씀
}

export function getOrCreateGuestAnalyticsId(): string {
  if (typeof window === "undefined") return "guest:ssr";
  try {
    const existing = window.localStorage.getItem(GUEST_ANALYTICS_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `guest:${crypto.randomUUID()}`
        : `guest:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(GUEST_ANALYTICS_ID_KEY, id);
    return id;
  } catch {
    return `guest:ephemeral:${Date.now()}`;
  }
}

export function getBetaCohort(): string {
  return (
    process.env.NEXT_PUBLIC_BETA_COHORT?.trim() ||
    BETA_COHORT
  );
}

export function getAppVersion(): string {
  return (
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    process.env.NEXT_PUBLIC_APP_VERSION ||
    "0.1.0"
  );
}

export function buildCommonAnalyticsProps(overrides?: {
  authProvider?: AuthProviderAnalytics;
}): Record<string, string | boolean> {
  const auth =
    overrides?.authProvider ??
    (isGuestMode() ? "guest" : resolveAuthProvider());
  return {
    auth_provider: auth,
    in_app_browser: detectInAppBrowser(),
    is_pwa_standalone: isStandaloneDisplay(),
    beta_cohort: getBetaCohort(),
    app_version: getAppVersion(),
  };
}

export function resolveLandingSurface(pathname: string | null | undefined): string {
  if (!pathname || pathname === "/") return "home";
  if (pathname.startsWith("/auth")) return "auth";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/saju")) return "saju";
  return "other";
}
