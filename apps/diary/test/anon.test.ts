// 익명 시작 (docs/ANON_START.md 5절): 익명 세션으로 저장되는지, Google 버튼 문구, 안내 카드 횟수, 미들웨어가 리디렉트하지 않는지
import { beforeEach, describe, expect, test, vi } from "vitest";

// --- 가짜 Supabase ---------------------------------------------------------
const saved: Record<string, unknown>[] = [];
const fakeUser = { id: "anon-1", is_anonymous: true, email: undefined };
let currentUser: typeof fakeUser | null = fakeUser;

/** night_saju_profiles에 이미 있는 프로필 (getSajuProfile 응답). null이면 처음 만드는 것 */
let existingProfile: Record<string, unknown> | null = null;

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>) {
          saved.push({ table, ...row });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return { maybeSingle: () => Promise.resolve({ data: table === "night_saju_profiles" ? existingProfile : null, error: null }) };
            },
          };
        },
      };
    },
    auth: {
      signOut: () => {
        authCalls.push("signOut");
        currentUser = null;
        return Promise.resolve({ error: null });
      },
      signInAnonymously: () => {
        authCalls.push("signInAnonymously");
        if (anonSignInFails) return Promise.resolve({ data: { user: null, session: null }, error: new Error("rate limit") });
        currentUser = { id: "anon-2", is_anonymous: true, email: undefined };
        return Promise.resolve({ data: { user: currentUser, session: {} }, error: null });
      },
    },
  };
}
const authCalls: string[] = [];
let anonSignInFails = false;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: fakeSupabase(), user: currentUser }),
  createClient: async () => fakeSupabase(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

// 미들웨어: 세션 없는 요청
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}));

import { saveEntryAction, saveProfileAction, signOutAction } from "@/app/actions";
import { googleButtonLabel, shouldShowLinkPrompt } from "@/lib/linkPrompt";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

beforeEach(() => {
  saved.length = 0;
  authCalls.length = 0;
  anonSignInFails = false;
  existingProfile = null;
  currentUser = fakeUser;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

function form(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  }
  return f;
}

describe("익명 세션에서 저장", () => {
  test("saveEntryAction은 익명 user_id로 기록을 저장하고 오늘 화면으로 간다", async () => {
    const f = form({ entryDate: "2026-10-06", happiness: "7", moods: ["기쁨"], note: "한 줄" });
    await expect(saveEntryAction({ error: null }, f)).rejects.toThrow("REDIRECT:/?saved=2026-10-06");
    const row = saved.find((r) => r.table === "night_entries");
    expect(row).toBeTruthy();
    expect(row!.user_id).toBe("anon-1");
    expect(row!.happiness).toBe(7);
  });

  test("세션이 아직 없으면 로그인으로 보내지 않고 '준비 중' 오류만 돌려준다", async () => {
    currentUser = null;
    const f = form({ entryDate: "2026-10-06", happiness: "7" });
    const r = await saveEntryAction({ error: null }, f);
    expect(r.error).toMatch(/준비/);
    expect(saved).toHaveLength(0);
  });

  test("saveProfileAction은 익명이라 이름이 없으면 '손님'으로 저장하고 운세를 기다리지 않고 돌아간다", async () => {
    const f = form({ gender: "female", calendar: "solar", birthYear: "1995", birthMonth: "3", birthDay: "14", timeUnknown: "on", city: "seoul", next: "/" });
    await expect(saveProfileAction({ error: null }, f)).rejects.toThrow("REDIRECT:/");
    const row = saved.find((r) => r.table === "night_saju_profiles");
    expect(row!.name).toBe("손님");
    expect(row!.user_id).toBe("anon-1");
  });
});

describe("로그아웃 / 기록 모두 지우기 (2026-10-07 버그: 로그아웃 뒤 '준비하고 있어요'에 멈춤)", () => {
  test("signOutAction은 세션을 끊은 자리에서 바로 새 익명 세션을 만들고('손님' 행 포함) 오늘 화면으로 간다", async () => {
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
    expect(authCalls).toEqual(["signOut", "signInAnonymously"]);
    const row = saved.find((r) => r.table === "night_profiles");
    expect(row).toBeTruthy();
    expect(row!.user_id).toBe("anon-2");
    expect(row!.display_name).toBe("손님");
  });

  test("새 익명 세션 만들기가 실패해도 오류를 삼키지 않고(console.error) 오늘 화면으로는 간다", async () => {
    anonSignInFails = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(signOutAction()).rejects.toThrow("REDIRECT:/");
    expect(authCalls).toEqual(["signOut", "signInAnonymously"]);
    expect(saved).toHaveLength(0);
    expect(spy).toHaveBeenCalledWith("로그아웃 뒤 익명 시작 실패", expect.any(Error));
    spy.mockRestore();
  });
});

describe("Google 버튼 문구", () => {
  test("익명 세션일 때만 '연결'", () => {
    expect(googleButtonLabel({ isAnonymous: true })).toBe("Google로 연결하기");
    expect(googleButtonLabel(null)).toBe("Google로 시작하기");
    expect(googleButtonLabel({ isAnonymous: false })).toBeNull();
  });
});

describe("Google 연결 안내 카드", () => {
  test("익명 + 첫 기록 뒤 한 번, 7건째 한 번 더, 그 뒤로는 없음", () => {
    expect(shouldShowLinkPrompt({ isAnonymous: true, entryCount: 0, promptCount: 0 })).toBe(false);
    expect(shouldShowLinkPrompt({ isAnonymous: true, entryCount: 1, promptCount: 0 })).toBe(true);
    expect(shouldShowLinkPrompt({ isAnonymous: true, entryCount: 3, promptCount: 1 })).toBe(false);
    expect(shouldShowLinkPrompt({ isAnonymous: true, entryCount: 7, promptCount: 1 })).toBe(true);
    expect(shouldShowLinkPrompt({ isAnonymous: true, entryCount: 20, promptCount: 2 })).toBe(false);
    expect(shouldShowLinkPrompt({ isAnonymous: false, entryCount: 1, promptCount: 0 })).toBe(false);
  });
});

describe("미들웨어", () => {
  test("세션이 없어도 /write·/me·/onboarding을 로그인으로 보내지 않는다", async () => {
    for (const path of ["/write", "/me", "/onboarding", "/settings"]) {
      const res = await middleware(new NextRequest(`http://localhost:3001${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
  });
});
