// ============================================================
// 단위 테스트: Julian Day Number
// ============================================================

import { gregorianToJdn, jdeToKSTIso, jdnToGregorian, mod } from "../src/jdn";
import { getSolarTermKSTIso } from "../src/solarTerms";

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

describe("jdeToKSTIso", () => {
  test("초 반올림이 60초를 만들지 않고 분·시·날로 올라간다", () => {
    // KST 2000-02-04 21:36:59.6 → 21:37:00
    const kst = Date.UTC(2000, 1, 4, 12, 36, 59, 600);
    const jd = kst / 86400000 + 2440587.5;
    expect(jdeToKSTIso(jd)).toBe("2000-02-04T21:37:00+09:00");
    // KST 2000-02-04 23:59:59.7 → 다음 날 00:00:00
    const midnight = Date.UTC(2000, 1, 4, 14, 59, 59, 700) / 86400000 + 2440587.5;
    expect(jdeToKSTIso(midnight)).toBe("2000-02-05T00:00:00+09:00");
  });

  test("1900-2100 절입 시각 어디에도 60초·60분이 없다", () => {
    for (let y = 1900; y <= 2100; y++) {
      for (const lon of [285, 315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255]) {
        expect(getSolarTermKSTIso(y, lon)).not.toMatch(/:60/);
      }
    }
  });
});
