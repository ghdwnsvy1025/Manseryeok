/**
 * Phase 1 Legacy 회귀: 만세력 calculateSaju 고정 입력 → 기둥 불변
 * 알고리즘을 바꾸면 이 테스트가 실패해야 한다.
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput } from "@/lib/saju/types";
import { getDayPillar } from "@/lib/saju/dayPillar";
import { ELEMENT_ORDER } from "@/lib/saju/elementDistribution";

const solarMidnight = {
  calendarType: "solar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

describe("Legacy 만세력 회귀 — calculateSaju", () => {
  test("fixture native-001: 1990-05-15 14:30 양력 남", () => {
    const input: SajuInput = {
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      gender: "male",
      options: solarMidnight,
    };
    const result = calculateSaju(input);
    expect(result.pillars.year.ganji).toBe("庚午");
    expect(result.pillars.month.ganji).toBe("辛巳");
    expect(result.pillars.day.ganji).toBe("庚辰");
    expect(result.pillars.hour?.ganji).toBe("癸未");
    expect(result.elementDistribution).not.toBeNull();
    const pct = result.elementDistribution!.percentage;
    expect(pct).toEqual({
      목: 10.67,
      화: 31.77,
      토: 26.69,
      금: 22.49,
      수: 8.38,
    });
    const sum = ELEMENT_ORDER.reduce((a, el) => a + pct[el], 0);
    expect(sum).toBeGreaterThan(99.5);
    expect(sum).toBeLessThan(100.5);
  });

  test("fixture day-anchor: 2019-01-27 일주 甲子 (계산기·일진 일치)", () => {
    const dayOnly = getDayPillar(2019, 1, 27, 12, "midnight");
    expect(dayOnly.pillar.ganji).toBe("甲子");

    const result = calculateSaju({
      year: 2019,
      month: 1,
      day: 27,
      hour: 12,
      minute: 0,
      gender: "female",
      options: solarMidnight,
    });
    expect(result.pillars.day.ganji).toBe("甲子");
    expect(result.debug.effectiveDateForDayPillar).toBe("2019-01-27");
  });

  test("fixture boundary ziHour: 23:30은 야자시 옵션에 따라 일주 변경", () => {
    const midnight = calculateSaju({
      year: 2019,
      month: 1,
      day: 27,
      hour: 23,
      minute: 30,
      gender: "male",
      options: solarMidnight,
    });
    expect(midnight.pillars.day.ganji).toBe("甲子");

    const zi = calculateSaju({
      year: 2019,
      month: 1,
      day: 27,
      hour: 23,
      minute: 30,
      gender: "male",
      options: {
        ...solarMidnight,
        dayChangeRule: "ziHour",
      },
    });
    expect(zi.pillars.day.ganji).toBe("乙丑");
  });

  test("동일 입력 두 번 호출 결과가 기둥·오행 percentage에서 일치", () => {
    const input: SajuInput = {
      year: 2000,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      gender: "female",
      options: solarMidnight,
    };
    const a = calculateSaju(input);
    const b = calculateSaju(input);
    expect(a.pillars.year.ganji).toBe(b.pillars.year.ganji);
    expect(a.pillars.month.ganji).toBe(b.pillars.month.ganji);
    expect(a.pillars.day.ganji).toBe(b.pillars.day.ganji);
    expect(a.pillars.hour?.ganji).toBe(b.pillars.hour?.ganji);
    expect(a.elementDistribution?.percentage).toEqual(
      b.elementDistribution?.percentage
    );
  });
});
