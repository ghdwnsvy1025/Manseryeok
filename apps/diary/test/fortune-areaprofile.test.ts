// 운세 개편 Phase 1 (2026-11-01): 오늘 7개 영역 원자료와 기록 6개 영역 병합
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeCoreFortune } from "@/lib/fortune/core";
import { areaSignalLevel, compareAreas, sixAreaSignals } from "@/lib/fortune/areaProfile";
import type { AreaName, AreaProfileEntry } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE_A, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const coreOn = (d: string) => computeCoreFortune({ pillars: pr.value.pillars, profile: PROFILE_A, date: d, todayHanja: dayGanji(d).hanja });
const NAMES: AreaName[] = ["대인", "재물", "직업", "학업", "연애", "가족", "건강"];
const e = (strength: number, mixed = false): AreaProfileEntry => ({ strength, active: Math.abs(strength) >= 1, mixed, contributions: [] });
const prof = (over: Partial<Record<AreaName, AreaProfileEntry>>) => ({ ...Object.fromEntries(NAMES.map((n) => [n, e(0)])), ...over }) as Record<AreaName, AreaProfileEntry>;

describe("todayAreaProfile", () => {
  test("7개 영역이 다 있고, 화면 오늘 영역(최대 2개)과 같은 방향이다", () => {
    for (const d of ["2026-06-15", "2026-10-07", "2026-12-02"]) {
      const c = coreOn(d);
      expect(Object.keys(c.todayAreaProfile!).sort()).toEqual([...NAMES].sort());
      for (const a of c.areas.filter((x) => x.period === "오늘" && x.signal !== "→")) {
        const p = c.todayAreaProfile![a.area];
        expect(p.active).toBe(true);
        expect(Math.sign(p.strength)).toBe(a.signal === "↑" ? 1 : -1);
      }
    }
  });
  test("신호 없는 영역은 strength 0, active false, 기여 없음", () => {
    const c = coreOn("2026-06-15");
    const quiet = Object.values(c.todayAreaProfile!).filter((p) => p.contributions.length === 0);
    for (const p of quiet) expect(p).toMatchObject({ strength: 0, active: false });
  });
});

describe("6개 영역 병합", () => {
  test("도장 위치: +2 이상 5, +1 4, 0 3, −1 2, −2 이하 1", () => {
    expect([3, 2, 1.5, 1, 0.5, 0, -0.5, -1, -2, -3].map(areaSignalLevel)).toEqual([5, 5, 4, 4, 3, 3, 3, 2, 1, 1]);
  });
  test("기록 화면과 같은 6개, 같은 순서", () => {
    expect(sixAreaSignals(prof({})).map((s) => s.label)).toEqual(["일·공부", "돈", "건강", "가족", "연애", "대인관계"]);
  });
  test("일·공부: 한쪽만 → 그쪽, 같은 방향 → 더 센 쪽, 반대 방향 → 신호 없음 + mixed", () => {
    const w = (o: Partial<Record<AreaName, AreaProfileEntry>>) => sixAreaSignals(prof(o))[0]!;
    expect(w({ 학업: e(-2) })).toMatchObject({ level: 1, active: true, sources: ["학업"] });
    expect(w({ 직업: e(1), 학업: e(2) })).toMatchObject({ level: 5, sources: ["학업"] });
    expect(w({ 직업: e(2), 학업: e(-1) })).toMatchObject({ level: 3, active: false, mixed: true, sources: ["직업", "학업"] });
    expect(w({})).toMatchObject({ level: 3, active: false, sources: [] });
  });
  test("기록 비교: 매기지 않은 영역은 null (3으로 채우지 않는다)", () => {
    const cmp = compareAreas(sixAreaSignals(prof({ 재물: e(-1) })), { money: 4, people: 5 });
    expect(cmp.map((c) => c.recorded)).toEqual([null, 4, null, null, null, 5]);
    expect(compareAreas(sixAreaSignals(prof({})), null).every((c) => c.recorded === null)).toBe(true);
  });
});
