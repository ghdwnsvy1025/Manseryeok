// 투표 취소(vote "0" → night_fortune_feedback 행 삭제) · 기록 삭제(deleteEntryAction → night_entries 그 날짜 행 삭제 뒤 /me)
import { beforeEach, describe, expect, test, vi } from "vitest";
import { todayKST } from "@/lib/time";

type Call = { op: "upsert" | "delete"; table: string; row?: Record<string, unknown>; filters?: Record<string, unknown> };
const calls: Call[] = [];
const fakeUser = { id: "u-1", is_anonymous: true, email: undefined };
let currentUser: typeof fakeUser | null = fakeUser;
let deleteFails = false;

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>) {
          calls.push({ op: "upsert", table, row });
          return Promise.resolve({ error: null });
        },
        delete() {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq(col: string, v: unknown) {
              filters[col] = v;
              return chain;
            },
            then(resolve: (r: { error: { message: string } | null }) => void) {
              calls.push({ op: "delete", table, filters });
              resolve({ error: deleteFails ? { message: "boom" } : null });
            },
          };
          return chain;
        },
      };
    },
  };
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ getUser: async () => ({ supabase: fakeSupabase(), user: currentUser }) }));
const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

import { deleteEntryAction, fortuneVoteAction } from "@/app/actions";

function form(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  currentUser = fakeUser;
  deleteFails = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("fortuneVoteAction", () => {
  test("1·-1은 그대로 upsert", async () => {
    await fortuneVoteAction(form({ date: "2026-10-08", vote: "1" }));
    expect(calls).toEqual([{ op: "upsert", table: "night_fortune_feedback", row: { user_id: "u-1", fortune_date: "2026-10-08", vote: 1 } }]);
    calls.length = 0;
    await fortuneVoteAction(form({ date: "2026-10-08", vote: "-1" }));
    expect(calls[0]!.row).toMatchObject({ vote: -1 });
  });

  test("\"0\"이면 그 날짜의 피드백 행을 지운다", async () => {
    await fortuneVoteAction(form({ date: "2026-10-08", vote: "0" }));
    expect(calls).toEqual([{ op: "delete", table: "night_fortune_feedback", filters: { user_id: "u-1", fortune_date: "2026-10-08" } }]);
    // v3.14: 투표는 화면을 다시 그리지 않는다(낙관적 버튼, 카드가 접히던 문제)
    expect(revalidated).toEqual([]);
  });

  test("다른 값·잘못된 날짜는 아무것도 하지 않는다", async () => {
    await fortuneVoteAction(form({ date: "2026-10-08", vote: "2" }));
    await fortuneVoteAction(form({ date: "2026-10-8", vote: "0" }));
    expect(calls).toEqual([]);
  });
});

describe("deleteEntryAction", () => {
  test("본인 그 날짜 행을 지우고 /·/me·/write revalidate 뒤 /me로", async () => {
    const today = todayKST();
    await expect(deleteEntryAction(form({ date: today }))).rejects.toThrow("REDIRECT:/me");
    expect(calls).toEqual([{ op: "delete", table: "night_entries", filters: { user_id: "u-1", entry_date: today } }]);
    expect(revalidated).toEqual(["/", "/me", "/write"]);
  });

  test("미래·잘못된 날짜는 지우지 않는다 (validateEntry 날짜 규칙)", async () => {
    await deleteEntryAction(form({ date: "2999-01-01" }));
    await deleteEntryAction(form({ date: "2026-02-30" }));
    await deleteEntryAction(form({ date: "2019-12-31" }));
    expect(calls).toEqual([]);
    expect(revalidated).toEqual([]);
  });

  test("세션이 없거나 지우기가 실패하면 redirect 없이 돌아온다", async () => {
    currentUser = null;
    await expect(deleteEntryAction(form({ date: todayKST() }))).resolves.toBeUndefined();
    currentUser = fakeUser;
    deleteFails = true;
    await expect(deleteEntryAction(form({ date: todayKST() }))).resolves.toBeUndefined();
    expect(revalidated).toEqual([]);
  });
});
