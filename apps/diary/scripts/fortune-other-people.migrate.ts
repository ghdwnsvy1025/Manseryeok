// 2026-11-17 다른 사주 검증: fortune-audit와 같은 가상 200명(rng 20261105)에서 성격이 다른 5명을 골라 프로필 JSON을 남긴다. 모델·DB 없음.
// 실행 (apps/diary): npx vitest run --config vitest.scripts.config.ts scripts/fortune-other-people.migrate.ts
//   결과: 사주 일기/피드백/11.17_다른사주_검증/P1~P5/프로필.json + 고른사람.md (가상 인물 — 실제 사람 아님)
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { computeCoreFortune } from "@/lib/fortune/core";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const DIARY = path.resolve(__dirname, "../../../..");
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CITY = ["seoul", "busan", "daegu", "incheon", "gwangju"] as const;
function people(n: number): BirthProfile[] {
  const r = rng(20261105);
  const pick = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return Array.from({ length: n }, () => {
    const unknown = r() < 0.1;
    return { gender: r() < 0.5 ? "male" : "female", calendar: "solar", isLeapMonth: false, birthYear: pick(1975, 2006), birthMonth: pick(1, 12), birthDay: pick(1, 28), birthHour: unknown ? null : pick(0, 23), birthMinute: unknown ? null : pick(0, 59), city: CITY[pick(0, 4)]! } as BirthProfile;
  });
}

test("다른 사주 5명 고르기", () => {
  const rows = people(200).map((p, i) => {
    const r = computeProfile({ ...p, name: "x" }); if (!r.ok) throw new Error(r.error);
    const pillars = r.value.pillars;
    const c = computeCoreFortune({ pillars, profile: p, date: "2026-12-01", todayHanja: dayGanji("2026-12-01").hanja });
    return { i, p, pillars, dm: pillars.day.stem, kind: c.chartType?.신강약 ?? "?", center: c.chartType?.중심기운 ?? "?", need: c.need ? `${c.need.오행}(${c.need.그룹})` : null, hour: p.birthHour !== null };
  });
  const dist: Record<string, number> = {};
  for (const r of rows) dist[`${r.kind}·${r.center}`] = (dist[`${r.kind}·${r.center}`] ?? 0) + 1;
  console.log(JSON.stringify(dist));
  // 서로 다른 갈래·일간으로 다섯: 신약 / 신강(비겁 아닌 중심) / 중화 / 시간 모름 / 신강 비겁 중심(일간 己 아닌)
  const usedDm = new Set<string>(["己"]);   // 앱 주인과 같은 일간은 피한다
  const take = (f: (r: (typeof rows)[number]) => boolean) => { const r = rows.find((x) => f(x) && !usedDm.has(x.dm)); if (r) usedDm.add(r.dm); return r; };
  const chosen = [
    ["신약", take((r) => r.hour && r.kind === "신약")],
    ["신강·비겁 아닌 중심", take((r) => r.hour && r.kind === "신강" && r.center !== "비겁")],
    ["중화", take((r) => r.hour && r.kind !== "신강" && r.kind !== "신약")],
    ["시간 모름", take((r) => !r.hour)],
    ["신강·비겁 중심", take((r) => r.hour && r.kind === "신강" && r.center === "비겁")],
  ] as const;
  const base = path.join(DIARY, "피드백/11.17_다른사주_검증");
  const md = ["# 다른 사주 검증 — 고른 가상 인물 5명", "", "fortune-audit와 같은 가상 200명(rng 20261105)에서 골랐다. 실제 사람이 아니다.", "", "| 번호 | 고른 까닭 | 일간 | 신강약 | 중심 기운 | 필요한 기운 | 태어난 시 |", "|---|---|---|---|---|---|---|"];
  chosen.forEach(([why, r], k) => {
    if (!r) { md.push(`| P${k + 1} | ${why} | 해당 없음 | | | | |`); return; }
    const dir = path.join(base, `P${k + 1}`); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "프로필.json"), JSON.stringify({ pillars: r.pillars, profile: r.p, virtual: true, index: r.i }, null, 1));
    md.push(`| P${k + 1} | ${why} | ${r.dm} | ${r.kind} | ${r.center} | ${r.need ?? "없음"} | ${r.hour ? "앎" : "모름"} |`);
  });
  writeFileSync(path.join(base, "고른사람.md"), md.join("\n") + "\n");
  console.log(md.join("\n"));
});
