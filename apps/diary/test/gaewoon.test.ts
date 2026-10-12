import { describe, expect, it } from "vitest";
import { GAEWOON_TABLE, gaewoonOf } from "@/lib/fortune/gaewoon";

const part = (char: string, label: "용" | "희" | "기" | "구" | "한") => ({ char, label, tenGod: "비견", family: "비겁", score: 0 }) as never;

describe("gaewoonOf (오늘의 개운)", () => {
  const le = { 용: "수" as const, 희: "금" as const };
  it("용신이 없으면 null", () => {
    expect(gaewoonOf({ dayLuck: { stem: part("甲", "용"), branch: part("子", "용") } as never, luckEls: null }, "2026-10-12")).toBeNull();
  });
  it("오늘 글자가 나를 도우면(용·희) 그 오행을 살린다", () => {
    // 壬(수) 용
    const g = gaewoonOf({ dayLuck: { stem: part("壬", "용"), branch: part("午", "기") } as never, luckEls: le }, "2026-10-12")!;
    expect(g.el).toBe("수");
    expect(g.reason).toContain("물이 나를 도와서");
  });
  it("오늘 글자가 넘치면(기·구) 용신으로 균형", () => {
    // 丙(화) 기, 午(화) 기
    const g = gaewoonOf({ dayLuck: { stem: part("丙", "기"), branch: part("午", "구") } as never, luckEls: le }, "2026-10-12")!;
    expect(g.el).toBe("수");
    expect(g.reason).toBe("오늘은 불이 세서, 물 쪽으로 균형을 잡아요");
  });
  it("같은 날이면 같은 결과, 표에 있는 값만", () => {
    const a = gaewoonOf({ dayLuck: { stem: part("甲", "한"), branch: part("寅", "한") } as never, luckEls: le }, "2026-10-12")!;
    const b = gaewoonOf({ dayLuck: { stem: part("甲", "한"), branch: part("寅", "한") } as never, luckEls: le }, "2026-10-12")!;
    expect(a).toEqual(b);
    expect(GAEWOON_TABLE.수.colors.map((c) => c.name)).toContain(a.color.name);
    expect(a.time).toBe(GAEWOON_TABLE.수.time);
  });
});
