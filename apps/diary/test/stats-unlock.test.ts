// 2026-10-31: 운세 적중률, 다음에 열리는 통계, 영역 육각형, 영역별 글자 막대
import { describe, expect, test } from "vitest";
import { areaRadar, fortuneAccuracy, nextUnlock, type StatEntry } from "@/lib/stats/extra";
import { areaGlyphs } from "@/lib/stats/ganji";
import { dayGanji } from "@/lib/ganji";

const e = (d: string, h: number, areas: StatEntry["areas"] = null) => {
  const g = dayGanji(d);
  return { entry_date: d, happiness: h, areas, day_ganji_index: g.index, day_stem: g.stemKo, day_branch: g.branchKo };
};

describe("운세 적중률", () => {
  test("맞아요 비율, 최근 10개는 오래된 → 최근", () => {
    const a = fortuneAccuracy([
      { fortune_date: "2026-10-03", vote: -1 },
      { fortune_date: "2026-10-01", vote: 1 },
      { fortune_date: "2026-10-02", vote: 1 },
    ]);
    expect(a).toEqual({ answered: 3, hit: 2, rate: 67, recent: [1, 1, -1] });
    expect(fortuneAccuracy([]).rate).toBeNull();
  });
});

describe("다음에 열리는 것 하나", () => {
  test("순서대로 하나만, 다 열리면 null", () => {
    expect(nextUnlock({ days: 1, areaDays: 0, votes: 0, months: 1 })).toMatchObject({ title: "행복도 그래프", have: 1, need: 2 });
    expect(nextUnlock({ days: 2, areaDays: 0, votes: 0, months: 1 })?.title).toBe("글자별 내 행복도");
    expect(nextUnlock({ days: 5, areaDays: 0, votes: 3, months: 1 })?.title).toBe("영역별 행복도");
    expect(nextUnlock({ days: 5, areaDays: 2, votes: 0, months: 1 })?.title).toBe("운세 적중률");
    expect(nextUnlock({ days: 5, areaDays: 2, votes: 1, months: 1 })?.title).toBe("1년 그래프");
    expect(nextUnlock({ days: 40, areaDays: 9, votes: 4, months: 2 })).toBeNull();
  });
});

describe("영역 육각형·글자 막대", () => {
  test("이번 달·지난달 평균 단계, 매긴 날 없으면 null", () => {
    const rows = areaRadar([e("2026-10-02", 8, { work: 4, love: 2 }), e("2026-10-05", 6, { work: 2 }), e("2026-09-20", 6, { work: 5 })], "2026-10");
    expect(rows[0]).toMatchObject({ key: "work", cur: 3, prev: 5 });
    expect(rows[4]).toMatchObject({ key: "love", cur: 2, prev: null });
    expect(rows[1]!.cur).toBeNull();
  });
  test("영역 점수(×2)를 천간·지지·오행으로, 영역 점수 없는 기록은 빠진다", () => {
    const rows = [e("2026-10-02", 8, { money: 4 }), e("2026-10-03", 6, null)];
    const g = areaGlyphs(rows).find((a) => a.key === "money")!;
    expect(g.n).toBe(1);
    const stem = g.stems.find((b) => b.ko === dayGanji("2026-10-02").stemKo)!;
    expect(stem).toMatchObject({ n: 1, mean: 8 });
    expect(areaGlyphs(rows).find((a) => a.key === "work")!.n).toBe(0);
  });
});
