// 2026-11-15 앱 주인 판정 규칙(r1·r3·r4·r5) 분포표 — 켜기 전에 본다. 모델·DB 없음.
//   (1) 가상 200명 × 2026년(5일 간격 73일) — 규칙을 하나씩 켰을 때와 다 켰을 때 단계(주의·무난·좋음) 비율과 점수 분위
//   (2) 앱 주인 사주 12월 1~14일 — 규칙마다 점수·단계
// 실행 (apps/diary): npx vitest run --config vitest.scripts.config.ts scripts/fortune-rules-dist.migrate.ts
//   결과: 사주 일기/피드백/운세개편/판정규칙_분포표_<날짜>.md
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "vitest";
import { computeCoreFortune, type RuleSwitch } from "@/lib/fortune/core";
import { bandOf, toTenPoint } from "@/lib/fortune/personal";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";
import { addDays } from "@/lib/time";

const DIARY = path.resolve(__dirname, "../../../..");
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CITY = ["seoul", "busan", "daegu", "incheon", "gwangju"] as const;
function people(n: number): BirthProfile[] {
  const r = rng(20261105);   // fortune-audit.ts와 같은 200명
  const pick = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  return Array.from({ length: n }, () => {
    const unknown = r() < 0.1;
    return {
      gender: r() < 0.5 ? "male" : "female", calendar: "solar", isLeapMonth: false,
      birthYear: pick(1975, 2006), birthMonth: pick(1, 12), birthDay: pick(1, 28),
      birthHour: unknown ? null : pick(0, 23), birthMinute: unknown ? null : pick(0, 59), city: CITY[pick(0, 4)]!,
    } as BirthProfile;
  });
}

const OFF: RuleSwitch = { r1: false, r3: false, r4: false, r5: false };
const CONFIGS: { name: string; rules: RuleSwitch }[] = [
  { name: "지금(모두 끔)", rules: OFF },
  { name: "r1 필요한 기운 가점", rules: { ...OFF, r1: true } },
  { name: "r3 지지 군겁쟁재 감점 빼기", rules: { ...OFF, r3: true } },
  { name: "r4 합 가점", rules: { ...OFF, r4: true } },
  { name: "r5 관성 가점", rules: { ...OFF, r5: true } },
  { name: "넷 다 켬", rules: { r1: true, r3: true, r4: true, r5: true } },
];

test("판정 규칙 분포표", () => {
  const ppl = people(200).map((p) => { const r = computeProfile({ ...p, name: "x" }); if (!r.ok) throw new Error(r.error); return { p, pillars: r.value.pillars }; });
  const days = Array.from({ length: 73 }, (_, i) => addDays("2026-01-01", i * 5));
  const rows: string[] = [];
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
  for (const c of CONFIGS) {
    const s10: number[] = [];
    const band = { 주의: 0, 무난: 0, 좋음: 0 };
    let touched = 0;
    for (const { p, pillars } of ppl) for (const date of days) {
      const f = computeCoreFortune({ pillars, profile: p, date, todayHanja: dayGanji(date).hanja, rules: c.rules });
      const t = toTenPoint(f.parts.score01);
      s10.push(t); band[bandOf(t)]++;
      if (f.parts.rules) touched++;
    }
    const n = s10.length, pct = (x: number) => `${Math.round((x / n) * 1000) / 10}%`;
    rows.push(`| ${c.name} | ${pct(band.주의)} | ${pct(band.무난)} | ${pct(band.좋음)} | ${q(s10, 0.1)} · ${q(s10, 0.5)} · ${q(s10, 0.9)} | ${(s10.reduce((a, b) => a + b, 0) / n).toFixed(2)} | ${c.rules === OFF ? "-" : pct(touched)} |`);
  }

  // 앱 주인 12월 1~14일
  const owner = JSON.parse(readFileSync(path.join(DIARY, "피드백/사주바탕/프로필_주인.json"), "utf8")) as { pillars: PillarsSnapshot; profile: BirthProfile | null };
  const dd = Array.from({ length: 14 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`);
  const head = `| 날 | 일진 | ${CONFIGS.map((c) => c.name).join(" | ")} | 넷 다 켰을 때 더한 것 |`;
  const sep = `|---|---|${CONFIGS.map(() => "---").join("|")}|---|`;
  const orows = dd.map((date) => {
    const g = dayGanji(date);
    const cells = CONFIGS.map((c) => { const f = computeCoreFortune({ pillars: owner.pillars, profile: owner.profile, date, todayHanja: g.hanja, rules: c.rules }); const t = toTenPoint(f.parts.score01); return `${t} ${bandOf(t)}`; });
    const all = computeCoreFortune({ pillars: owner.pillars, profile: owner.profile, date, todayHanja: g.hanja, rules: CONFIGS.at(-1)!.rules });
    return `| ${date.slice(5)} | ${g.ko} | ${cells.join(" | ")} | ${all.parts.rules ? Object.entries(all.parts.rules).map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ") : "-"} |`;
  });

  const md = [
    `# 판정 규칙 분포표 (${new Date().toISOString().slice(0, 10)})`, "",
    "원장 판정 규칙(rule_1·3·4·5, 앱 주인 확정 문장)을 코드에 스위치로 넣고 **켜기 전에** 본 표. 점수는 기록 보정 없이 사주만으로 계산한 10점(카드에서는 숫자를 빼기로 했고, 단계는 안에서 통계·비교에 쓴다). 단계 경계는 지금 그대로(주의 < 4.8 ≤ 무난 < 6.8 ≤ 좋음).", "",
    "- r1 — 가장 필요한 기운이 천간 또는 지지에 오면 +0.6점, 둘 다면 +0.9점",
    "- r3 — 지지로 온 재성의 군겁쟁재 감점(−2)을 뺀다 (물음 13: 지지는 군겁쟁재로 보지 않는다)",
    "- r4 — 필요한 오행으로 모이는 합: 삼합 +0.6, 육합 +0.3, 반합 +0.1, 하루 +0.8까지",
    "- r5 — 신강·비겁 우세·관성 25% 이하 사주에 관성 운 +0.5(천간·지지 함께 +0.8), 지지 비겁 때문에 절반 깎던 것 되돌림", "",
    `## 가상 200명 × 2026년 73일 (${200 * 73}개 하루)`, "",
    "| 켠 규칙 | 주의 | 무난 | 좋음 | 점수 10%·50%·90% | 평균 | 규칙이 닿은 날 |", "|---|---|---|---|---|---|---|", ...rows, "",
    "## 앱 주인 12월 1~14일", "", head, sep, ...orows, "",
  ];
  const out = path.join(DIARY, `피드백/운세개편/판정규칙_분포표_${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(out, md.join("\n"), "utf8");
  console.log(md.join("\n"));
}, 900_000);
