/** 운세 재료 다양성 측정 — 사주 6 × 60일(60갑자 한 바퀴). 모델·DB 없음. brief(사실·영역·짜임)가 날마다 얼마나 겹치는지 */
import { test } from "vitest";
import { buildBrief } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";
import { addDays } from "@/lib/time";

const P: BirthProfile[] = [
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 5, birthDay: 15, birthHour: 9, birthMinute: 0, city: "seoul" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1984, birthMonth: 11, birthDay: 3, birthHour: 7, birthMinute: 30, city: "busan" },
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 2001, birthMonth: 8, birthDay: 21, birthHour: 22, birthMinute: 10, city: "daegu" },
  { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1972, birthMonth: 3, birthDay: 9, birthHour: 15, birthMinute: 0, city: "gwangju" },
  { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1988, birthMonth: 7, birthDay: 27, birthHour: 4, birthMinute: 20, city: "incheon" },
];
const WEEK = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const jac = (a: Set<string>, b: Set<string>) => { const i = [...a].filter((x) => b.has(x)).length; const u = new Set([...a, ...b]).size; return u ? i / u : 0; };

test("variety", () => {
  const allFacts = new Set<string>();
  const factCount = new Map<string, number>();
  const perProfile: string[] = [];
  let totalDays = 0;
  const angles: Record<string, number> = {};
  const templ = new Map<string, number>();
  for (const p of P) {
    const prof = computeProfile({ ...p, name: "x" });
    if (!prof.ok) throw new Error(prof.error);
    const sigs = new Set<string>();
    const pf = new Set<string>();
    let consec = 0, prev: Set<string> | null = null;
    for (let i = 0; i < 60; i++) {
      const date = addDays("2026-10-12", i);
      const g = dayGanji(date);
      const core = computeCoreFortune({ pillars: prof.value.pillars, profile: p, date, todayHanja: g.hanja });
      const personal = adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
      const s10 = toTenPoint(personal.score);
      const b = buildBrief({ core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: WEEK[new Date(date).getUTCDay()]!, score10: s10, band: bandOf(s10) });
      const fs = new Set(b.facts);
      for (const f of fs) { allFacts.add(f); pf.add(f); factCount.set(f, (factCount.get(f) ?? 0) + 1); const t = f.replace(/'[^']*'/g, "'X'"); templ.set(t, (templ.get(t) ?? 0) + 1); }
      angles[b.angle] = (angles[b.angle] ?? 0) + 1;
      sigs.add(`${core.dayLuck.stem.tenGod}/${core.dayLuck.branch.tenGod}/${core.dayLuck.stem.label}${core.dayLuck.branch.label}/${b.score.band}`);
      if (prev) consec += jac(prev, fs);
      prev = fs;
      totalDays++;
    }
    perProfile.push(`사주${perProfile.length + 1}: 60일 중 서로 다른 '하루 유형' ${sigs.size}개, 서로 다른 사실 문장 ${pf.size}개, 이웃한 날 사실 겹침 평균 ${(consec / 59 * 100).toFixed(0)}%`);
  }
  const top = [...factCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, n]) => `${n}회 ${f}`);
  const topT = [...templ.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, n]) => `${(n / totalDays * 100).toFixed(0)}% ${t}`);
  console.log(["", `총 ${totalDays}일, 서로 다른 사실 문장 ${allFacts.size}개, 문장 틀(따옴표 안 지운) ${templ.size}개`, `짜임: ${JSON.stringify(angles)}`, ...perProfile, "가장 자주 나온 사실:", ...top, "가장 자주 쓰인 문장 틀(하루 중 등장 비율):", ...topT, ""].join("\n"));
});
