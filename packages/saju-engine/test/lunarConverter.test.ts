/**
 * 음력→양력 변환 회귀. 한국천문연구원 음력(korean-lunar-calendar) 기준.
 * 1.0.0까지는 lunar-javascript(중국 음력)라 초하루·윤달 위치가 한국과 다른 달이 있었다.
 */
import { describe, expect, test } from "@jest/globals";
import { lunarToSolar } from "../src/lunarConverter";
import { calculateSaju } from "../src/calculator";

const lunarMidnight = {
  calendarType: "lunar" as const,
  timezone: "Asia/Seoul",
  dayChangeRule: "midnight" as const,
  timeCorrection: "none" as const,
};

describe("lunarToSolar", () => {
  test("평달: 음력 1990-04-21 → 양력 1990-05-15", () => {
    const result = lunarToSolar(1990, 4, 21, false);
    expect(result.outputSolar).toEqual({ year: 1990, month: 5, day: 15 });
    expect(result.outputSolarString).toBe("1990-05-15");
    expect(result.inputLunar).toEqual({ year: 1990, month: 4, day: 21, isLeap: false });
  });

  test("평달: 음력 2023-02-15 → 양력 2023-03-06", () => {
    expect(lunarToSolar(2023, 2, 15, false).outputSolarString).toBe("2023-03-06");
  });

  test("윤달: 음력 2023 윤2월 15일 → 양력 2023-04-05", () => {
    const result = lunarToSolar(2023, 2, 15, true);
    expect(result.outputSolarString).toBe("2023-04-05");
    expect(result.inputLunar.isLeap).toBe(true);
  });

  test("존재하지 않는 윤달: 2023 윤3월은 '존재하지' 오류", () => {
    expect(() => lunarToSolar(2023, 3, 15, true)).toThrow(/존재하지/);
  });

  test("존재하지 않는 날: 29일까지인 달의 30일은 '존재하지' 오류", () => {
    // 음력 2023년 1월은 29일까지
    expect(() => lunarToSolar(2023, 1, 30, false)).toThrow(/존재하지/);
  });

  test("한국 음력과 중국 음력이 다른 달은 한국 음력을 따른다", () => {
    expect(lunarToSolar(1990, 9, 1, false).outputSolarString).toBe("1990-10-19"); // 중국 음력은 10/18
    expect(lunarToSolar(2023, 3, 30, false).outputSolarString).toBe("2023-05-19"); // 중국 음력 3월은 29일까지
    expect(lunarToSolar(2012, 3, 1, true).outputSolarString).toBe("2012-04-21"); // 한국 윤3월 (중국은 윤4월)
    expect(lunarToSolar(2017, 5, 1, true).outputSolarString).toBe("2017-06-24"); // 한국 윤5월 (중국은 윤6월)
    expect(() => lunarToSolar(2012, 4, 1, true)).toThrow(/존재하지/);
    expect(() => lunarToSolar(2017, 6, 1, true)).toThrow(/존재하지/);
  });

  test("범위 밖 입력은 범위 오류 (한국 음력 데이터는 1900-2050)", () => {
    expect(() => lunarToSolar(1899, 1, 1, false)).toThrow(/지원 범위/);
    expect(() => lunarToSolar(2051, 1, 1, false)).toThrow(/지원 범위/);
    expect(lunarToSolar(1900, 1, 1, false).outputSolarString).toBe("1900-01-31");
    expect(lunarToSolar(2050, 1, 1, false).outputSolarString).toBe("2050-01-23");
    expect(() => lunarToSolar(2023, 13, 1, false)).toThrow(/월 범위/);
    expect(() => lunarToSolar(2023, 1, 31, false)).toThrow(/일 범위/);
  });
});

describe("calculateSaju — calendarType lunar", () => {
  test("음력 1990-04-21 14:30 남 = 양력 1990-05-15 fixture와 같은 기둥", () => {
    const result = calculateSaju({
      year: 1990,
      month: 4,
      day: 21,
      hour: 14,
      minute: 30,
      gender: "male",
      options: lunarMidnight,
    });
    expect(result.input.lunarConversion?.outputSolar).toBe("1990-05-15");
    expect(result.pillars.year.ganji).toBe("庚午");
    expect(result.pillars.month.ganji).toBe("辛巳");
    expect(result.pillars.day.ganji).toBe("庚辰");
    expect(result.pillars.hour?.ganji).toBe("癸未");
  });

  test("윤달 입력: 음력 2023 윤2월 15일 → 양력 2023-04-05", () => {
    const result = calculateSaju({
      year: 2023,
      month: 2,
      day: 15,
      hour: 12,
      minute: 0,
      gender: "female",
      options: { ...lunarMidnight, isLeapMonth: true },
    });
    expect(result.input.lunarConversion?.outputSolar).toBe("2023-04-05");
  });
});
