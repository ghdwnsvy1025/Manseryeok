// Google 연결이 iOS 홈 화면 앱에서 다른 창(Safari)으로 돌아오는 문제 (docs/ANON_START.md 6절):
// 콜백이 "버튼을 누른 창"(verifier 쿠키 있음)과 "다른 창"을 갈라 어디로 보내는지
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  callbackHref,
  callbackMode,
  exchangeFailTarget,
  alreadyLinkedKind,
  anonymousNow,
  pendingFresh,
  providerErrorTarget,
  verifierCookieName,
} from "@/lib/googleLink";

const SUPABASE_URL = "https://abcref.supabase.co";
const VERIFIER = "sb-abcref-auth-token-code-verifier";

let exchange: { user: { id: string } | null; error: { code: string } | null } = { user: { id: "anon-1" }, error: null };
let profile: object | null = { id: "p" };
const exchanged: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/env", () => ({ supabaseEnv: () => ({ url: SUPABASE_URL, anonKey: "anon" }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        exchanged.push(code);
        return { data: { user: exchange.user, session: exchange.user ? {} : null }, error: exchange.error };
      },
    },
  }),
}));
vi.mock("@/lib/db", () => ({ ensureUserRow: async () => undefined, getSajuProfile: async () => profile }));

import { GET } from "@/app/auth/callback/route";

beforeEach(() => {
  exchange = { user: { id: "anon-1" }, error: null };
  profile = { id: "p" };
  exchanged.length = 0;
});

async function callback(query: string, here: boolean): Promise<string> {
  const req = new NextRequest(`https://night.test/auth/callback?${query}`, { headers: here ? { cookie: `${VERIFIER}=v` } : {} });
  const res = await GET(req);
  const loc = new URL(res.headers.get("location")!);
  return `${loc.pathname}${loc.search}`;
}

describe("조각", () => {
  test("verifier 쿠키 이름은 세션 쿠키(sb-<ref>-auth-token)에 -code-verifier", () => {
    expect(verifierCookieName(SUPABASE_URL)).toBe(VERIFIER);
  });
  test("콜백 주소에 next와 mode", () => {
    expect(callbackHref("https://night.test", "link", "/settings")).toBe("https://night.test/auth/callback?next=%2Fsettings&mode=link");
    expect(callbackHref("https://night.test", "fresh", "")).toBe("https://night.test/auth/callback?mode=fresh");
  });
  test("mode는 link·fresh만", () => {
    expect(callbackMode("link")).toBe("link");
    expect(callbackMode("signin")).toBeNull();
    expect(callbackMode(null)).toBeNull();
  });
  test("이미 붙은 곳 가르기: 이 계정(self) / 다른 계정(other)", () => {
    expect(alreadyLinkedKind("identity_already_exists Identity is already linked")).toBe("self");
    expect(alreadyLinkedKind("identity_already_exists Identity is already linked to another user")).toBe("other");
    expect(alreadyLinkedKind("email_exists A user with this email address has already been registered")).toBe("other");
    expect(alreadyLinkedKind("access_denied")).toBeNull();
  });
  test("누르기 직전 토큰을 갱신해 익명인지 본다 — 갱신이 안 되면 들고 있던 세션", async () => {
    const s = (anon: boolean) => ({ data: { session: { user: { is_anonymous: anon } } } });
    expect(await anonymousNow({ refreshSession: async () => ({ ...s(false), error: null }), getSession: async () => s(true) })).toBe(false);
    expect(await anonymousNow({ refreshSession: async () => ({ data: { session: null }, error: new Error("x") }), getSession: async () => s(true) })).toBe(true);
    expect(await anonymousNow({ refreshSession: async () => { throw new Error("net"); }, getSession: async () => ({ data: { session: null } }) })).toBeNull();
  });
  test("누른 흔적은 15분까지", () => {
    expect(pendingFresh(0, 15 * 60_000)).toBe(true);
    expect(pendingFresh(0, 15 * 60_000 + 1)).toBe(false);
    expect(pendingFresh(10, 0)).toBe(false);
  });
  test("갈 곳 표", () => {
    expect(providerErrorTarget({ linked: "other", here: true, mode: "link", next: "/" })).toBe("/settings?error=link");
    expect(providerErrorTarget({ linked: null, here: true, mode: "fresh", next: "/me" })).toBe("/login?error=1&next=%2Fme");
    expect(providerErrorTarget({ linked: "other", here: false, mode: "link", next: "/settings" })).toBe("/auth/done?status=exists");
    expect(providerErrorTarget({ linked: "self", here: true, mode: "link", next: "/" })).toBe("/");
    expect(providerErrorTarget({ linked: "self", here: false, mode: "link", next: "/" })).toBe("/auth/done?status=linked");
    expect(exchangeFailTarget({ here: true, mode: "link", next: "/settings" })).toBe("/settings");
    expect(exchangeFailTarget({ here: false, mode: "link", next: "/settings" })).toBe("/auth/done?status=linked");
    expect(exchangeFailTarget({ here: false, mode: "fresh", next: "/" })).toBe("/auth/done?status=other-browser");
    expect(exchangeFailTarget({ here: true, mode: null, next: "/" })).toBe("/login?error=1");
  });
  test("첫 화면(생년월일 저장 뒤)에서 온 연결은 실패해도 내 카드로 이어 간다", () => {
    expect(providerErrorTarget({ linked: "other", here: true, mode: "link", next: "/welcome" })).toBe("/auth/done?status=exists&next=%2Fwelcome");
    expect(providerErrorTarget({ linked: null, here: true, mode: "link", next: "/welcome" })).toBe("/welcome");
    expect(providerErrorTarget({ linked: "self", here: true, mode: "link", next: "/welcome" })).toBe("/welcome");
    // 다른 창은 그대로 — 그 창의 계정과 무관한 안내
    expect(providerErrorTarget({ linked: "other", here: false, mode: "link", next: "/welcome" })).toBe("/auth/done?status=exists");
    expect(exchangeFailTarget({ here: true, mode: "link", next: "/welcome" })).toBe("/welcome");
  });
});

describe("/auth/callback", () => {
  test("같은 창, 연결 성공: 교환 뒤 next로", async () => {
    expect(await callback("code=c1&next=%2Fsettings&mode=link", true)).toBe("/settings");
    expect(exchanged).toEqual(["c1"]);
  });

  test("이 사용자가 겪은 일 — 그 Google이 이미 다른 계정: 다른 창이면 그 창의 설정이 아니라 안내로", async () => {
    const q = "error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user&next=%2Fsettings&mode=link";
    expect(await callback(q, false)).toBe("/auth/done?status=exists");
    expect(await callback(q, true)).toBe("/settings?error=link");
    expect(exchanged).toEqual([]);
  });

  test("10-25 사용자가 겪은 일 — 연결이 이미 끝난 계정에서 한 번 더 누름: 실패 문구가 아니라 연결됨", async () => {
    const q = "error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked&next=%2F&mode=link";
    expect(await callback(q, true)).toBe("/");
    expect(await callback(q, false)).toBe("/auth/done?status=linked");
  });

  test("다른 창에서 연결 코드가 오면(verifier 없어 교환 실패) 연결은 이미 끝났다 — '앱으로 돌아가요'", async () => {
    exchange = { user: null, error: { code: "pkce_code_verifier_not_found" } };
    expect(await callback("code=c2&next=%2Fsettings&mode=link", false)).toBe("/auth/done?status=linked");
  });

  test("다른 창에서 기존 계정 로그인 코드가 오면 그 사정을 설명", async () => {
    exchange = { user: null, error: { code: "pkce_code_verifier_not_found" } };
    expect(await callback("code=c3&next=%2F&mode=fresh", false)).toBe("/auth/done?status=other-browser");
  });

  test("mode 없는 옛 콜백도 같은 창이면 예전처럼", async () => {
    exchange = { user: null, error: { code: "bad_code" } };
    expect(await callback("code=c4", true)).toBe("/login?error=1");
  });

  test("첫 화면에서 연결 성공: 내 카드(/welcome)로", async () => {
    expect(await callback("code=c6&next=%2Fwelcome&mode=link", true)).toBe("/welcome");
  });

  test("첫 화면에서 Google 화면을 취소하면 실패 화면이 아니라 내 카드로", async () => {
    expect(await callback("error=access_denied&error_description=The+user+denied&next=%2Fwelcome&mode=link", true)).toBe("/welcome");
    expect(exchanged).toEqual([]);
  });

  test("생년월일이 없으면 온보딩으로", async () => {
    profile = null;
    expect(await callback("code=c5&next=%2Fme&mode=fresh", true)).toBe("/onboarding?next=%2Fme");
  });
});
