// 원국 기준: 일기 앱 computeProfile은 사주 코어 fromBirth와 같은 네 기둥을 낸다 (2026-11-05 결정)
import { fromBirth } from "@saju/core-rules";
import { describe, expect, test } from "vitest";
import { toBirthInput } from "@/lib/fortune/core";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const base: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 5, birthDay: 15, birthHour: 14, birthMinute: 30, city: "seoul" };

function pillars(p: BirthProfile) {
  const r = computeProfile({ name: "x", ...p });
  if (!r.ok) throw new Error(r.error);
  return r.value.pillars;
}
const when = (y: number, m: number, d: number, h: number, mi: number): BirthProfile => ({ ...base, birthYear: y, birthMonth: m, birthDay: d, birthHour: h, birthMinute: mi });

describe("원국 기준", () => {
  test("23시 날 바뀜: 보정 시각 23시대는 다음 날 일주와 그 날 기준 시주", () => {
    const q = pillars(when(1990, 5, 15, 23, 50));
    expect(q.day.ko).toBe("신사");
    expect(q.hour?.ko).toBe("무자");
  });

  test("자정 직후: 보정 시각이 전날 23시대로 넘어가도 일주는 입력한 날", () => {
    const q = pillars(when(1990, 5, 15, 0, 10));
    expect(q.day.ko).toBe("경진");
    expect(q.hour?.ko).toBe("병자");
  });

  test("서머타임: 1988-07-01 08:00은 표준시 07:00, 경도 보정 뒤 06:28이라 묘시", () => {
    expect(pillars(when(1988, 7, 1, 8, 0)).hour?.branch).toBe("卯");
  });

  test("동경 127.5° 기간: 1957-01-10 13:10은 경도 보정 뒤 13:08이라 미시", () => {
    expect(pillars(when(1957, 1, 10, 13, 10)).hour?.branch).toBe("未");
  });

  test("균시차를 쓰지 않음: 1990-11-03 15:20은 경도 보정만 해서 14:48, 미시", () => {
    expect(pillars(when(1990, 11, 3, 15, 20)).hour?.branch).toBe("未");
  });

  test("시각 모름은 시주가 없다", () => {
    expect(pillars({ ...base, birthHour: null, birthMinute: null }).hour).toBeNull();
  });

  test("스냅숏 모양: 한자 천간·지지와 한글 간지", () => {
    expect(pillars(base).year).toEqual({ stem: "庚", branch: "午", ko: "경오" });
  });

  test("없는 날짜는 거절한다: 시각이 있어도 2월 30일을 3월로 넘기지 않는다", () => {
    expect(computeProfile({ name: "x", ...when(1990, 2, 30, 12, 0) }).ok).toBe(false);
  });

  test("코어 fromBirth와 네 기둥이 같다: 도시·예외 기간·경계 시각·음력을 섞어서", () => {
    const cities: BirthProfile["city"][] = ["seoul", "busan", "jeju", "gangwon", "other"];
    const cases: BirthProfile[] = [];
    for (const [y, m, d] of [[1950, 7, 1], [1957, 1, 10], [1958, 6, 15], [1961, 8, 9], [1961, 8, 10], [1987, 5, 10], [1988, 7, 1], [1988, 10, 9], [1990, 2, 4], [2000, 1, 1], [2024, 12, 31]] as const) {
      for (const [h, mi] of [[0, 0], [0, 40], [1, 0], [11, 45], [22, 59], [23, 0], [23, 40]] as const) {
        cases.push({ ...when(y, m, d, h, mi), city: cities[(y + h) % cities.length]! });
      }
    }
    cases.push({ ...when(1990, 5, 15, 23, 50), calendar: "lunar", isLeapMonth: true });
    cases.push({ ...base, birthMonth: 2, birthDay: 4, birthHour: null, birthMinute: null });
    for (const p of cases) {
      const q = pillars(p);
      const mine = [q.year.stem + q.year.branch, q.month.stem + q.month.branch, q.day.stem + q.day.branch, q.hour ? q.hour.stem + q.hour.branch : null];
      expect(mine).toEqual(fromBirth(toBirthInput(p)).pillars);
    }
  });
});
