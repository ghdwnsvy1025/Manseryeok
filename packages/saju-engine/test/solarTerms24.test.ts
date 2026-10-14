/** 24절기 — 12중기도 12절입과 같은 뉴턴 반복으로 구한다 (앱 운세의 "한로 사흘째"가 이걸 쓴다) */
import { expect, test } from "vitest";
import { SOLAR_TERMS_24, getSolarTermKSTIso, solarTermsOfYear } from "../src/solarTerms";

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
