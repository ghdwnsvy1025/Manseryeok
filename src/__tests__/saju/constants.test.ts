// ============================================================
// 단위 테스트: 천간·지지·60갑자 상수
// ============================================================

import { STEMS, STEMS_KO, BRANCHES, BRANCHES_KO, GANJI_60 } from "@/lib/saju/constants";

describe("60갑자 상수", () => {
  test("STEMS 길이 = 10", () => {
    expect(STEMS.length).toBe(10);
  });

  test("BRANCHES 길이 = 12", () => {
    expect(BRANCHES.length).toBe(12);
  });

  test("GANJI_60 길이 = 60", () => {
    expect(GANJI_60.length).toBe(60);
  });

  test("GANJI_60[0] = 甲子", () => {
    expect(GANJI_60[0]).toBe("甲子");
  });

  test("GANJI_60[1] = 乙丑", () => {
    expect(GANJI_60[1]).toBe("乙丑");
  });

  test("GANJI_60[59] = 癸亥", () => {
    expect(GANJI_60[59]).toBe("癸亥");
  });

  test("STEMS 첫 원소 = 甲", () => {
    expect(STEMS[0]).toBe("甲");
  });

  test("BRANCHES 첫 원소 = 子", () => {
    expect(BRANCHES[0]).toBe("子");
  });

  test("STEMS_KO[0] = 갑", () => {
    expect(STEMS_KO[0]).toBe("갑");
  });

  test("BRANCHES_KO[0] = 자", () => {
    expect(BRANCHES_KO[0]).toBe("자");
  });
});
