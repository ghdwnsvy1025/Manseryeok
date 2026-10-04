import { describe, expect, test } from "vitest";
import { branchElementKo, byBranch, byElement, byStem, ganjiGrid, highlights, signalOf, stemElementKo } from "@/lib/stats/ganji";

const e = (index: number, stem: string, branch: string, happiness: number) => ({ day_ganji_index: index, day_stem: stem, day_branch: branch, happiness });

// 甲子=0, 乙丑=1, 辛亥=47, 乙卯=51
const ENTRIES = [
  e(47, "신", "해", 8),
  e(47, "신", "해", 9),
  e(51, "을", "묘", 3),
  e(51, "을", "묘", 4),
  e(0, "갑", "자", 6),
  e(7, "신", "미", 7),
  e(1, "을", "축", 5),
];

describe("60갑자 격자", () => {
  test("60칸, 이름과 한자가 맞고 평균이 묶인다", () => {
    const g = ganjiGrid(ENTRIES);
    expect(g).toHaveLength(60);
    expect(g[0]).toMatchObject({ index: 0, hanja: "甲子", ko: "갑자", n: 1, mean: 6 });
    expect(g[47]).toMatchObject({ hanja: "辛亥", ko: "신해", n: 2, mean: 8.5, signal: "약함" });
    expect(g[59]).toMatchObject({ hanja: "癸亥", ko: "계해", n: 0, mean: null, signal: "없음" });
  });

  test("빈 기록이면 전부 0", () => {
    expect(ganjiGrid([]).every((c) => c.n === 0 && c.mean === null)).toBe(true);
  });
});

describe("묶음", () => {
  test("천간·지지·오행", () => {
    const s = byStem(ENTRIES).find((b) => b.key === "신");
    expect(s).toMatchObject({ n: 3, mean: 8, signal: "보통" });
    const b = byBranch(ENTRIES).find((x) => x.key === "해");
    expect(b).toMatchObject({ n: 2, mean: 8.5 });
    expect(stemElementKo("신")).toBe("금");
    expect(branchElementKo("해")).toBe("수");
    const el = byElement(ENTRIES).find((x) => x.key === "금");
    expect(el).toMatchObject({ n: 3, mean: 8, ko: "쇠(금)" });
    expect(byElement(ENTRIES).map((x) => x.key)).toEqual(["목", "화", "토", "금", "수"]);
  });

  test("신호 단계", () => {
    expect(signalOf(0)).toBe("없음");
    expect(signalOf(2)).toBe("약함");
    expect(signalOf(3)).toBe("보통");
    expect(signalOf(7)).toBe("뚜렷함");
  });
});

describe("하이라이트", () => {
  test("최고·최저 간지는 2번 이상, 천간은 3번 이상일 때만", () => {
    const h = highlights(ENTRIES);
    expect(h.total).toBe(7);
    expect(h.bestGanji?.ko).toBe("신해");
    expect(h.worstGanji?.ko).toBe("을묘");
    expect(h.bestStem?.key).toBe("신");
    expect(h.bestBranch).toBeNull(); // 지지는 3번 이상 없음
    expect(h.unseen).toBe(55);
    expect(h.overallMean).toBe(6);
  });

  test("기록 없음", () => {
    const h = highlights([]);
    expect(h).toMatchObject({ total: 0, overallMean: null, bestGanji: null, worstGanji: null, unseen: 60 });
  });
});
