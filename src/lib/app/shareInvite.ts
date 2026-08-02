/**
 * 앱 초대 공유 — 개인 내용 없이 링크만 전달.
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

const INVITE_TITLE = "오늘의 사주 일기";
const INVITE_LINE = "나의 하루를 남겨보세요";

/** 초대용 짧은 텍스트 (개인 기록/문장 없음) */
export function buildAppInviteText(path = "/"): string {
  const url = getAppShareUrl(path);
  if (!url) return `${INVITE_TITLE}\n${INVITE_LINE}`;
  return `${INVITE_TITLE}\n${INVITE_LINE}\n${url}`;
}

/** @deprecated 내용+링크 합치기 — 초대는 buildAppInviteText / shareAppInvite 사용 */
export function withAppInvite(body: string, path = "/"): string {
  const invite = buildAppInviteText(path);
  const trimmed = body.trim();
  if (!trimmed) return invite;
  return `${trimmed}\n\n${invite}`;
}

/** 앱 링크만 공유 (친구 초대) */
export async function shareAppInvite(
  path = "/"
): Promise<"shared" | "copied"> {
  const text = buildAppInviteText(path);
  const url = getAppShareUrl(path);
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: INVITE_TITLE,
        text: INVITE_LINE,
        url: url || undefined,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("share_unavailable");
}

/** @deprecated shareAppInvite 사용 */
export async function shareAppText(
  _body: string,
  path = "/"
): Promise<"shared" | "copied"> {
  return shareAppInvite(path);
}
