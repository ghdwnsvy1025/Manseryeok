/**
 * 공유 문구에 앱 진입 링크를 붙여, 받는 사람이 바로 열 수 있게 함.
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "";
}

export function getAppShareUrl(path = "/"): string {
  const origin = getAppOrigin();
  if (!origin) return path.startsWith("/") ? path : `/${path}`;
  try {
    return new URL(path, origin).toString();
  } catch {
    return origin;
  }
}

const INVITE_LINE = "오늘의 사주 일기 — 나의 하루를 남겨보세요";

/** 본문 뒤에 초대 문구 + 앱 링크를 붙인 공유 텍스트 */
export function withAppInvite(body: string, path = "/"): string {
  const url = getAppShareUrl(path);
  const trimmed = body.trim();
  if (!url) return `${trimmed}\n\n${INVITE_LINE}`;
  return `${trimmed}\n\n${INVITE_LINE}\n${url}`;
}

export async function shareAppText(body: string, path = "/"): Promise<"shared" | "copied"> {
  const text = withAppInvite(body, path);
  const url = getAppShareUrl(path);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: "오늘의 사주 일기",
        text,
        url: url || undefined,
      });
      return "shared";
    } catch (err) {
      // 사용자가 공유 시트를 닫으면 AbortError — 실패로 취급하지 않되 상위에서 처리
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("share_unavailable");
}
