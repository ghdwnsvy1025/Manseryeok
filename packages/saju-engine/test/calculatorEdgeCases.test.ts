/**
 * calculateSaju 경계 케이스 회귀
 * - 음력 30일 입력
 * - 시간 보정으로 자정을 넘길 때 날짜 이동
 * - 월 절기 끝 시각(debug) 연도
 */
import { describe, expect, test } from "@jest/globals";
import { calculateSaju } from "../src/calculator";

const baseOptions = {
  calendarType: "solar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

describe("calculateSaju 경계 케이스", () => {
  test("음력 2월 30일(1990)은 양력 날짜 검사로 거부되지 않는다", () => {
    const result = calculateSaju({
      year: 1990,
      month: 2,
      day: 30,
      hour: 10,
      minute: 0,
      gender: "female",
      options: { ...baseOptions, calendarType: "lunar" },
    });
    expect(result.input.lunarConversion?.outputSolar).toBe("1990-03-26");
  });

  test("일반 음력 날짜와 윤달이 양력으로 변환된다", () => {
    const opts = { ...baseOptions, calendarType: "lunar" as const };
    const normal = calculateSaju({
      year: 1990, month: 3, day: 1, hour: 10, minute: 0, gender: "male", options: opts,
    });
    expect(normal.input.lunarConversion?.outputSolar).toBe("1990-03-27");

    // 1990년은 윤5월이 있다
    const leap = calculateSaju({
      year: 1990, month: 5, day: 1, hour: 10, minute: 0, gender: "male",
      options: { ...opts, isLeapMonth: true },
    });
    const nonLeap = calculateSaju({
      year: 1990, month: 5, day: 1, hour: 10, minute: 0, gender: "male", options: opts,
    });
    expect(leap.input.lunarConversion?.outputSolar).not.toBe(
      nonLeap.input.lunarConversion?.outputSolar
    );
  });

  test("윤달이 없는 달을 윤달로 넣으면 오류", () => {
    expect(() =>
      calculateSaju({
        year: 1990, month: 3, day: 1, hour: 10, minute: 0, gender: "male",
        options: { ...baseOptions, calendarType: "lunar", isLeapMonth: true },
      })
    ).toThrow();
  });

  test("존재하지 않는 음력 날짜는 여전히 오류", () => {
    expect(() =>
      calculateSaju({
        year: 1990,
        month: 1,
        day: 30,
        hour: 10,
        minute: 0,
        gender: "female",
        options: { ...baseOptions, calendarType: "lunar" },
      })
    ).toThrow();
  });

  test("평균태양시 보정으로 자정 이전이 되면 전날 일주를 쓴다", () => {
    const corrected = calculateSaju({
      year: 1990,
      month: 5,
      day: 15,
      hour: 0,
      minute: 10,
      gender: "male",
      options: {
        ...baseOptions,
        timeCorrection: "localMeanSolarTime",
        location: { longitude: 127 }, // −32분
      },
    });
    const expected = calculateSaju({
      year: 1990,
      month: 5,
      day: 14,
      hour: 23,
      minute: 38,
      gender: "male",
      options: baseOptions,
    });

    expect(corrected.input.normalizedSolarDateTime).toBe("1990-05-14T23:38:00+09:00");
    expect(corrected.pillars.day.ganji).toBe(expected.pillars.day.ganji);
    expect(corrected.pillars.hour?.ganji).toBe(expected.pillars.hour?.ganji);
  });

  test("월 절기 끝 시각은 다음 절입(같은 해)을 가리킨다", () => {
    const may = calculateSaju({
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      gender: "male",
      options: baseOptions,
    });
    expect(may.debug.usedMonthSolarTermStart.startsWith("1990-05-06")).toBe(true);
    expect(may.debug.usedMonthSolarTermEnd.startsWith("1990-06-06")).toBe(true);

    const dec = calculateSaju({
      year: 1990,
      month: 12,
      day: 20,
      hour: 10,
      minute: 0,
      gender: "female",
      options: baseOptions,
    });
    expect(dec.debug.usedMonthSolarTermEnd.startsWith("1991-01-06")).toBe(true);

    const jan = calculateSaju({
      year: 1991,
      month: 1,
      day: 20,
      hour: 10,
      minute: 0,
      gender: "female",
      options: baseOptions,
    });
    expect(jan.debug.usedMonthSolarTermName).toBe("소한(小寒)");
    expect(jan.debug.usedMonthSolarTermEnd.startsWith("1991-02-04")).toBe(true);
  });
});
