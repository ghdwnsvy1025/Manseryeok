import { describe, expect, test } from "@jest/globals";
import {
  getDayPillarForDate,
  getPillarsForDate,
  isValidDateString,
  resolveDateString,
} from "@/lib/diary/dayPillar";

describe("getDayPillarForDate", () => {
  test("2019-01-27 = 갑자", () => {
    const p = getDayPillarForDate("2019-01-27");
    expect(p.ganji).toBe("甲子");
    expect(p.ganjiKo).toBe("갑자");
    expect(p.ganjiIndex).toBe(0);
  });

  test("2019-01-28 = 을축", () => {
    const p = getDayPillarForDate("2019-01-28");
    expect(p.ganjiKo).toBe("을축");
  });
});

describe("getPillarsForDate", () => {
  test("월주와 일주를 함께 반환한다", () => {
    const result = getPillarsForDate("2019-01-27");
    expect(result.dayPillar.ganjiKo).toBe("갑자");
    expect(result.monthPillarKo).toMatch(/^.+$/);
  });
});

describe("resolveDateString", () => {
  test("빈 문자열은 오늘 날짜로 대체", () => {
    expect(isValidDateString("")).toBe(false);
    const resolved = resolveDateString("");
    expect(isValidDateString(resolved)).toBe(true);
  });

  test("유효한 날짜는 그대로 반환", () => {
    expect(resolveDateString("2026-07-08")).toBe("2026-07-08");
  });
});
