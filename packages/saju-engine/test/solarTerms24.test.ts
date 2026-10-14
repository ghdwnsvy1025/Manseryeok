/** 24절기 — 12중기도 12절입과 같은 寿星 고정밀 황경으로 구한다 (앱 운세의 "한로 사흘째"가 이걸 쓴다) */
import { expect, test } from "vitest";
import { SOLAR_TERMS_24, getSolarTermKSTIso, solarTermsOfYear } from "../src/solarTerms";
import { calculateSaju } from "../src/calculator";

test("24절기 표는 소한부터 15° 간격", () => {
  expect(SOLAR_TERMS_24).toHaveLength(24);
  SOLAR_TERMS_24.forEach((t, i) => expect(t.lon).toBe((285 + i * 15) % 360));
  expect(SOLAR_TERMS_24.filter((t) => t.jie)).toHaveLength(12);
});

test("2024년 24절기 날짜 (KASI 발표 날짜와 같음)", () => {
  const d = Object.fromEntries(solarTermsOfYear(2024).map((t) => [t.ko, t.date]));
  expect(d).toMatchObject({
    소한: "2024-01-06", 대한: "2024-01-20", 입춘: "2024-02-04", 우수: "2024-02-19",
    춘분: "2024-03-20", 하지: "2024-06-21", 추분: "2024-09-22", 동지: "2024-12-21",
  });
});

test("절입은 getSolarTermKSTIso와 같은 날", () => {
  for (const y of [1950, 1990, 2026]) {
    const list = solarTermsOfYear(y);
    SOLAR_TERMS_24.forEach((t, i) => {
      if (t.jie) expect(list[i]!.date).toBe(getSolarTermKSTIso(y, t.lon).slice(0, 10));
    });
  }
});

test("절입 시각은 한국천문연구원 발표값과 초 단위로 맞는다", () => {
  expect(getSolarTermKSTIso(2024, 315)).toBe("2024-02-04T17:27:07+09:00"); // 입춘
  expect(getSolarTermKSTIso(2024, 345)).toBe("2024-03-05T11:22:45+09:00"); // 경칩
  expect(getSolarTermKSTIso(2025, 315)).toBe("2025-02-03T23:10:28+09:00"); // 입춘
});

test("1900년 초 입력도 대운 절기(1899년)를 구할 수 있다", () => {
  const r = calculateSaju({
    year: 1900, month: 1, day: 10, hour: 12, minute: 0, gender: "male",
    options: { calendarType: "solar", timezone: "Asia/Seoul", dayChangeRule: "midnight", timeCorrection: "none" },
  });
  expect(r.pillars.year.ganji).toBe("己亥"); // 입춘 전이라 1899년
  expect(r.daeun).toBeTruthy();
  const late = calculateSaju({
    year: 2100, month: 12, day: 30, hour: 12, minute: 0, gender: "female",
    options: { calendarType: "solar", timezone: "Asia/Seoul", dayChangeRule: "midnight", timeCorrection: "none" },
  });
  expect(late.daeun).toBeTruthy();
});
