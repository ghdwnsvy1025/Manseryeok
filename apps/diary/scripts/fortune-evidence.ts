/**
 * 계산 사실 다양성 측정 — 가상 사주 N명 × D일. 모델·DB 없음(0원).
 * 물음: 오늘의 각도(v4.26)가 이미 쓰는 재료 말고, 날마다 달라지는 계산 사실이 얼마나 더 있는가.
 * (피드백/11.5 일운 재설계 문서의 "계산 사실 목록"을 만들 값어치가 있는지 보는 관문)
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-evidence.ts
 *   환경변수 EVIDENCE_PEOPLE(기본 100), EVIDENCE_DAYS(기본 180), EVIDENCE_START(기본 2026-11-05), EVIDENCE_OUT(JSON 저장 파일)
 *
 * 사실의 세 층:
 *   가  운영 계획(v4.21b)이 쓰는 것: 핵심 십신과 그 읽기
 *   나  오늘의 각도(v4.26)까지 쓰는 것: 보조 십신, 원국과의 합·충·복음(자리), 엇갈림, 큰 운과의 충, 운이 바뀌는 날, 단계
 *   다  아직 안 쓰는 것:
 *       [코어에 근거] 천간합(자리), 운 지지와의 합, 평소 없던 기운, 이달 바탕과 오늘의 조합
 *       [확장 가설]   운 천간과의 천간합, 원국에 같은 천간, 투출(자리), 오늘 천간의 뿌리 등급
 */
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { toCorePillars, type Pillars } from "@saju/core-rules";
import { HIDDEN, STEM_EL, GEN_BY, groupMap, mainStem, elementOf } from "@saju/core-rules/base";
import { pickAngle } from "@/lib/fortune/angle";
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import type { CoreFortune, CoreLuckPart } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";
import { addDays } from "@/lib/time";

const PEOPLE = Number(process.env.EVIDENCE_PEOPLE ?? 100);
const DAYS = Number(process.env.EVIDENCE_DAYS ?? 180);
const START = process.env.EVIDENCE_START ?? "2026-11-05";
/** 각도 고르기가 지난 21일을 본다 */
const LEAD = 21;

type Band = "좋음" | "무난" | "주의";
interface Day { date: string; core: CoreFortune; band: Band; ga: string[]; na: string[]; da: string[]; angle: string | null }

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
  const r = rng(20261105);
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

const STEM_COMBINE: Record<string, string> = { 甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛", 辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊" };
const POS = ["연", "월", "일", "시"] as const;
const readOf = (p: CoreLuckPart) => (p.label === "용" || p.label === "희" ? "도움" : p.label === "구" || p.label === "기" ? "과함" : "평소");
/** 계획과 같은 기준: |점수| 큰 쪽이 핵심, 같으면 천간 */
const partsOf = (c: CoreFortune): [CoreLuckPart, CoreLuckPart] =>
  Math.abs(c.dayLuck.stem.score) >= Math.abs(c.dayLuck.branch.score) ? [c.dayLuck.stem, c.dayLuck.branch] : [c.dayLuck.branch, c.dayLuck.stem];
const verdict3 = (v: string | null | undefined) => (!v ? "없음" : v.includes("유리") ? "좋음" : v === "보통" ? "무난" : "주의");

/** 오늘 천간이 원국 지지에 내린 뿌리 가운데 가장 센 등급 (코어 K-02의 등급 기준을 운 천간에 옮긴 확장) */
function rootOf(stem: string, p: Pillars): "강" | "중" | "약" | "무근" {
  const helper = new Set([STEM_EL[stem]!, GEN_BY[STEM_EL[stem]!]]);
  const rank = { 강: 3, 중: 2, 약: 1, 무근: 0 } as const;
  let best: keyof typeof rank = "무근";
  for (const g of p) {
    if (!g) continue;
    const h = [...HIDDEN[g[1]!]!];
    const idx = h.map((s, i) => (helper.has(STEM_EL[s]!) ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const top = Math.max(...idx);
    const grade = top === h.length - 1 ? "강" : h.length === 3 && top === 1 ? "중" : "약";
    if (rank[grade] > rank[best]) best = grade;
  }
  return best;
}

function factsOf(core: CoreFortune, band: Band, p: Pillars, prev: CoreFortune | null): Pick<Day, "ga" | "na" | "da"> {
  const [main, other] = partsOf(core);
  const ga = [`핵심:${main.tenGod}:${readOf(main)}`];

  const na = [`보조:${other.tenGod}:${readOf(other)}`, `단계:${band}`];
  for (const h of core.relations.hits) na.push(h.kind === "충" ? `충:${h.pos}` : h.kind === "복음" ? `복음:${h.pos}` : `합:${h.pos}`);
  if (other.tenGod !== main.tenGod && readOf(main) !== "평소" && readOf(other) !== "평소" && readOf(main) !== readOf(other)) na.push("엇갈림");
  const ctx = core.context;
  if (ctx.daeun?.clash) na.push("운충:대운");
  if (ctx.seun.clash) na.push("운충:세운");
  if (ctx.wolun?.clash) na.push("운충:월운");
  if (prev) {
    if (prev.context.wolun?.간지 !== ctx.wolun?.간지) na.push("운바뀜:월운");
    if (prev.context.seun.간지 !== ctx.seun.간지) na.push("운바뀜:세운");
    if (prev.context.daeun?.간지 !== ctx.daeun?.간지) na.push("운바뀜:대운");
  }

  const da: string[] = [];
  const S = core.dayLuck.stem.char, B = core.dayLuck.branch.char;
  // [코어에 근거] 천간합 — 오늘 천간과 원국 천간 (카드 013은 비겁 천간과의 합만 점수에 씀)
  p.forEach((g, i) => { if (g && STEM_COMBINE[S] === g[0]) da.push(`천간합:${POS[i]}`); });
  // [코어에 근거] 운 지지와 오늘 지지의 합 (S-08, 지금은 표시만)
  if (ctx.daeun?.union) da.push("운합:대운");
  if (ctx.seun.union) da.push("운합:세운");
  if (ctx.wolun?.union) da.push("운합:월운");
  // [코어에 근거] 평소 없던 기운 — 오늘 글자의 무리가 원국에 없음 (일간 제외, 지지는 정기)
  const { toGroup } = groupMap(p[2][0]!);
  const natal = new Set<string>();
  p.forEach((g, i) => { if (!g) return; if (i !== 2) natal.add(toGroup[STEM_EL[g[0]!]!]); natal.add(toGroup[elementOf(mainStem(g[1]!))]); });
  if (!natal.has(core.dayLuck.stem.family)) da.push("없던기운:천간");
  if (!natal.has(core.dayLuck.branch.family)) da.push("없던기운:지지");
  // [코어에 근거] 이달 바탕과 오늘의 조합 (달의 판정 3갈래 × 오늘 단계)
  da.push(`바탕:${verdict3(ctx.wolun?.판정)}>${band}`);
  // [확장 가설] 운 천간과의 천간합
  if (ctx.daeun && STEM_COMBINE[S] === ctx.daeun.간지[0]) da.push("운천간합:대운");
  if (STEM_COMBINE[S] === ctx.seun.간지[0]) da.push("운천간합:세운");
  if (ctx.wolun && STEM_COMBINE[S] === ctx.wolun.간지[0]) da.push("운천간합:월운");
  // [확장 가설] 원국에 같은 천간이 이미 있음 (일간과 같으면 비견이라 뺌)
  p.forEach((g, i) => { if (g && i !== 2 && g[0] === S) da.push(`같은천간:${POS[i]}`); });
  // [확장 가설] 투출 — 원국 지지 속 글자가 오늘 천간으로 드러남
  p.forEach((g, i) => { if (g && HIDDEN[g[1]!]!.includes(S)) da.push(`투출:${POS[i]}`); });
  // [확장 가설] 오늘 천간의 뿌리
  da.push(`뿌리:${rootOf(S, p)}`);
  void B;
  return { ga, na, da };
}

/** 날마다 하나씩 꼭 붙는 갈래 값(있음/없음이 아닌 것) */
const ALWAYS = (k: string) => k.startsWith("바탕:") || k.startsWith("뿌리:");
/** 대운·세운·월운 층에 걸린 사실 */
const LUCK_LAYER = (k: string) => k.startsWith("운합:") || k.startsWith("운천간합:") || k.startsWith("바탕:");
/** 있음/없음으로 갈리는 사실 (핵심·보조 십신과 단계, 갈래 값은 뺌) */
const isEvent = (k: string) => !ALWAYS(k) && !k.startsWith("단계:") && !k.startsWith("보조:") && !k.startsWith("핵심:");
const sig = (...xs: string[][]) => xs.flat().sort().join("|");
const jacDist = (a: string[], b: string[]) => { const A = new Set(a), Bs = new Set(b); const i = [...A].filter((x) => Bs.has(x)).length; const u = new Set([...A, ...Bs]).size; return u ? 1 - i / u : 0; };
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, c) => a + c, 0) / xs.length) * 100) / 100 : 0);

test("계산 사실 다양성", async () => {
  const warn = console.warn;
  console.warn = () => {};
  const all: Day[][] = [];
  let skipped = 0;
  for (const b of people(PEOPLE)) {
    const prof = computeProfile({ ...b, name: "x" });
    if (!prof.ok) { skipped++; continue; }
    const p = toCorePillars(prof.value.pillars);
    const days: Day[] = [];
    for (let k = -LEAD; k < DAYS; k++) {
      const date = addDays(START, k);
      const g = dayGanji(date);
      const core = computeCoreFortune({ pillars: prof.value.pillars, profile: b, date, todayHanja: g.hanja });
      const band = bandOf(toTenPoint(adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo }).score)) as Band;
      days.push({ date, core, band, ...factsOf(core, band, p, days.at(-1)?.core ?? null), angle: null });
    }
    for (let i = LEAD; i < days.length; i++) days[i]!.angle = pickAngle(days, i)?.kind ?? null;
    all.push(days.slice(LEAD));
    // 긴 계산이 vitest 작업자의 보고를 막지 않게 사람마다 한 번 쉰다
    await new Promise((r) => setTimeout(r, 0));
  }
  console.warn = warn;

  const N = all.length;
  let total = 0;
  const kindCount = new Map<string, number>();
  const keyCount = { 가: new Set<string>(), 나: new Set<string>(), 다: new Set<string>() };
  const perDayNa: number[] = [], perDayDa: number[] = [];
  let daAny = 0, noAngle = 0, noAngleRescued = 0;
  const angleCount = new Map<string, number>();
  // 같은 핵심이 14일 안에 돌아온 날
  let back = 0, backDiffNa = 0, backDiffNaDa = 0;
  const backDistNa: number[] = [], backDistNaDa: number[] = [];
  const nextDistNa: number[] = [], nextDistNaDa: number[] = [];
  // 60일 뒤 같은 일진
  let cyc = 0, cycSameNa = 0, cycSameNaDa = 0;
  const distinct60 = { 가: [] as number[], 나: [] as number[], 다: [] as number[] };
  const distinctAll = { 가: [] as number[], 나: [] as number[], 다: [] as number[] };
  const eventPerPerson = new Map<string, number[]>();
  const distinctSplit = { 원국: [] as number[], 운: [] as number[] };
  let cycSameNatal = 0;
  const rareNa: number[] = [], rareDa: number[] = [];
  let rareNaAny = 0, rareAny = 0;
  const baseCount = new Map<string, number>();

  for (const days of all) {
    const personKind = new Map<string, number>();
    // 그 사람에게 드문 사실(이레에 한 번 이하)만이 "오늘만의" 재료가 된다. 거의 매일 붙는 사실은 날을 가르지 못한다
    const freq = new Map<string, number>();
    for (const d of days) for (const k of [...d.na.filter(isEvent), ...d.da.filter(isEvent)]) freq.set(k, (freq.get(k) ?? 0) + 1);
    const rare = (k: string) => isEvent(k) && (freq.get(k) ?? 0) / days.length <= 1 / 7;
    for (let i = 0; i < days.length; i++) {
      const d = days[i]!;
      total++;
      const rNa = d.na.filter(rare).length, rDa = d.da.filter(rare).length;
      rareNa.push(rNa); rareDa.push(rDa);
      if (rNa) rareNaAny++;
      if (rNa || rDa) rareAny++;
      const base = d.da.find((k) => k.startsWith("바탕:"))!;
      baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
      d.ga.forEach((k) => keyCount.가.add(k));
      d.na.forEach((k) => keyCount.나.add(k));
      d.da.forEach((k) => keyCount.다.add(k));
      const events = d.da.filter((k) => !ALWAYS(k));
      perDayNa.push(d.na.filter((k) => !k.startsWith("단계:") && !k.startsWith("보조:")).length);
      perDayDa.push(events.length);
      if (events.length) daAny++;
      for (const kind of new Set(d.da.map((k) => k.split(":")[0]!).filter((k) => k !== "바탕" && k !== "뿌리"))) {
        kindCount.set(kind, (kindCount.get(kind) ?? 0) + 1);
        personKind.set(kind, (personKind.get(kind) ?? 0) + 1);
      }
      angleCount.set(d.angle ?? "없음", (angleCount.get(d.angle ?? "없음") ?? 0) + 1);
      if (!d.angle) { noAngle++; if (events.length) noAngleRescued++; }

      if (i > 0) { nextDistNa.push(jacDist(days[i - 1]!.na, d.na)); nextDistNaDa.push(jacDist([...days[i - 1]!.na, ...days[i - 1]!.da], [...d.na, ...d.da])); }
      for (let j = i - 1; j >= Math.max(0, i - 14); j--) {
        const past = days[j]!;
        if (past.ga[0]!.split(":")[1] !== d.ga[0]!.split(":")[1]) continue;
        back++;
        // 단계와 보조 십신을 빼고도 달라지는가 — 글의 줄기가 바뀔 만한 사실만
        const strip = (xs: string[]) => xs.filter((k) => !k.startsWith("단계:") && !k.startsWith("보조:"));
        if (sig(strip(past.na)) !== sig(strip(d.na))) backDiffNa++;
        if (sig(strip(past.na), past.da.filter((k) => !ALWAYS(k))) !== sig(strip(d.na), events)) backDiffNaDa++;
        backDistNa.push(jacDist(past.na, d.na));
        backDistNaDa.push(jacDist([...past.na, ...past.da], [...d.na, ...d.da]));
        break;
      }
      if (i + 60 < days.length) {
        const later = days[i + 60]!;
        cyc++;
        if (sig(d.ga, d.na) === sig(later.ga, later.na)) cycSameNa++;
        if (sig(d.ga, d.na, d.da) === sig(later.ga, later.na, later.da)) cycSameNaDa++;
      }
    }
    const count = (span: Day[], f: (d: Day) => string) => new Set(span.map(f)).size;
    const first60 = days.slice(0, 60);
    distinct60.가.push(count(first60, (d) => sig(d.ga)));
    distinct60.나.push(count(first60, (d) => sig(d.ga, d.na)));
    distinct60.다.push(count(first60, (d) => sig(d.ga, d.na, d.da)));
    distinctAll.가.push(count(days, (d) => sig(d.ga)));
    distinctAll.나.push(count(days, (d) => sig(d.ga, d.na)));
    distinctAll.다.push(count(days, (d) => sig(d.ga, d.na, d.da)));
    // 다를 둘로 가른다: 원국에만 걸린 사실(일진이 같으면 늘 같음)과 운 층에 걸린 사실(달·해가 바뀌면 달라짐)
    distinctSplit.원국.push(count(days, (d) => sig(d.ga, d.na, d.da.filter((k) => !LUCK_LAYER(k)))));
    distinctSplit.운.push(count(days, (d) => sig(d.ga, d.na, d.da.filter(LUCK_LAYER))));
    for (let i = 0; i + 60 < days.length; i++) {
      const a = days[i]!, b = days[i + 60]!;
      if (sig(a.ga, a.na, a.da.filter((k) => !LUCK_LAYER(k))) === sig(b.ga, b.na, b.da.filter((k) => !LUCK_LAYER(k)))) cycSameNatal++;
    }
    for (const [k, n] of personKind) eventPerPerson.set(k, [...(eventPerPerson.get(k) ?? []), pct(n, days.length)]);
  }

  // 같은 날, 사람끼리 얼마나 갈리는가
  const crossGa: number[] = [], crossNa: number[] = [], crossDa: number[] = [];
  for (let i = 0; i < DAYS; i++) {
    const col = all.map((days) => days[i]!);
    crossGa.push(new Set(col.map((d) => sig(d.ga))).size / N);
    crossNa.push(new Set(col.map((d) => sig(d.ga, d.na))).size / N);
    crossDa.push(new Set(col.map((d) => sig(d.ga, d.na, d.da))).size / N);
  }

  const spread = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { 최소: s[0] ?? 0, 중간: s[Math.floor(s.length / 2)] ?? 0, 최대: s.at(-1) ?? 0 }; };
  const kinds = [...kindCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
    const per = eventPerPerson.get(k) ?? [];
    // 이 사실이 한 번도 없는 사람은 0으로 채운다
    const full = [...per, ...Array(N - per.length).fill(0)] as number[];
    return { 종류: k, 날비율: pct(n, total), 사람별: spread(full), 한번도없는사람: N - per.length };
  });
  const out = {
    조건: { 사람: N, 건너뜀: skipped, 날: DAYS, 시작: START, 총사람날: total },
    각도: Object.fromEntries([...angleCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, pct(n, total)])),
    하루사실수: { "나(합충복음엇갈림운)": mean(perDayNa), "다(있음/없음 사실)": mean(perDayDa) },
    "다 사실이 하나라도 있는 날 %": pct(daAny, total),
    "다 종류별": kinds,
    "그 사람에게 드문 사실(이레에 한 번 이하)": {
      "나에서 하나라도 있는 날 %": pct(rareNaAny, total),
      "나+다에서 하나라도 있는 날 %": pct(rareAny, total),
      "하루 평균 개수 나": mean(rareNa),
      "하루 평균 개수 다": mean(rareDa),
    },
    "이달 바탕 > 오늘 단계 (날 %)": Object.fromEntries([...baseCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k.slice(3), pct(n, total)])),
    "각도 없음인 날": { "전체 중 %": pct(noAngle, total), "그중 다 사실이 있는 날 %": pct(noAngleRescued, noAngle) },
    "같은 핵심이 14일 안에 돌아온 날": {
      "전체 중 %": pct(back, total),
      "나 재료로 지난번과 다른 날 %(단계·보조 십신 빼고)": pct(backDiffNa, back),
      "나+다 재료로 다른 날 %(같은 기준)": pct(backDiffNaDa, back),
      "지난번과의 사실 거리(0 같음~1 전부 다름) 나": mean(backDistNa),
      "지난번과의 사실 거리 나+다": mean(backDistNaDa),
    },
    "어제와의 사실 거리": { 나: mean(nextDistNa), "나+다": mean(nextDistNaDa) },
    "60일 뒤 같은 일진": { "가+나 서명이 같은 날 %": pct(cycSameNa, cyc), "가+나+다 서명이 같은 날 %": pct(cycSameNaDa, cyc) },
    "한 사람의 서로 다른 하루(60일 중)": { 가: spread(distinct60.가), "가+나": spread(distinct60.나), "가+나+다": spread(distinct60.다) },
    [`한 사람의 서로 다른 하루(${DAYS}일 중)`]: { 가: spread(distinctAll.가), "가+나": spread(distinctAll.나), "가+나+다": spread(distinctAll.다) },
    "다를 둘로 가름": {
      [`서로 다른 하루(${DAYS}일 중) 가+나+원국에만 걸린 다`]: spread(distinctSplit.원국),
      [`서로 다른 하루(${DAYS}일 중) 가+나+운 층에 걸린 다`]: spread(distinctSplit.운),
      "60일 뒤 같은 일진에서 가+나+원국에만 걸린 다 서명이 같은 날 %": pct(cycSameNatal, cyc),
    },
    "같은 날 사람끼리 갈리는 비율(서로 다른 서명 수 ÷ 사람 수)": { 가: mean(crossGa), "가+나": mean(crossNa), "가+나+다": mean(crossDa) },
    "사실 열쇠 가짓수(해석 주장 표의 크기 어림)": { 가: keyCount.가.size, 나: keyCount.나.size, 다: keyCount.다.size, "다 열쇠": [...keyCount.다].sort() },
  };
  console.log(JSON.stringify(out, null, 1));
  if (process.env.EVIDENCE_OUT) writeFileSync(process.env.EVIDENCE_OUT, JSON.stringify(out, null, 1), "utf8");
}, 1_200_000);
