// Google 연결·로그인 콜백이 "버튼을 누른 곳과 다른 브라우저"로 돌아오는 경우의 공용 조각 (docs/ANON_START.md 6절).
// 서버·클라이언트 공용, 비밀 없음.
//
// iOS 홈 화면 앱은 Google 화면을 앱 밖(인앱 브라우저·Safari)에서 열고 콜백도 그쪽 쿠키로 돌아온다. 그래서
// - 연결(linkIdentity)의 성공·실패는 Supabase 서버가 이미 정했다(연결은 Supabase 콜백에서 저장되고, 그 뒤에야 우리 콜백으로 온다).
//   우리 콜백은 그 결과를 "어느 창에 어떻게 보일지"만 정한다.
// - 버튼을 누른 창인지는 PKCE verifier 쿠키가 요청에 있는지로 안다. 없으면 다른 창이다.

/** 콜백 주소에 붙이는 흐름 표시. link = 익명 기록에 Google 붙이기, fresh = 기존 Google 계정으로 로그인 */
export type CallbackMode = "link" | "fresh";

export function callbackMode(v: string | null | undefined): CallbackMode | null {
  return v === "link" || v === "fresh" ? v : null;
}

/** 버튼이 만드는 콜백 주소 (앱 안 경로 next는 safeNext를 거친 값) */
export function callbackHref(origin: string, mode: CallbackMode, next: string): string {
  const callback = new URL("/auth/callback", origin);
  if (next) callback.searchParams.set("next", next);
  callback.searchParams.set("mode", mode);
  return callback.toString();
}

/** auth-js가 PKCE verifier를 두는 쿠키 이름 — 세션 쿠키 `sb-<ref>-auth-token`에 `-code-verifier` */
export function verifierCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token-code-verifier`;
}

/** `/auth/done`(세션을 읽지 않는 안내 화면)이 보여 주는 상태 */
export type LinkDoneStatus = "linked" | "exists" | "other-browser" | "failed";

const DONE_STATUSES: readonly LinkDoneStatus[] = ["linked", "exists", "other-browser", "failed"];

export function isLinkDoneStatus(s: unknown): s is LinkDoneStatus {
  return typeof s === "string" && (DONE_STATUSES as readonly string[]).includes(s);
}

export function linkDonePath(status: LinkDoneStatus): string {
  return `/auth/done?status=${status}`;
}

/**
 * 첫 화면(온보딩)에서 생년월일을 저장한 뒤 Google 연결로 갈 때의 next. 이 값이면 연결이 안 돼도 실패 화면이 아니라
 * 내 카드로 이어 간다 — 기록(익명 계정과 생년월일)은 이미 만들어졌다 (ANON_START.md 7절)
 */
export const ONBOARDING_LINK_NEXT = "/welcome";

/**
 * Supabase 오류 설명이 "그 Google은 이미 붙어 있다"인지, 붙은 곳이 어디인지.
 * - self: 바로 이 계정에 이미 붙어 있다 ("Identity is already linked") — 연결이 먼저 끝났는데 화면의 토큰이 아직 익명이라
 *   한 번 더 누른 경우(2026-10-25 사용자가 겪음). 실패가 아니라 성공이다.
 * - other: 다른 계정에 붙어 있다 ("… linked to another user", 메일만 겹치는 email_exists "… already been registered")
 */
export function alreadyLinkedKind(desc: string): "self" | "other" | null {
  if (!/identity.*(exist|linked)|already/i.test(desc)) return null;
  return /identity is already linked/i.test(desc) && !/another/i.test(desc) ? "self" : "other";
}

/**
 * Supabase가 오류를 쿼리로 돌려줬을 때 갈 곳. here = 버튼을 누른 창(verifier 쿠키 있음).
 * 다른 창이면 그 창의 계정과 무관한 안내 화면으로 — 그 창의 설정 화면에 "연결 실패"를 띄우면 엉뚱한 계정 이야기가 된다.
 * 이미 이 계정에 붙어 있으면(self) 연결 성공과 같게 — 누른 창은 next로(돌아온 화면이 토큰을 갱신해 "연결됨"), 다른 창은 '연결을 마쳤어요'.
 */
export function providerErrorTarget(input: { linked: "self" | "other" | null; here: boolean; mode: CallbackMode | null; next: string }): string {
  if (input.linked === "self") return input.here ? input.next : linkDonePath("linked");
  const exists = input.linked === "other";
  if (!input.here) return linkDonePath(exists ? "exists" : "failed");
  // 첫 화면에서 온 연결: 그 Google이 이미 다른 계정이면 사정을 알리고 내 카드로 이어 가는 안내, 취소·그 밖의 실패는 그냥 내 카드로
  if (input.next === ONBOARDING_LINK_NEXT) return exists ? `${linkDonePath("exists")}&next=${encodeURIComponent(input.next)}` : input.next;
  const back = input.mode === "link" || input.next.startsWith("/settings") ? "/settings" : "/login";
  const q = new URLSearchParams({ error: exists ? "link" : "1" });
  if (back === "/login") q.set("next", input.next);
  return `${back}?${q.toString()}`;
}

/**
 * 코드는 왔는데 교환이 실패했을 때 갈 곳.
 * 연결이면 코드가 왔다는 것 자체가 연결 성공이다(Supabase는 연결을 저장한 뒤에만 코드를 준다) — 버튼을 누른 창이면 next로
 * 보내 그 화면이 토큰을 갱신해 "연결됨"을 보게 하고(useLinkReturn), 다른 창이면 "앱으로 돌아가요".
 * 로그인(fresh)이면 세션이 그 창에서만 만들어질 수 있어 버튼을 누른 창은 받을 수 없다 — 다른 창이면 그 사정을 설명한다.
 */
export function exchangeFailTarget(input: { here: boolean; mode: CallbackMode | null; next: string }): string {
  if (input.mode === "link") return input.here ? input.next : linkDonePath("linked");
  return input.here ? "/login?error=1" : linkDonePath("other-browser");
}

// --- 브라우저 쪽: 연결 버튼을 누른 흔적 ---------------------------------------

/**
 * 누르기 직전의 세션이 익명인지. 토큰을 먼저 갱신한다 — 연결이 다른 창에서 끝났어도 이 화면의 토큰은 최대 1시간 익명으로
 * 남아, 그대로 linkIdentity를 부르면 "이미 연결됨"으로 한 바퀴 헛돈다 (2026-10-25). 갱신이 안 되면 들고 있던 세션으로 판단한다.
 */
export async function anonymousNow(auth: {
  refreshSession: () => Promise<{ data: { session: { user: { is_anonymous?: boolean } } | null }; error: unknown }>;
  getSession: () => Promise<{ data: { session: { user: { is_anonymous?: boolean } } | null } }>;
}): Promise<boolean | null> {
  try {
    const { data, error } = await auth.refreshSession();
    if (!error && data.session) return Boolean(data.session.user.is_anonymous);
  } catch {
    /* 아래로 */
  }
  const { data } = await auth.getSession();
  return data.session ? Boolean(data.session.user.is_anonymous) : null;
}

/** "연결 버튼을 눌렀다"를 이 창에 남기는 localStorage 열쇠. 값은 누른 시각(ms) */
export const LINK_PENDING_KEY = "night_link_pending";

/** 이 시간 안에 이 화면이 다시 보이면 토큰을 갱신해 연결됐는지 확인한다 */
export const LINK_PENDING_TTL_MS = 15 * 60_000;

export function pendingFresh(startedAt: number, now: number, ttl: number = LINK_PENDING_TTL_MS): boolean {
  return Number.isFinite(startedAt) && now - startedAt >= 0 && now - startedAt <= ttl;
}

export function markLinkPending(now: number = Date.now()): void {
  try {
    localStorage.setItem(LINK_PENDING_KEY, String(now));
  } catch {
    /* 저장소를 못 쓰면 돌아와서 확인하는 단계만 빠진다 */
  }
}

/** 눌렀던 시각. 없거나 오래됐으면 null (오래된 것은 지운다) */
export function readLinkPending(now: number = Date.now()): number | null {
  try {
    const raw = localStorage.getItem(LINK_PENDING_KEY);
    if (!raw) return null;
    const t = Number(raw);
    if (!pendingFresh(t, now)) {
      localStorage.removeItem(LINK_PENDING_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function clearLinkPending(): void {
  try {
    localStorage.removeItem(LINK_PENDING_KEY);
  } catch {
    /* 무시 */
  }
}
