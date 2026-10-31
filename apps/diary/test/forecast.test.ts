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
    expect(f.best!.weight).toBe(0);   // 기록이 없으면 보정 없음
    expect(ms).toBeLessThan(2000);
  });
  test("v4.19 내 기록: 같은 일간·일지 날 행복도가 전체 평균보다 높으면 그날 점수가 오른다(최대 +0.8). 모두 같은 행복도면 그대로", () => {
    const base = forecastMonth({ pillars: c.value.pillars, profile: birth, entries: [], ym: "2026-11" });
    const worstG = base.worst!;
    const g = dayGanji(worstG.date);
    const same = Array.from({ length: 30 }, () => ({ day_ganji_index: g.index, day_stem: g.stemKo, day_branch: g.branchKo, happiness: 10 }));
    // 행복도 절대값은 섞지 않는다 — 기록이 전부 10이면 평균 대비 편차가 0이라 점수가 그대로
    const flat = forecastMonth({ pillars: c.value.pillars, profile: birth, entries: same, ym: "2026-11" });
    expect(flat.worst).toEqual(worstG);
    // 다른 날 기록(행복도 4)이 있으면 그날은 평소보다 좋았던 날 → 점수가 오르고, 그래도 가장 나쁜 날이면 점수가 더 높다
    const other = dayGanji("2026-10-31");
    const others = Array.from({ length: 30 }, () => ({ day_ganji_index: other.index, day_stem: other.stemKo === g.stemKo ? "x" : other.stemKo, day_branch: other.branchKo === g.branchKo ? "x" : other.branchKo, happiness: 4 }));
    const after = forecastMonth({ pillars: c.value.pillars, profile: birth, entries: [...same, ...others], ym: "2026-11" });
    expect(after.worst!.date !== worstG.date || after.worst!.score > worstG.score).toBe(true);
    if (after.best && after.best.weight > 0) expect(after.best.reason).toBe("이런 기운의 날, 내 기록이 좋았어요");
  });
});
