// 2026-10-31 다음 달 좋은 날·조심할 날 예측: 오늘 운세 점수와 같은 계산을 매일에 돌려 고른다
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeProfile } from "@/lib/profile";
import { forecastMonth, nextMonthOf } from "@/lib/stats/forecast";
import { dayGanji } from "@/lib/ganji";

const input = { name: "x", gender: "female" as const, calendar: "solar" as const, isLeapMonth: false, birthYear: 1995, birthMonth: 3, birthDay: 14, birthHour: 9, birthMinute: 30, city: "seoul" as const };
const c = computeProfile(input);
if (!c.ok) throw new Error("profile");
const { name: _n, ...birth } = input;

describe("다음 달 예측", () => {
  test("다음 달 계산 (12월 → 다음 해 1월)", () => {
    expect(nextMonthOf("2026-10")).toBe("2026-11");
    expect(nextMonthOf("2026-12")).toBe("2027-01");
  });
  test("그 달 안의 날 하나씩, 좋은 날 점수 > 조심할 날 점수, 이유 한 줄", () => {
    const t = performance.now();
    const f = forecastMonth({ pillars: c.value.pillars, profile: birth, entries: [], ym: "2026-11" });
    const ms = performance.now() - t;
    expect(f.best?.date.startsWith("2026-11")).toBe(true);
    expect(f.worst?.date.startsWith("2026-11")).toBe(true);
    expect(f.best!.score).toBeGreaterThan(f.worst!.score);
    expect(f.best!.reason.length).toBeGreaterThan(0);
    expect(f.best!.weight).toBe(0);
    expect(ms).toBeLessThan(2000);
  });
  test("내 기록이 많으면 기록 쪽으로 — 같은 일간·일지 날의 행복도가 점수를 끈다", () => {
    const base = forecastMonth({ pillars: c.value.pillars, profile: birth, entries: [], ym: "2026-11" });
    const worstG = base.worst!;
    // 조심할 날과 같은 간지의 기록을 행복 10으로 많이 쌓으면 그날은 더 이상 가장 나쁜 날이 아니다
    const g = dayGanji(worstG.date);
    const entries = Array.from({ length: 30 }, () => ({ day_ganji_index: g.index, day_stem: g.stemKo, day_branch: g.branchKo, happiness: 10 }));
    const after = forecastMonth({ pillars: c.value.pillars, profile: birth, entries, ym: "2026-11" });
    expect(after.worst?.date).not.toBe(worstG.date);
  });
});
