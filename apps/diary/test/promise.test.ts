// 오늘의 작은 약속 (톤 v3.2): 저장 액션이 promise·promise_text를 받아 저장하는지, 컬럼이 아직 없을 때 약속 없이 다시 저장하는지,
// 쓰기 화면이 운세 do 문장을 캐시에서만 읽고 계산을 유발하지 않는지
import { beforeEach, describe, expect, test, vi } from "vitest";

// --- 가짜 Supabase ---------------------------------------------------------
type Op = { table: string; op: string; row?: Record<string, unknown>; cols?: string; filters?: [string, unknown][] };
const ops: Op[] = [];
/** night_entries upsert가 처음에 돌려줄 오류 (컬럼 없음 시뮬레이션). null이면 성공 */
let firstUpsertError: { code?: string; message: string } | null = null;
/** night_fortunes 캐시 행 */
let fortuneRow: { content: unknown } | null = null;
const fakeUser = { id: "user-1", is_anonymous: true, email: undefined };

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>) {
          const nth = ops.filter((o) => o.table === table && o.op === "upsert").length;
          ops.push({ table, op: "upsert", row });
          if (nth === 0 && firstUpsertError) return Promise.resolve({ error: firstUpsertError });
          return Promise.resolve({ error: null });
        },
        insert(row: Record<string, unknown>) {
          ops.push({ table, op: "insert", row });
          return Promise.resolve({ error: null });
        },
        update(row: Record<string, unknown>) {
          ops.push({ table, op: "update", row });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        select(cols: string) {
          const entry: Op = { table, op: "select", cols, filters: [] };
          ops.push(entry);
          const chain = {
            eq(col: string, val: unknown) {
              entry.filters!.push([col, val]);
              return chain;
            },
            maybeSingle() {
              return Promise.resolve({ data: table === "night_fortunes" ? fortuneRow : null, error: null });
            },
          };
          return chain;
        },
      };
    },
    auth: { signOut: () => Promise.resolve({ error: null }) },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getUser: async () => ({ supabase: fakeSupabase(), user: fakeUser }),
  createClient: async () => fakeSupabase(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
// 운세 계산·모델 호출이 끼어들면 안 된다. 불리면 바로 실패
const computeSpy = vi.fn(() => {
  throw new Error("쓰기 화면에서 운세를 계산하면 안 된다");
});
vi.mock("@/lib/fortune", () => ({ getTodayFortune: computeSpy, computeFortune: computeSpy }));
vi.mock("@/lib/fortune/index", () => ({ getTodayFortune: computeSpy, computeFortune: computeSpy }));

import { saveEntryAction } from "@/app/actions";
import { isMissingColumnError, readCachedFortune, saveEntry } from "@/lib/db";
import { dayGanji } from "@/lib/ganji";
import type { SupabaseClient } from "@supabase/supabase-js";

beforeEach(() => {
  ops.length = 0;
  firstUpsertError = null;
  fortuneRow = null;
  computeSpy.mockClear();
});

function form(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  return f;
}

const upserts = () => ops.filter((o) => o.table === "night_entries" && o.op === "upsert");

describe("saveEntryAction — 약속 저장", () => {
  test("promise·promise_text를 함께 upsert한다", async () => {
    const f = form({ entryDate: "2026-10-06", happiness: "7", promise: "kept", promise_text: "저녁에 지출과 약속을 다시 확인해요" });
    await expect(saveEntryAction({ error: null }, f)).rejects.toThrow("REDIRECT:/?saved=2026-10-06");
    expect(upserts()).toHaveLength(1);
    expect(upserts()[0]!.row).toMatchObject({ user_id: "user-1", happiness: 7, promise: "kept", promise_text: "저녁에 지출과 약속을 다시 확인해요" });
  });

  test("약속 필드가 없으면(운세 캐시 없던 날) null로 저장한다", async () => {
    const f = form({ entryDate: "2026-10-06", happiness: "5" });
    await expect(saveEntryAction({ error: null }, f)).rejects.toThrow("REDIRECT:");
    expect(upserts()[0]!.row).toMatchObject({ promise: null, promise_text: null });
  });

  test("목록 밖의 값은 거부하고 저장하지 않는다", async () => {
    const f = form({ entryDate: "2026-10-06", happiness: "5", promise: "maybe" });
    const r = await saveEntryAction({ error: null }, f);
    expect(r.error).toMatch(/약속/);
    expect(upserts()).toHaveLength(0);
  });
});

describe("컬럼이 아직 없을 때 (0003_promise.sql 적용 전)", () => {
  test("42703이면 약속 없이 다시 저장한다 — 500이 나지 않는다", async () => {
    firstUpsertError = { code: "42703", message: 'column "promise" of relation "night_entries" does not exist' };
    const f = form({ entryDate: "2026-10-06", happiness: "8", promise: "kept", promise_text: "하나만 골라 끝까지 밀어붙여요" });
    await expect(saveEntryAction({ error: null }, f)).rejects.toThrow("REDIRECT:/?saved=2026-10-06");
    const u = upserts();
    expect(u).toHaveLength(2);
    expect(u[0]!.row).toHaveProperty("promise", "kept");
    expect(u[1]!.row).not.toHaveProperty("promise");
    expect(u[1]!.row).not.toHaveProperty("promise_text");
    expect(u[1]!.row).toMatchObject({ happiness: 8, entry_date: "2026-10-06" });
  });

  test("PostgREST 스키마 캐시 오류(PGRST204)도 같은 폴백", async () => {
    firstUpsertError = { code: "PGRST204", message: "Could not find the 'promise' column of 'night_entries' in the schema cache" };
    await saveEntry(
      fakeSupabase() as unknown as SupabaseClient,
      "user-1",
      { entryDate: "2026-10-06", happiness: 6, moods: [], note: null, promise: "na", promiseText: "x" },
      dayGanji("2026-10-06"),
    );
    expect(upserts()).toHaveLength(2);
    expect(upserts()[1]!.row).not.toHaveProperty("promise");
  });

  test("다른 오류는 그대로 던진다", async () => {
    firstUpsertError = { code: "23514", message: "check constraint violated" };
    await expect(
      saveEntry(
        fakeSupabase() as unknown as SupabaseClient,
        "user-1",
        { entryDate: "2026-10-06", happiness: 6, moods: [], note: null, promise: null, promiseText: null },
        dayGanji("2026-10-06"),
      ),
    ).rejects.toThrow("기록 저장");
    expect(upserts()).toHaveLength(1);
  });

  test("isMissingColumnError", () => {
    expect(isMissingColumnError({ code: "42703", message: "" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204", message: "" })).toBe(true);
    expect(isMissingColumnError({ message: 'column "promise" does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe("readCachedFortune — 캐시에서만 읽는다", () => {
  test("캐시 행이 있으면 do 문장만 돌려준다. select 한 번, 쓰기 없음, 계산 없음", async () => {
    fortuneRow = { content: { headline: "h", body: "b", do: " 미뤄 둔 말이나 글을 꺼내요. ", dont: "d" } };
    const r = await readCachedFortune(fakeSupabase() as unknown as SupabaseClient, "user-1", "2026-10-06");
    expect(r).toEqual({ doText: "미뤄 둔 말이나 글을 꺼내요." });
    const touched = ops.filter((o) => o.table === "night_fortunes");
    expect(touched).toHaveLength(1);
    expect(touched[0]).toMatchObject({ op: "select", cols: "content", filters: [["user_id", "user-1"], ["fortune_date", "2026-10-06"]] });
    expect(ops.some((o) => o.op === "insert" || o.op === "update" || o.op === "upsert")).toBe(false);
    expect(computeSpy).not.toHaveBeenCalled();
  });

  test("캐시가 없으면 null — 새로 계산하지 않는다", async () => {
    const r = await readCachedFortune(fakeSupabase() as unknown as SupabaseClient, "user-1", "2026-10-06");
    expect(r).toBeNull();
    expect(ops.filter((o) => o.table === "night_fortunes")).toHaveLength(1);
    expect(ops.some((o) => o.op !== "select")).toBe(false);
    expect(computeSpy).not.toHaveBeenCalled();
  });

  test("content에 do가 없거나 비어 있으면 null", async () => {
    fortuneRow = { content: { headline: "h", do: "   " } };
    expect(await readCachedFortune(fakeSupabase() as unknown as SupabaseClient, "user-1", "2026-10-06")).toBeNull();
    fortuneRow = { content: null };
    expect(await readCachedFortune(fakeSupabase() as unknown as SupabaseClient, "user-1", "2026-10-06")).toBeNull();
  });
});
