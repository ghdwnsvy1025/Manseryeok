// ============================================================
// 단위 테스트: 시주 계산
// ============================================================

import { getHourBranchOrder, getHourPillar } from "@/lib/saju/hourPillar";

describe("시지(時支) 결정 — getHourBranchOrder", () => {
  test("00:00 → 子(0)", () => expect(getHourBranchOrder(0, 0)).toBe(0));
  test("00:30 → 子(0)", () => expect(getHourBranchOrder(0, 30)).toBe(0));
  test("00:59 → 子(0)", () => expect(getHourBranchOrder(0, 59)).toBe(0));
  test("01:00 → 丑(1)", () => expect(getHourBranchOrder(1, 0)).toBe(1));
  test("02:59 → 丑(1)", () => expect(getHourBranchOrder(2, 59)).toBe(1));
  test("03:00 → 寅(2)", () => expect(getHourBranchOrder(3, 0)).toBe(2));
  test("22:59 → 亥(11)", () => expect(getHourBranchOrder(22, 59)).toBe(11));
  test("23:00 → 子(0)", () => expect(getHourBranchOrder(23, 0)).toBe(0));
  test("23:59 → 子(0)", () => expect(getHourBranchOrder(23, 59)).toBe(0));
});

describe("시주 계산 — 스펙 검증", () => {
  // 甲일(index=0) 子시(order=0) → 甲子시
  // hourStemIndex = ((0 % 5) * 2 + 0) % 10 = 0 → 甲
  test("甲일 23:30 (子시) → 甲子시", () => {
    const result = getHourPillar(0, 23, 30);
    expect(result.pillar.ganji).toBe("甲子");
  });

  // 乙일(index=1) 子시(order=0) → 丙子시
  // hourStemIndex = ((1 % 5) * 2 + 0) % 10 = 2 → 丙
  test("乙일 00:30 (子시) → 丙子시", () => {
    const result = getHourPillar(1, 0, 30);
    expect(result.pillar.ganji).toBe("丙子");
  });

  // 丙일(index=2) 子시 → 戊子시
  test("丙일 子시 → 戊子시", () => {
    const result = getHourPillar(2, 0, 0);
    expect(result.pillar.ganji).toBe("戊子");
  });

  // 丁일(index=3) 子시 → 庚子시
  test("丁일 子시 → 庚子시", () => {
    const result = getHourPillar(3, 23, 0);
    expect(result.pillar.ganji).toBe("庚子");
  });

  // 戊일(index=4) 子시 → 壬子시
  test("戊일 子시 → 壬子시", () => {
    const result = getHourPillar(4, 0, 30);
    expect(result.pillar.ganji).toBe("壬子");
  });

  // 甲일 午시(order=6) → 庚午시
  // hourStemIndex = ((0 % 5) * 2 + 6) % 10 = 6 → 庚
  test("甲일 午시(12:30) → 庚午시", () => {
    const result = getHourPillar(0, 12, 30);
    expect(result.pillar.ganji).toBe("庚午");
  });

  test("시지 순서 확인: 申시는 order=8", () => {
    const result = getHourPillar(0, 15, 30);
    expect(result.hourBranchOrder).toBe(8);
  });
});
