// 설정·로그인 전수조사 B4·B9·B10: 이름 저장, 기록 모두 지우기(진짜 삭제, 익명만), /login 버튼 두 개
import { beforeEach, describe, expect, test, vi } from "vitest";

// --- 가짜 Supabase (사용자 클라이언트) ----------------------------------------
type User = { id: string; is_anonymous: boolean; email: string | null };
const anonUser: User = { id: "anon-1", is_anonymous: true, email: null };
const googleUser: User = { id: "g-1", is_anonymous: false, email: "a@b.c" };
let currentUser: User | null = anonUser;

/** 일어난 일을 순서대로 */
const log: string[] = [];
let failTable: string | null = null;

function fakeUserClient() {
  return {
    from(table: string) {
      return {
        update(row: Record<string, unknown>) {
          return { eq: (col: string, v: string) => { log.push(`update ${table} ${col}=${v} ${JSON.stringify(row)}`); return Promise.resolve({ error: null }); } };
        },
        upsert(row: Record<string, unknown>) {
          log.push(`upsert ${table} ${JSON.stringify(row)}`);
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq: (col: string, v: string) => {
              log.push(`delete ${table} ${col}=${v}`);
              return Promise.resolve({ error: failTable === table ? { message: "boom" } : null });
            },
          };
        },
      };
    },
    auth: {
      signOut: (opts?: { scope?: string }) => { log.push(`signOut ${opts?.scope ?? "global"}`); currentUser = null; return Promise.resolve({ error: null }); },
      signInAnonymously: () => {
        log.push("signInAnonymously");
        currentUser = { id: "anon-2", is_anonymous: true, email: null };
        return Promise.resolve({ data: { user: currentUser, session: {} }, error: null });
      },
    },
  };
}

function fakeAdminClient() {
  return {
    from(table: string) {
      return { delete: () => ({ eq: (col: string, v: string) => { log.push(`admin delete ${table} ${col}=${v}`); return Promise.resolve({ error: null }); } }) };
    },
    auth: { admin: { deleteUser: (id: string) => { log.push(`admin deleteUser ${id}`); return Promise.resolve({ data: {}, error: null }); } } },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: fakeUserClient(), user: currentUser }) }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => fakeAdminClient() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { deleteAllAction, saveNameAction } from "@/app/actions";
import { USER_DELETABLE_TABLES } from "@/lib/db";
import { loginButtons } from "@/lib/linkPrompt";
import { validateName } from "@/lib/profile";

beforeEach(() => {
  log.length = 0;
  failTable = null;
  currentUser = anonUser;
});

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

describe("B4 이름", () => {
  test("validateName: 공백을 지운 1~40자", () => {
    expect(validateName("  달빛 ")).toEqual({ ok: true, value: "달빛" });
    expect(validateName("   ").ok).toBe(false);
    expect(validateName(undefined).ok).toBe(false);
    expect(validateName("가".repeat(40)).ok).toBe(true);
    expect(validateName("가".repeat(41)).ok).toBe(false);
  });

  test("saveNameAction은 night_saju_profiles.name과 night_profiles.display_name을 같이 바꾼다", async () => {
    const r = await saveNameAction({ error: null }, form({ name: " 달빛 " }));
    expect(r).toEqual({ error: null });
    expect(log).toEqual([
      'update night_saju_profiles user_id=anon-1 {"name":"달빛"}',
      'upsert night_profiles {"user_id":"anon-1","display_name":"달빛"}',
    ]);
  });

  test("빈 이름은 저장하지 않고 field=name 오류", async () => {
    const r = await saveNameAction({ error: null }, form({ name: "  " }));
    expect(r.error).toMatch(/이름/);
    expect(r.field).toBe("name");
    expect(log).toHaveLength(0);
  });
});

describe("B9 기록 모두 지우기 = 진짜 삭제", () => {
  test("익명이면 본인 행(자식→부모) → 운세 캐시(admin, user_id 조건) → 계정 삭제 → 로컬 세션 정리 → 새 익명 세션 → /", async () => {
    await expect(deleteAllAction()).rejects.toThrow("REDIRECT:/");
    expect(USER_DELETABLE_TABLES).toEqual(["night_entries", "night_fortune_feedback", "night_notification_settings", "night_saju_profiles", "night_profiles"]);
    expect(log).toEqual([
      "delete night_entries user_id=anon-1",
      "delete night_fortune_feedback user_id=anon-1",
      "delete night_notification_settings user_id=anon-1",
      "delete night_saju_profiles user_id=anon-1",
      "delete night_profiles user_id=anon-1",
      "admin delete night_fortunes user_id=anon-1",
      "admin deleteUser anon-1",
      "signOut local",
      "signInAnonymously",
      'upsert night_profiles {"user_id":"anon-2","display_name":"손님"}',
    ]);
  });

  test("Google 사용자면 아무것도 지우지 않는다", async () => {
    currentUser = googleUser;
    await expect(deleteAllAction()).resolves.toBeUndefined();
    expect(log).toHaveLength(0);
  });

  test("세션이 없으면 아무것도 하지 않는다", async () => {
    currentUser = null;
    await expect(deleteAllAction()).resolves.toBeUndefined();
    expect(log).toHaveLength(0);
  });

  test("행 삭제가 실패하면 계정을 지우지 않고 세션도 끊지 않은 채 설정으로 돌아간다", async () => {
    failTable = "night_saju_profiles";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteAllAction()).rejects.toThrow("REDIRECT:/settings?error=delete");
    expect(log.some((l) => l.startsWith("admin deleteUser"))).toBe(false);
    expect(log.some((l) => l.startsWith("signOut"))).toBe(false);
    expect(currentUser).toBe(anonUser);
    spy.mockRestore();
  });
});

describe("B10 /login 버튼", () => {
  test("익명 세션이면 처음부터 두 개: 연결(link) + 기존 계정 로그인(fresh)", () => {
    const b = loginButtons({ isAnonymous: true });
    expect(b).toHaveLength(2);
    expect(b.map((x) => x.mode)).toEqual(["link", "fresh"]);
    expect(b[0].label).toBe("이 기기의 기록에 Google 연결하기");
    expect(b[1].label).toBe("기존 Google 계정으로 로그인하기");
    for (const x of b) expect(x.description).toBeTruthy();
  });

  test("세션이 없으면 로그인 하나, Google 사용자면 없음", () => {
    expect(loginButtons(null).map((x) => x.mode)).toEqual(["signin"]);
    expect(loginButtons({ isAnonymous: false })).toEqual([]);
  });
});
