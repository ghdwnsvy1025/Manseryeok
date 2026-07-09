import { describe, expect, test } from "@jest/globals";
import {
  getDayPillarForDate,
  getPartialPillarsForFields,
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

describe("getPartialPillarsForFields", () => {
  test("년 4자리만 입력 시 년주만 반환", () => {
    const result = getPartialPillarsForFields({ year: "2019", month: "", day: "" });
    expect(result.yearPillar).not.toBeNull();
    expect(result.monthPillar).toBeNull();
    expect(result.dayPillar).toBeNull();
  });

  test("년+월 입력 시 년주와 월주 반환", () => {
    const result = getPartialPillarsForFields({ year: "2019", month: "1", day: "" });
    expect(result.yearPillar).not.toBeNull();
    expect(result.monthPillar).not.toBeNull();
    expect(result.dayPillar).toBeNull();
  });

  test("완성된 유효 날짜는 년·월·일주 모두 반환", () => {
    const result = getPartialPillarsForFields({ year: "2019", month: "1", day: "27" });
    expect(result.yearPillar).not.toBeNull();
    expect(result.monthPillar).not.toBeNull();
    expect(result.dayPillar?.ganjiKo).toBe("갑자");
  });

  test("무효 날짜는 일주 없이 년·월주만 반환", () => {
    const result = getPartialPillarsForFields({ year: "2019", month: "2", day: "30" });
    expect(result.yearPillar).not.toBeNull();
    expect(result.monthPillar).not.toBeNull();
    expect(result.dayPillar).toBeNull();
  });

  test("미완성 년도는 모두 null", () => {
    const result = getPartialPillarsForFields({ year: "201", month: "1", day: "1" });
    expect(result.yearPillar).toBeNull();
    expect(result.monthPillar).toBeNull();
    expect(result.dayPillar).toBeNull();
  });

  test("범위 밖 년도는 모두 null", () => {
    const result = getPartialPillarsForFields({ year: "1899", month: "1", day: "1" });
    expect(result.yearPillar).toBeNull();
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
