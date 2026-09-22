// ============================================================
// 단위 테스트: 시간 보정이 자정을 넘을 때 날짜 이동
// 보정된 시각이 전날/다음날로 넘어가면 일/월/년도 함께 이동해야 하며,
// 결과는 "이동된 날짜·시각을 보정 없이 입력한 경우"와 같아야 한다.
// ============================================================

import { calculateSaju } from "@/lib/saju/calculator";
import { addMinutesToDateTime } from "@/lib/saju/jdn";
import type { SajuInput, TimeCorrection } from "@/lib/saju/types";

const SEOUL_LON = 126.98; // (126.98 - 135) * 4 = -32.08분 → -32분
const EAST_LON = 143; // (143 - 135) * 4 = +32분

function makeInput(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeCorrection: TimeCorrection,
  longitude: number
): SajuInput {
  return {
    year,
    month,
    day,
    hour,
    minute,
    gender: "male",
    options: {
      calendarType: "solar",
      timezone: "Asia/Seoul",
      location: { longitude },
      dayChangeRule: "ziHour",
      timeCorrection,
    },
  };
}

/** 보정 결과가 "이동된 날짜·시각 + 보정 없음" 결과와 일치하는지 확인 */
function expectSameAsUncorrected(
  corrected: [number, number, number, number, number],
  longitude: number,
  expected: [number, number, number, number, number]
) {
  const actual = calculateSaju(makeInput(...corrected, "localMeanSolarTime", longitude));
  const reference = calculateSaju(makeInput(...expected, "none", longitude));

  expect(actual.input.normalizedSolarDate).toBe(reference.input.normalizedSolarDate);
  expect(actual.input.normalizedSolarDateTime).toBe(reference.input.normalizedSolarDateTime);
  expect(actual.pillars).toEqual(reference.pillars);
  expect(actual.daeun).toEqual(reference.daeun);
  expect(actual.debug.effectiveDateForDayPillar).toBe(reference.debug.effectiveDateForDayPillar);

  return actual;
}

describe("addMinutesToDateTime", () => {
  test("같은 날 안에서는 날짜 유지", () => {
    expect(addMinutesToDateTime(1990, 5, 15, 12, 0, -32)).toEqual({
      year: 1990, month: 5, day: 15, hour: 11, minute: 28,
    });
  });

  test("음수 보정으로 전날/전월/전년 이동", () => {
    expect(addMinutesToDateTime(1990, 5, 15, 0, 10, -32)).toEqual({
      year: 1990, month: 5, day: 14, hour: 23, minute: 38,
    });
    expect(addMinutesToDateTime(1990, 5, 1, 0, 10, -32)).toEqual({
      year: 1990, month: 4, day: 30, hour: 23, minute: 38,
    });
    expect(addMinutesToDateTime(1990, 1, 1, 0, 10, -32)).toEqual({
      year: 1989, month: 12, day: 31, hour: 23, minute: 38,
    });
  });

  test("윤년 3월 1일 → 2월 29일", () => {
    expect(addMinutesToDateTime(2000, 3, 1, 0, 0, -1)).toEqual({
      year: 2000, month: 2, day: 29, hour: 23, minute: 59,
    });
  });

  test("양수 보정으로 다음날/다음해 이동", () => {
    expect(addMinutesToDateTime(1990, 12, 31, 23, 50, 32)).toEqual({
      year: 1991, month: 1, day: 1, hour: 0, minute: 22,
    });
  });
});

describe("시간 보정 — 자정 넘김 시 날짜 이동 (평균태양시)", () => {
  test("평일 00:10 (서울) → 전날 23:38, 일주 庚辰 / 시주 丙子", () => {
    const result = expectSameAsUncorrected([1990, 5, 15, 0, 10], SEOUL_LON, [1990, 5, 14, 23, 38]);

    expect(result.input.normalizedSolarDateTime).toBe("1990-05-14T23:38:00+09:00");
    expect(result.pillars.day.ganji).toBe("庚辰");
    expect(result.pillars.hour?.ganji).toBe("丙子");
  });

  test("매월 1일 00:10 → 전월 말일 23:38", () => {
    const result = expectSameAsUncorrected([1990, 5, 1, 0, 10], SEOUL_LON, [1990, 4, 30, 23, 38]);

    expect(result.input.normalizedSolarDate).toBe("1990-04-30");
  });

  test("1월 1일 00:10 → 전년 12월 31일 23:38", () => {
    const result = expectSameAsUncorrected([1990, 1, 1, 0, 10], SEOUL_LON, [1989, 12, 31, 23, 38]);

    expect(result.input.normalizedSolarDate).toBe("1989-12-31");
  });

  test("동경 135° 동쪽(+32분): 23:50 → 다음날 00:22", () => {
    const result = expectSameAsUncorrected([1990, 5, 14, 23, 50], EAST_LON, [1990, 5, 15, 0, 22]);

    expect(result.input.normalizedSolarDateTime).toBe("1990-05-15T00:22:00+09:00");
  });

  test("동경 135° 동쪽(+32분): 12월 31일 23:50 → 다음해 1월 1일 00:22", () => {
    const result = expectSameAsUncorrected([1990, 12, 31, 23, 50], EAST_LON, [1991, 1, 1, 0, 22]);

    expect(result.input.normalizedSolarDate).toBe("1991-01-01");
  });

  test("자정을 넘지 않는 보정은 날짜 유지", () => {
    const result = expectSameAsUncorrected([1990, 5, 15, 12, 0], SEOUL_LON, [1990, 5, 15, 11, 28]);

    expect(result.input.normalizedSolarDate).toBe("1990-05-15");
  });
});

describe("시간 보정 — 자정 넘김 시 날짜 이동 (진태양시)", () => {
  test("00:10 (서울) → 전날로 이동, 일주 庚辰", () => {
    const result = calculateSaju(makeInput(1990, 5, 15, 0, 10, "trueSolarTime", SEOUL_LON));

    expect(result.input.normalizedSolarDate).toBe("1990-05-14");
    expect(result.input.normalizedSolarDateTime.slice(11, 13)).toBe("23");
    expect(result.pillars.day.ganji).toBe("庚辰");
    expect(result.pillars.hour?.ganji).toBe("丙子");
  });
});
