import { describe, expect, it } from "vitest";
import { happinessSeries, moodTop, pointStats, streakOf } from "@/lib/stats/extra";

const e = (entry_date: string, happiness: number, extra: Partial<{ moods: string[]; promise: "kept" | "missed" | "na" }> = {}) => ({
  entry_date,
  happiness,
  ...extra,
});

describe("pointStats", () => {
  it("해당 없음은 빼고 비율을 낸다", () => {
    const s = pointStats([e("2026-10-01", 8, { promise: "kept" }), e("2026-10-02", 4, { promise: "missed" }), e("2026-10-03", 6, { promise: "na" }), e("2026-10-04", 7)]);
    expect(s).toEqual({ answered: 2, kept: 1, rate: 50, keptMean: 8, missedMean: 4, recent: ["missed", "kept"] });
  });
  it("답한 날이 없으면 rate null", () => {
    expect(pointStats([e("2026-10-01", 5)]).rate).toBeNull();
  });
});

describe("moodTop", () => {
  it("횟수순, 같으면 평균 높은 쪽", () => {
    const top = moodTop([e("a", 9, { moods: ["기쁨", "설렘"] }), e("b", 3, { moods: ["피곤", "설렘"] }), e("c", 7, { moods: ["기쁨"] }), e("d", 2, { moods: ["피곤"] })]);
    expect(top.map((m) => m.mood)).toEqual(["기쁨", "설렘", "피곤"]);
    expect(top[0]).toEqual({ mood: "기쁨", n: 2, mean: 8 });
  });
});

describe("streakOf", () => {
  it("오늘 안 썼어도 어제까지 이어졌으면 센다", () => {
    const s = streakOf([e("2026-10-06", 5), e("2026-10-07", 5), e("2026-10-08", 5), e("2026-10-01", 5), e("2026-10-02", 5)], "2026-10-09");
    expect(s).toEqual({ current: 3, best: 3 });
  });
  it("이틀 비면 0", () => {
    expect(streakOf([e("2026-10-06", 5)], "2026-10-09").current).toBe(0);
  });
});

describe("happinessSeries", () => {
  it("기록·운세 없는 날은 null로 비운다", () => {
    const s = happinessSeries([e("2026-10-08", 10), e("2026-10-09", 1)], [{ fortune_date: "2026-10-09", score: 7.4 }], "2026-10-09", 3);
    expect(s.map((p) => p.date)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09"]);
    expect(s[0]).toEqual({ date: "2026-10-07", happiness: null, happiness10: null, avg7: null, fortune: null });
    expect(s[1]!.happiness10).toBe(10);
    expect(s[1]!.avg7).toBeNull(); // 창 안 1건
    expect(s[2]).toEqual({ date: "2026-10-09", happiness: 1, happiness10: 0, avg7: 5, fortune: 7.4 });
  });
});
