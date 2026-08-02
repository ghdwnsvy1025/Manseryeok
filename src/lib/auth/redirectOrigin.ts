/**
 * OAuth / 매직링크 후 돌아올 앱 origin.
 * 브라우저에서는 항상 현재 origin을 쓴다.
 * (env에 3001이 박혀 있어도 localhost:3000에서 로그인하면 3000으로 복귀)
 */
export function getAuthRedirectOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_AUTH_REDIRECT_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "";
}

const NEXT_PATH_KEY = "manseryeok_auth_next_v1";

/** 복잡한 ?next= 쿼리 없이 콜백만 넘긴다 (Supabase allowlist 매칭 실패 방지) */
export function getAuthCallbackUrl(): string {
  return `${getAuthRedirectOrigin()}/auth/callback`;
}

export function stashAuthNextPath(next: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(NEXT_PATH_KEY, next);
  } catch {
    /* ignore */
  }
}

export function takeAuthNextPath(fallback = "/"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const value = sessionStorage.getItem(NEXT_PATH_KEY);
    sessionStorage.removeItem(NEXT_PATH_KEY);
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return fallback;
    }
    return value;
  } catch {
    return fallback;
  }
}
