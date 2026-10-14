// 원국 스냅숏 지연 갱신: engine_version이 지금 엔진과 다르면 getSajuProfile이 다시 계산해 저장한다 (엔진 1.1.0 KASI 음력)
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ENGINE_VERSION } from "@saju/engine";
import { getSajuProfile, type SajuProfileRow } from "@/lib/db";
import { computeProfile } from "@/lib/profile";

type Update = { table: string; patch: Record<string, unknown>; filters: Record<string, unknown> };
const updates: Update[] = [];
let stored: SajuProfileRow | null = null;
let updateFails = false;

function fakeSupabase() {
  return {
    from(table: string) {
      return {
        select() {
          const chain = {
            eq: () => chain,
            maybeSingle: async () => ({ data: stored, error: null }),
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq(col: string, v: unknown) {
              filters[col] = v;
              return chain;
            },
            then(resolve: (r: { error: { message: string } | null }) => void) {
              updates.push({ table, patch, filters });
              resolve({ error: updateFails ? { message: "boom" } : null });
            },
          };
          return chain;
        },
      };
    },
  } as never;
}

const WRONG = {
  year: { stem: "甲", branch: "子", ko: "갑자" },
  month: { stem: "甲", branch: "子", ko: "갑자" },
  day: { stem: "甲", branch: "子", ko: "갑자" },
  hour: null,
};

function row(over: Partial<SajuProfileRow> = {}): SajuProfileRow {
  return {
    id: "p-1",
    name: "밤",
    gender: "female",
    calendar: "lunar",
    is_leap_month: false,
    birth_year: 1990,
    birth_month: 3,
    birth_day: 15,
    birth_hour: 9,
    birth_minute: 30,
    city: "seoul",
    pillars: WRONG,
    engine_version: "1.0.0",
    ...over,
  };
}

function expected(r: SajuProfileRow) {
  const c = computeProfile({
    name: r.name,
    gender: r.gender,
    calendar: r.calendar,
    isLeapMonth: r.is_leap_month,
    birthYear: r.birth_year,
    birthMonth: r.birth_month,
    birthDay: r.birth_day,
    birthHour: r.birth_hour,
    birthMinute: r.birth_minute,
    city: "seoul",
  });
  if (!c.ok) throw new Error(c.error);
  return c.value.pillars;
}

beforeEach(() => {
  updates.length = 0;
  stored = null;
  updateFails = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getSajuProfile — 원국 지연 갱신", () => {
  test("옛 엔진 스냅숏은 다시 계산해 돌려주고, 읽은 버전 조건으로 저장한다", async () => {
    stored = row();
    const got = await getSajuProfile(fakeSupabase(), "u-1");
    const fresh = expected(stored);
    expect(got?.pillars).toEqual(fresh);
    expect(got?.engine_version).toBe(ENGINE_VERSION);
    expect(updates).toEqual([
      {
        table: "night_saju_profiles",
        patch: { pillars: fresh, engine_version: ENGINE_VERSION },
        filters: { user_id: "u-1", engine_version: "1.0.0" },
      },
    ]);
  });

  test("지금 엔진 스냅숏은 그대로 — 계산도 저장도 하지 않는다", async () => {
    stored = row({ engine_version: ENGINE_VERSION });
    const got = await getSajuProfile(fakeSupabase(), "u-1");
    expect(got?.pillars).toBe(WRONG);
    expect(updates).toHaveLength(0);
  });

  test("저장이 실패해도 이번 화면은 새 원국을 본다", async () => {
    stored = row({ calendar: "solar", birth_month: 10, birth_day: 9 });
    updateFails = true;
    const got = await getSajuProfile(fakeSupabase(), "u-1");
    expect(got?.pillars).toEqual(expected(stored));
    expect(got?.engine_version).toBe(ENGINE_VERSION);
    expect(updates).toHaveLength(1);
  });

  test("지금 엔진이 거절하는 생일(음력 2060년)은 옛 스냅숏을 그대로 둔다", async () => {
    stored = row({ birth_year: 2060 });
    const got = await getSajuProfile(fakeSupabase(), "u-1");
    expect(got?.pillars).toBe(WRONG);
    expect(got?.engine_version).toBe("1.0.0");
    expect(updates).toHaveLength(0);
  });

  test("프로필이 없으면 null", async () => {
    expect(await getSajuProfile(fakeSupabase(), "u-1")).toBeNull();
    expect(updates).toHaveLength(0);
  });
});
