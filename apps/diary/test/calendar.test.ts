import { describe, expect, it } from "vitest";
import { buildMonth, resolveMonth } from "@/lib/calendar";

describe("resolveMonth", () => {
  it("미래·잘못된 값은 이번 달", () => {
    expect(resolveMonth("2026-11", "2026-10-10")).toBe("2026-10");
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
    expect(c).toMatchObject({ count: 2, mean: 6, prev: "2026-09", next: null });
  });
});
