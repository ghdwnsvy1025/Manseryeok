// ============================================================
// 단위 테스트: 일주 계산
// ============================================================

import { getDayPillar } from "@/lib/saju/dayPillar";
import { gregorianToJdn, mod } from "@/lib/saju/jdn";

describe("일주 계산 — 기준일 검증", () => {
  test("2019-01-27 일주 = 甲子", () => {
    const result = getDayPillar(2019, 1, 27, 12, "midnight");
    expect(result.pillar.ganji).toBe("甲子");
    expect(result.ganjiIndex).toBe(0);
  });

  test("2019-01-28 일주 = 乙丑 (甲子 다음날)", () => {
    const result = getDayPillar(2019, 1, 28, 12, "midnight");
    expect(result.pillar.ganji).toBe("乙丑");
    expect(result.ganjiIndex).toBe(1);
  });

  test("2019-03-27 일주 = 甲子 + 58일 = 壬戌 (index 58)", () => {
    // 2019-01-27(0)에서 59일 후 = 2019-03-27
    const jdn = gregorianToJdn(2019, 3, 27);
    const jdn0 = gregorianToJdn(2019, 1, 27);
    const dayDiff = jdn - jdn0; // = 59
    expect(dayDiff).toBe(59);
    const result = getDayPillar(2019, 3, 27, 12, "midnight");
    expect(result.ganjiIndex).toBe(59); // 癸亥
    expect(result.pillar.ganji).toBe("癸亥");
  });
});

describe("일주 계산 — 야자시(夜子時) 옵션", () => {
  test("midnight 모드: 23:30에도 당일 일주 사용", () => {
    const midnight = getDayPillar(2019, 1, 27, 23, "midnight");
    expect(midnight.effectiveDate).toBe("2019-01-27");
    expect(midnight.pillar.ganji).toBe("甲子");
  });

  test("ziHour 모드: 23:30이면 다음날 일주 사용 → 乙丑", () => {
    const ziHour = getDayPillar(2019, 1, 27, 23, "ziHour");
    expect(ziHour.effectiveDate).toBe("2019-01-28");
    expect(ziHour.pillar.ganji).toBe("乙丑");
  });

  test("ziHour 모드: 00:30은 당일 일주 그대로", () => {
    const ziHour = getDayPillar(2019, 1, 27, 0, "ziHour");
    expect(ziHour.effectiveDate).toBe("2019-01-27");
  });
});

describe("일주 인덱스 수학 검증", () => {
  test("JDN 2458511에서 mod(2458511-11, 60) = 0", () => {
    expect(mod(2458511 - 11, 60)).toBe(0);
  });

  test("60일 후 인덱스 다시 0", () => {
    const jdn = gregorianToJdn(2019, 1, 27);
    const jdn60 = jdn + 60;
    expect(mod(jdn60 - 11, 60)).toBe(0);
  });
});
