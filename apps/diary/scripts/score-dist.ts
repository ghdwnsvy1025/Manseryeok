/** 점수 분포 측정 — 테스트 사주 6개 × 2026년 365일. 모델·DB 없음. raw 합(0.5 기준 전)과 현재 10점 분포를 찍는다 */
import { test } from "vitest";
import { computeCoreFortune } from "@/lib/fortune/core";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";
import { addDays } from "@/lib/time";

const P: BirthProfile[] = [
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 5, birthDay: 15, birthHour: null, birthMinute: null, city: "seoul" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1984, birthMonth: 11, birthDay: 3, birthHour: 7, birthMinute: 30, city: "busan" },
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 2001, birthMonth: 8, birthDay: 21, birthHour: 22, birthMinute: 10, city: "daegu" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1972, birthMonth: 3, birthDay: 9, birthHour: 15, birthMinute: 0, city: "gwangju" },
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1988, birthMonth: 7, birthDay: 27, birthHour: 4, birthMinute: 20, city: "incheon" },
];

test("score distribution", () => {
  const sums: number[] = [];
  const s10: number[] = [];
  for (const p of P) {
    const prof = computeProfile({ ...p, name: "x" });
    if (!prof.ok) throw new Error(prof.error);
    for (let i = 0; i < 365; i++) {
      const date = addDays("2026-01-01", i);
      const g = dayGanji(date);
      const c = computeCoreFortune({ pillars: prof.value.pillars, profile: p, date, todayHanja: g.hanja });
      sums.push(c.parts.raw + c.parts.rel + c.parts.ctx);
      s10.push(Math.round(c.parts.score01 * 100) / 10);
    }
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
  const hist = (xs: number[]) => { const h: Record<string, number> = {}; for (const x of xs) { const k = String(Math.floor(x)); h[k] = (h[k] ?? 0) + 1; } return h; };
  console.log(JSON.stringify({ n: sums.length, sum: { p01: q(sums, 0.01), p05: q(sums, 0.05), p10: q(sums, 0.1), p25: q(sums, 0.25), p50: q(sums, 0.5), p75: q(sums, 0.75), p90: q(sums, 0.9), p99: q(sums, 0.99), min: Math.min(...sums), max: Math.max(...sums) }, floor: s10.filter((x) => x <= 1.2).length, ceil: s10.filter((x) => x >= 9.2).length, hist10: hist(s10) }));
});
