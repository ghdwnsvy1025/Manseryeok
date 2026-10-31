import { describe, expect, it } from "vitest";
import { buildMonth, monthRange, resolveMonth } from "@/lib/calendar";

describe("monthRange", () => {
  it("끝은 다음 달 1일(미포함) — 30일 이하 달에서도 유효한 날짜 (A-1)", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", toExclusive: "2026-10-01" });
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", toExclusive: "2026-03-01" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", toExclusive: "2027-01-01" });
  });
  it("범위 끝이 실제 달력에 있는 날짜다", () => {
    for (const m of ["01", "02", "04", "06", "09", "11"]) {
      const { toExclusive } = monthRange(`2026-${m}`);
      const d = new Date(`${toExclusive}T00:00:00Z`);
      expect(d.toISOString().slice(0, 10)).toBe(toExclusive);
    }
  });
});

describe("resolveMonth", () => {
  it("미래·잘못된 값은 이번 달", () => {
    expect(resolveMonth("2026-11", "2026-10-10")).toBe("2026-11"); // 다음 달은 볼 수 있다 (예측 표시)
    expect(resolveMonth("2026-12", "2026-10-10")).toBe("2026-10");
    expect(resolveMonth("abc", "2026-10-10")).toBe("2026-10");
    expect(resolveMonth("2026-13", "2026-10-10")).toBe("2026-10");
    expect(resolveMonth("2026-09", "2026-10-10")).toBe("2026-09");
  });
});

describe("buildMonth", () => {
  it("2026년 10월: 목요일 시작, 31일, 기록·미래 표시", () => {
    const c = buildMonth("2026-10", [{ entry_date: "2026-10-08", happiness: 7 }, { entry_date: "2026-10-09", happiness: 5 }, { entry_date: "2026-09-30", happiness: 9 }], "2026-10-10");
    const flat = c.weeks.flat();
    expect(flat.slice(0, 4).every((d) => d.date === null)).toBe(true);
    expect(flat[4]!.date).toBe("2026-10-01");
    expect(flat.filter((d) => d.date).length).toBe(31);
    expect(flat.find((d) => d.date === "2026-10-08")!.happiness).toBe(7);
    expect(flat.find((d) => d.date === "2026-10-10")!.isToday).toBe(true);
    expect(flat.find((d) => d.date === "2026-10-11")!.isFuture).toBe(true);
    expect(c).toMatchObject({ count: 2, mean: 6, prev: "2026-09", next: "2026-11" });
    expect(buildMonth("2026-11", [], "2026-10-10").next).toBeNull(); // 다음 달까지만 (예측 표시)
  });
});
