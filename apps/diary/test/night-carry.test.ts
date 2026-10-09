import { describe, expect, it } from "vitest";
import { nightCarryDate } from "@/lib/writeNav";
import { growingSeries, happinessSeries } from "@/lib/stats/extra";
import { moodTone } from "@/lib/entry";

describe("nightCarryDate (새벽 4시 전엔 어젯밤)", () => {
  it("0~3시, 어제 기록 없음 → 어제", () => {
    expect(nightCarryDate("2026-10-10", 0, false)).toBe("2026-10-09");
    expect(nightCarryDate("2026-10-10", 3, false)).toBe("2026-10-09");
  });
  it("4시부터는 오늘", () => {
    expect(nightCarryDate("2026-10-10", 4, false)).toBeNull();
  });
  it("어제 기록이 이미 있으면 오늘", () => {
    expect(nightCarryDate("2026-10-10", 1, true)).toBeNull();
  });
});

describe("growingSeries (그래프가 기록과 함께 자람)", () => {
  it("첫 기록 날부터 오늘까지만", () => {
    const s = growingSeries(happinessSeries([{ entry_date: "2026-10-08", happiness: 6 }, { entry_date: "2026-10-09", happiness: 8 }], [], "2026-10-10", 30));
    expect(s.map((p) => p.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10"]);
    expect(s[2]!.happiness).toBeNull();
  });
  it("기록이 없으면 빈 배열", () => {
    expect(growingSeries(happinessSeries([], [], "2026-10-10", 30))).toEqual([]);
  });
});

describe("moodTone", () => {
  it("긍정 · 무덤덤 · 부정", () => {
    expect(moodTone("평온")).toBe("pos");
    expect(moodTone("무덤덤")).toBe("neutral");
    expect(moodTone("후회스러움")).toBe("neg");
  });
});
