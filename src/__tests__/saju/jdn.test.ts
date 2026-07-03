// ============================================================
// 단위 테스트: Julian Day Number
// ============================================================

import { gregorianToJdn, jdnToGregorian, mod } from "@/lib/saju/jdn";

describe("gregorianToJdn", () => {
  test("2019-01-27 = JDN 2458511 (기준일 검증)", () => {
    expect(gregorianToJdn(2019, 1, 27)).toBe(2458511);
  });

  test("2000-01-01 = JDN 2451545", () => {
    // J2000.0 기준일
    expect(gregorianToJdn(2000, 1, 1)).toBe(2451545);
  });

  test("1990-06-02 → JDN 차이 검증 (2019-01-27 기준)", () => {
    const jdn1990 = gregorianToJdn(1990, 6, 2);
    const jdn2019 = gregorianToJdn(2019, 1, 27);
    // 두 날짜 간격이 양수여야 함 (1990 < 2019)
    expect(jdn2019 - jdn1990).toBeGreaterThan(0);
    // 실제 일수 검증: jdn2019 - jdn1990 = 10466
    expect(jdn2019 - jdn1990).toBe(10466);
  });

  test("mod 함수 음수 처리", () => {
    expect(mod(-1, 60)).toBe(59);
    expect(mod(61, 60)).toBe(1);
    expect(mod(0, 60)).toBe(0);
  });
});

describe("jdnToGregorian", () => {
  test("JDN 2451545 → 2000-01-01 UT 정오", () => {
    const result = jdnToGregorian(2451545.0);
    expect(result.year).toBe(2000);
    expect(result.month).toBe(1);
    expect(result.day).toBe(1);
    expect(result.hour).toBe(12); // 정오
    expect(result.minute).toBe(0);
  });

  test("JDN 2458511 → 2019-01-27", () => {
    const result = jdnToGregorian(2458511.0);
    expect(result.year).toBe(2019);
    expect(result.month).toBe(1);
    expect(result.day).toBe(27);
  });
});
