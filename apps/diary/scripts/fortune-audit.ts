/**
 * 일운 재설계 감사용 반증 측정 — 모델·DB 없음(0원). fortune-evidence.ts의 후속.
 * GPT 요청서(2026-11-06)의 주장과 앞선 Claude 주장을 같은 잣대로 확인한다.
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-audit.ts
 *   환경변수 AUDIT_PEOPLE(기본 100), AUDIT_DAYS(기본 180), AUDIT_START(기본 2026-11-05),
 *           AUDIT_HOUR_PEOPLE(기본 30), AUDIT_HOUR_DAYS(기본 90), AUDIT_OUT(JSON 저장 파일)
 *
 * 묶음:
 *   창7   — 평가 단위인 7일 창 안에서 무엇이 되풀이되는가 (서명은 이미 다 다른가, 각도 후보는 몇 가지까지 서로 다르게 배정되는가)
 *   점수  — 원국 충 가감(rel)과 대운·세운 가중(ctx)이 단계를 얼마나 바꾸는가, 코어의 일진 판정과 단계가 어긋나는 날
 *   T존   — 승인된 T존 조합을 가진 사람의 비율, 오늘 글자가 T존 자리에 직접 닿는 날의 비율
 *   중화  — 중화 사주에서 일기 단계와 코어의 중화 표현(합계 ±2 기준)이 어떻게 엇갈리는가
 *   시간  — 시주만 바꾼 12가지에서 하루 단계가 얼마나 같은가, 용신 일치율(w)이 그것을 대신할 수 있는가
 */
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { DEFAULT_POWER_METHOD, balance, toCorePillars, tzoneCombo, type Pillars } from "@saju/core-rules";
import { HIDDEN, STEM_EL, groupMap, mainStem, elementOf } from "@saju/core-rules/base";
import { tzone } from "@saju/core-rules/structure";
import { pickAngle } from "@/lib/fortune/angle";
import { computeCoreFortune, toScore01 } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { daySeed } from "@/lib/fortune/plan";
import type { CoreFortune, CoreLuckPart } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";
import { addDays } from "@/lib/time";

const PEOPLE = Number(process.env.AUDIT_PEOPLE ?? 100);
const DAYS = Number(process.env.AUDIT_DAYS ?? 180);
const START = process.env.AUDIT_START ?? "2026-11-05";
const HOUR_PEOPLE = Number(process.env.AUDIT_HOUR_PEOPLE ?? 30);
const HOUR_DAYS = Number(process.env.AUDIT_HOUR_DAYS ?? 90);
const LEAD = 21;

type Band = "좋음" | "무난" | "주의";
interface Day { date: string; core: CoreFortune; band: Band; main: CoreLuckPart; other: CoreLuckPart; sigNa: string; sigAll: string; nearClash: boolean; k1: Set<string>; k2: Set<string>; angle: string | null; tzHit: boolean; tzFamily: boolean }

const rotate = <T,>(xs: T[], seed: number): T[] => (xs.length ? [...xs.slice(seed % xs.length), ...xs.slice(0, seed % xs.length)] : []);
/**
 * 감사 문서 F.2의 배정을 그대로 옮긴 것: 무거운 사실 고정 → 이분 매칭 → 남은 날은 첫 후보.
 * 반환은 날마다 고른 종류(없으면 null).
 */
function assignBlock(days: { leads: string[]; pin: string | null; seed: number }[], usePin: boolean): (string | null)[] {
  const out: (string | null | undefined)[] = days.map(() => undefined);
  const used = new Set<string>();
  if (usePin) days.forEach((d, i) => { if (d.pin) { out[i] = d.pin; used.add(d.pin); } });
  const rest = days.map((d, i) => ({ i, leads: rotate(d.leads, d.seed).filter((k) => !used.has(k)) })).filter((d) => out[d.i] === undefined)
    .sort((a, b) => a.leads.length - b.leads.length || a.i - b.i);
  const owner = new Map<string, number>();
  const tryDay = (n: number, seen: Set<string>): boolean => {
    for (const k of rest[n]!.leads) {
      if (seen.has(k)) continue;
      seen.add(k);
      const cur = owner.get(k);
      if (cur === undefined || tryDay(cur, seen)) { owner.set(k, n); return true; }
    }
    return false;
  };
  rest.forEach((_, n) => tryDay(n, new Set()));
  for (const [k, n] of owner) out[rest[n]!.i] = k;
  days.forEach((d, i) => { if (out[i] === undefined) out[i] = rotate(d.leads, d.seed)[0] ?? null; });
  return out as (string | null)[];
}

// fortune-evidence.ts와 같은 씨앗 — 같은 100명이다
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
const readOf = (p: CoreLuckPart) => (p.label === "용" || p.label === "희" ? "도움" : p.label === "구" || p.label === "기" ? "과함" : "평소");
const partsOf = (c: CoreFortune): [CoreLuckPart, CoreLuckPart] =>
  Math.abs(c.dayLuck.stem.score) >= Math.abs(c.dayLuck.branch.score) ? [c.dayLuck.stem, c.dayLuck.branch] : [c.dayLuck.branch, c.dayLuck.stem];
const verdict3 = (v: string | null | undefined) => (!v ? "없음" : v.includes("유리") ? "좋음" : v === "보통" ? "무난" : "주의");
const bandOfSum = (sum: number): Band => bandOf(toTenPoint(toScore01(sum)));
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, c) => a + c, 0) / xs.length) * 100) / 100 : 0);
const spread = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { 최소: s[0] ?? 0, 중간: s[Math.floor(s.length / 2)] ?? 0, 최대: s.at(-1) ?? 0 }; };
const tally = <K extends string>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const table = (m: Map<string, number>, total: number) => Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, pct(n, total)]));

/** 날 7개를 서로 다른 종류에 하나씩 배정할 수 있는 최대 날 수 (이분 매칭) */
function maxDistinct(sets: Set<string>[]): number {
  const owner = new Map<string, number>();
  const tryDay = (d: number, seen: Set<string>): boolean => {
    for (const k of sets[d]!) {
      if (seen.has(k)) continue;
      seen.add(k);
      const cur = owner.get(k);
      if (cur === undefined || tryDay(cur, seen)) { owner.set(k, d); return true; }
    }
    return false;
  };
  let n = 0;
  for (let d = 0; d < sets.length; d++) if (tryDay(d, new Set())) n++;
  return n;
}

function build(b: BirthProfile, from: number, to: number): { p: Pillars; days: Day[] } | null {
  const prof = computeProfile({ ...b, name: "x" });
  if (!prof.ok) return null;
  const p = toCorePillars(prof.value.pillars);
  const T = p[3] ? tzone(p).항목 : [];
  const tzGroups = new Set(T.map((t) => t.그룹 as string));
  const { toGroup } = groupMap(p[2][0]!);
  const natal = new Set<string>();
  p.forEach((g, i) => { if (!g) return; if (i !== 2) natal.add(toGroup[STEM_EL[g[0]!]!]); natal.add(toGroup[elementOf(mainStem(g[1]!))]); });
  const days: Day[] = [];
  for (let k = from; k < to; k++) {
    const date = addDays(START, k);
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: prof.value.pillars, profile: b, date, todayHanja: g.hanja });
    const band = bandOf(toTenPoint(adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo }).score)) as Band;
    const [main, other] = partsOf(core);
    const prev = days.at(-1);
    const S = core.dayLuck.stem.char;
    const ctx = core.context;
    const hits = core.relations.hits;
    const na = [`보조:${other.tenGod}:${readOf(other)}`, `단계:${band}`, ...hits.map((h) => `${h.kind === "충" ? "충" : h.kind === "복음" ? "복음" : "합"}:${h.pos}`)];
    const mixed = other.tenGod !== main.tenGod && readOf(main) !== "평소" && readOf(other) !== "평소" && readOf(main) !== readOf(other);
    if (mixed) na.push("엇갈림");
    const luckClash = !!(ctx.daeun?.clash || ctx.seun.clash || ctx.wolun?.clash);
    if (luckClash) na.push("운충");

    // 오늘의 각도 후보를 사실에서 다시 만든 근사 (angle.ts candidatesOf는 내보내지 않아 부르지 못한다)
    const k1 = new Set<string>();
    if (hits.some((h) => h.kind !== "충" && h.kind !== "복음" && !(h.chars.includes("巳") && h.chars.includes("申")))) k1.add("합");
    if (hits.some((h) => h.kind === "충")) k1.add("충");
    if (mixed) k1.add("엇갈림");
    if (prev && prev.band !== band) k1.add("어제와달라짐");
    for (let j = days.length - 1; j >= Math.max(0, days.length - 14); j--) {
      const past = days[j]!;
      if (past.main.tenGod !== main.tenGod) continue;
      if (past.other.tenGod !== other.tenGod || past.band !== band) k1.add("되돌아옴");
      break;
    }
    if (luckClash) k1.add("큰흐름");

    const k2 = new Set(k1);
    if (p.some((x) => x && STEM_COMBINE[S] === x[0])) k2.add("천간합");
    if (ctx.daeun?.union || ctx.seun.union || ctx.wolun?.union) k2.add("운합");
    if ((ctx.daeun && STEM_COMBINE[S] === ctx.daeun.간지[0]) || STEM_COMBINE[S] === ctx.seun.간지[0] || (ctx.wolun && STEM_COMBINE[S] === ctx.wolun.간지[0])) k2.add("운천간합");
    if (!natal.has(core.dayLuck.stem.family) || !natal.has(core.dayLuck.branch.family)) k2.add("없던기운");
    if (p.some((x, i) => x && i !== 2 && x[0] === S)) k2.add("같은천간");
    if (p.some((x) => x && HIDDEN[x[1]!]!.includes(S))) k2.add("투출");
    const base = verdict3(ctx.wolun?.판정);
    if ((base === "좋음" && band === "주의") || (base === "주의" && band === "좋음")) k2.add("바탕대조");

    // T존 자리(시간·일지·월간)에 오늘 글자가 직접 닿는가
    const tzHit = !!p[3] && (hits.some((h) => h.pos === "일") || [1, 3].some((i) => p[i] && (STEM_COMBINE[S] === p[i]![0] || p[i]![0] === S)));
    const tzFamily = !!p[3] && (tzGroups.has(core.dayLuck.stem.family) || tzGroups.has(core.dayLuck.branch.family));
    const sigNa = [`핵심:${main.tenGod}:${readOf(main)}`, ...na].sort().join("|");
    const sigAll = [sigNa, ...[...k2].filter((k) => !k1.has(k)).sort(), `바탕:${base}>${band}`].join("|");
    const nearClash = hits.some((h) => h.kind === "충" && (h.pos === "일" || h.pos === "월"));
    days.push({ date, core, band, main, other, sigNa, sigAll, nearClash, k1, k2, angle: null, tzHit, tzFamily });
  }
  return { p, days };
}

test("일운 재설계 감사 측정", async () => {
  const warn = console.warn;
  console.warn = () => {};
  const all: { b: BirthProfile; p: Pillars; days: Day[] }[] = [];
  const roster = people(PEOPLE);
  for (const b of roster) {
    const r = build(b, -LEAD, DAYS);
    if (!r) continue;
    for (let i = LEAD; i < r.days.length; i++) r.days[i]!.angle = pickAngle(r.days, i)?.kind ?? null;
    all.push({ b, p: r.p, days: r.days.slice(LEAD) });
    await new Promise((res) => setTimeout(res, 0));
  }

  // ---------- 창7 ----------
  const w = { 핵심십신: [] as number[], 핵심읽기: [] as number[], 서명: [] as number[], 고른각도: [] as number[], 없음: [] as number[], 배정1: [] as number[], 배정2: [] as number[] };
  let win = 0, coreRepeat = 0, sigFull = 0, m1Full = 0, m2Full = 0, pickedOutside = 0, picked = 0;
  for (const { days } of all) {
    for (const d of days) if (d.angle) { picked++; if (!d.k1.has(d.angle)) pickedOutside++; }
    for (let i = 0; i + 7 <= days.length; i++) {
      const span = days.slice(i, i + 7);
      win++;
      const gods = new Set(span.map((d) => d.main.tenGod)).size;
      w.핵심십신.push(gods);
      if (gods < 7) coreRepeat++;
      w.핵심읽기.push(new Set(span.map((d) => `${d.main.tenGod}:${readOf(d.main)}`)).size);
      const sigs = new Set(span.map((d) => d.sigNa)).size;
      w.서명.push(sigs);
      if (sigs === 7) sigFull++;
      w.고른각도.push(new Set(span.map((d) => d.angle).filter(Boolean)).size);
      w.없음.push(span.filter((d) => !d.angle).length);
      const a = maxDistinct(span.map((d) => d.k1)), c = maxDistinct(span.map((d) => d.k2));
      w.배정1.push(a); w.배정2.push(c);
      if (a === 7) m1Full++;
      if (c === 7) m2Full++;
    }
  }
  const k1Size: number[] = [], k2Size: number[] = [];
  for (const { days } of all) for (const d of days) { k1Size.push(d.k1.size); k2Size.push(d.k2.size); }

  // ---------- 창7 보강 (GPT 2차 지적: 창은 서로 독립이 아니다, 절입을 가로지르는 창이 있다) ----------
  let sigAllFull = 0, crossMonth = 0, crossYear = 0, crossFull = 0, stayFull = 0, stay = 0;
  const perRepeat: number[] = [], perPicked: number[] = [];
  for (const { days } of all) {
    let rep = 0, n = 0;
    const pk: number[] = [];
    for (let i = 0; i + 7 <= days.length; i++) {
      const span = days.slice(i, i + 7);
      n++;
      if (new Set(span.map((d) => d.main.tenGod)).size < 7) rep++;
      pk.push(new Set(span.map((d) => d.angle).filter(Boolean)).size);
      if (new Set(span.map((d) => d.sigAll)).size === 7) sigAllFull++;
      const na7 = new Set(span.map((d) => d.sigNa)).size === 7;
      const month = new Set(span.map((d) => d.core.context.wolun?.간지)).size > 1;
      if (month) { crossMonth++; if (na7) crossFull++; } else { stay++; if (na7) stayFull++; }
      if (new Set(span.map((d) => d.core.context.seun.간지)).size > 1) crossYear++;
    }
    perRepeat.push(pct(rep, n));
    perPicked.push(mean(pk));
  }
  const ci = (xs: number[]) => { const m = xs.reduce((a, c) => a + c, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, c) => a + (c - m) ** 2, 0) / (xs.length - 1)); const h = (1.96 * sd) / Math.sqrt(xs.length); return { 평균: Math.round(m * 100) / 100, "95% 구간": [Math.round((m - h) * 100) / 100, Math.round((m + h) * 100) / 100], ...spread(xs) }; };

  // ---------- 배정 (감사 문서 F.2를 실제 자료에 돌려 본다. 날짜로 고정한 7일 묶음, 꽉 찬 묶음만) ----------
  const blockOf = (date: string) => Math.floor(daySeed(date) / 7);
  const A = { 지금: [] as number[], 지금없음: [] as number[], 매칭: [] as number[], 매칭없음: [] as number[], 고정매칭: [] as number[], 고정매칭없음: [] as number[], 넓힌고정매칭: [] as number[], 넓힌없음: [] as number[] };
  let blocks = 0, pinDays = 0, pinBlocksTwice = 0, partialDiff = 0, partialN = 0, edgeSame = 0, edgeN = 0, nowSame = 0, nowN = 0;
  let edgeSameFixed = 0, adjSame = 0, adjN = 0;
  const fixedKinds: number[] = [];
  const ORDER = ["합", "충", "엇갈림", "어제와달라짐", "되돌아옴", "큰흐름", "바탕대조", "천간합", "운합", "없던기운", "같은천간", "운천간합", "투출"];
  const leadsOf = (s: Set<string>) => ORDER.filter((k) => s.has(k));
  for (const { days } of all) {
    const byBlock = new Map<number, Day[]>();
    for (const d of days) byBlock.set(blockOf(d.date), [...(byBlock.get(blockOf(d.date)) ?? []), d]);
    let prevLast: string | null | undefined;
    for (const b of [...byBlock.keys()].sort((x, y) => x - y)) {
      const ds = byBlock.get(b)!;
      if (ds.length !== 7) { prevLast = undefined; continue; }
      blocks++;
      const input = (pick: (d: Day) => Set<string>) => ds.map((d) => ({ leads: leadsOf(pick(d)), pin: d.nearClash ? "충" : null, seed: daySeed(d.date) }));
      const count = (xs: (string | null)[]) => ({ kinds: new Set(xs.filter(Boolean)).size, none: xs.filter((x) => !x).length });
      const now = count(ds.map((d) => d.angle));
      const m = assignBlock(input((d) => d.k1), false), pm = assignBlock(input((d) => d.k1), true), wide = assignBlock(input((d) => d.k2), true);
      A.지금.push(now.kinds); A.지금없음.push(now.none);
      A.매칭.push(count(m).kinds); A.매칭없음.push(count(m).none);
      A.고정매칭.push(count(pm).kinds); A.고정매칭없음.push(count(pm).none);
      A.넓힌고정매칭.push(count(wide).kinds); A.넓힌없음.push(count(wide).none);
      const pins = ds.filter((d) => d.nearClash).length;
      pinDays += pins;
      if (pins >= 2) pinBlocksTwice++;
      // GPT 실험 1: 묶음의 뒷날을 모르고 배정하면 같은 날의 답이 달라지는가
      for (let t = 0; t < 7; t++) {
        const part = assignBlock(input((d) => d.k1).slice(0, t + 1), true);
        partialN++;
        if (part[t] !== pm[t]) partialDiff++;
      }
      if (prevLast !== undefined) { edgeN++; if (prevLast && prevLast === pm[0]) edgeSame++; }
      // 경계 손질: 묶음 첫날이 앞 묶음 끝날과 같은 종류면 첫날만 다른 후보로 바꾼다 (끝날은 손대지 않아 묶음끼리 사슬이 생기지 않는다)
      const fixed = [...pm];
      if (prevLast && fixed[0] === prevLast && !ds[0]!.nearClash) {
        const alts = rotate(leadsOf(ds[0]!.k1), daySeed(ds[0]!.date)).filter((k) => k !== prevLast);
        fixed[0] = alts.find((k) => !fixed.slice(1).includes(k)) ?? alts[0] ?? fixed[0]!;
      }
      if (prevLast !== undefined) { if (prevLast && prevLast === fixed[0]) edgeSameFixed++; adjN++; if (prevLast && prevLast === fixed[0]) adjSame++; }
      for (let i = 1; i < 7; i++) { adjN++; if (fixed[i] && fixed[i] === fixed[i - 1]) adjSame++; }
      fixedKinds.push(count(fixed).kinds);
      prevLast = pm[6];
    }
    for (let i = 1; i < days.length; i++) { nowN++; if (days[i]!.angle && days[i]!.angle === days[i - 1]!.angle) nowSame++; }
  }

  // ---------- 반대인 날 (코어 일진 판정은 유리인데 일기 단계는 주의, 또는 그 반대) ----------
  let opp = 0, oppCtxNeg = 0, oppRelNeg = 0, oppSumNeg = 0, oppUnknown = 0, oppReverse = 0;
  const oppRaw: number[] = [], oppPush: number[] = [];
  for (const { days } of all) for (const d of days) {
    const { raw, rel, ctx } = d.core.parts;
    const now = bandOfSum(raw + rel + ctx), v = d.core.dayLuck.total;
    if (now === "좋음" && (v === "주의" || v === "어려움")) oppReverse++;
    if (!(now === "주의" && (v === "유리" || v === "매우 유리"))) continue;
    opp++;
    if (ctx < 0) oppCtxNeg++;
    if (rel < 0) oppRelNeg++;
    if (rel + ctx < 0) oppSumNeg++;
    if (d.core.dayLuck.agreement !== undefined) oppUnknown++;
    oppRaw.push(raw); oppPush.push(Math.round((rel + ctx) * 100) / 100);
  }

  // ---------- 점수 ----------
  const total = all.reduce((n, x) => n + x.days.length, 0);
  const dist = { 지금: new Map<string, number>(), 충가감뺌: new Map<string, number>(), 큰운가중뺌: new Map<string, number>(), 일진만: new Map<string, number>() };
  let dRel = 0, dRelUp = 0, dCtx = 0, dCtxUp = 0, dRaw = 0;
  const cross = new Map<string, number>();
  let conflict = 0, relDays = 0;
  const ctxMean: number[] = [], ctxSd: number[] = [], cautionNow: number[] = [], cautionRaw: number[] = [];
  const rank = { 주의: 0, 무난: 1, 좋음: 2 } as const;
  for (const { days } of all) {
    const cs: number[] = [];
    let cNow = 0, cRaw = 0;
    for (const d of days) {
      const { raw, rel, ctx } = d.core.parts;
      const now = bandOfSum(raw + rel + ctx), noRel = bandOfSum(raw + ctx), noCtx = bandOfSum(raw + rel), only = bandOfSum(raw);
      tally(dist.지금, now); tally(dist.충가감뺌, noRel); tally(dist.큰운가중뺌, noCtx); tally(dist.일진만, only);
      if (rel !== 0) relDays++;
      if (noRel !== now) { dRel++; if (rank[noRel] > rank[now]) dRelUp++; }
      if (noCtx !== now) { dCtx++; if (rank[noCtx] > rank[now]) dCtxUp++; }
      if (only !== now) dRaw++;
      const v = d.core.dayLuck.total;
      tally(cross, `${v}>${now}`);
      if ((now === "좋음" && (v === "주의" || v === "어려움")) || (now === "주의" && (v === "유리" || v === "매우 유리"))) conflict++;
      cs.push(ctx);
      if (now === "주의") cNow++;
      if (only === "주의") cRaw++;
    }
    const m = cs.reduce((a, c) => a + c, 0) / cs.length;
    ctxMean.push(Math.round(m * 100) / 100);
    ctxSd.push(Math.round(Math.sqrt(cs.reduce((a, c) => a + (c - m) ** 2, 0) / cs.length) * 100) / 100);
    cautionNow.push(pct(cNow, days.length)); cautionRaw.push(pct(cRaw, days.length));
  }

  // ---------- T존 ----------
  const known = all.filter((x) => x.p[3]);
  const comboCount = new Map<string, number>();
  const tzSets = new Set<string>();
  let noCombo = 0;
  const hitPer: number[] = [], famPer: number[] = [];
  for (const { p, days } of known) {
    const T = tzone(p).항목;
    const combos = tzoneCombo(p, T, balance(p, DEFAULT_POWER_METHOD));
    if (!combos.length) noCombo++;
    for (const c of combos) tally(comboCount, c.조합.join("+"));
    tzSets.add(T.map((t) => t.그룹).sort().join("+"));
    hitPer.push(pct(days.filter((d) => d.tzHit).length, days.length));
    famPer.push(pct(days.filter((d) => d.tzFamily).length, days.length));
  }

  // ---------- 중화 ----------
  const strength = new Map<string, number>();
  for (const { days } of all) tally(strength, days[0]!.core.chartType?.신강약 ?? "모름");
  const mid = new Map<string, number>();
  let midDays = 0, midClash = 0;
  for (const { days } of all) {
    if (days[0]!.core.chartType?.신강약 !== "중화") continue;
    for (const d of days) {
      const r = d.core.dayLuck.raw;
      const tone = r >= 2 ? "완만하게 유리" : r <= -2 ? "조절 필요" : "대체로 평이";
      tally(mid, `${d.band}>${tone}`);
      midDays++;
      if ((d.band === "좋음" && tone !== "완만하게 유리") || (d.band === "주의" && tone !== "조절 필요") || (d.band === "무난" && tone !== "대체로 평이")) midClash++;
    }
  }

  // ---------- 시간 ----------
  const HOURS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  let hourPeople = 0, hd = 0, allSame = 0, halfOrLess = 0, policyIsMode = 0;
  const modeShare: number[] = [], policyAcc: number[] = [], modeAcc: number[] = [], signShare: number[] = [];
  const byW = new Map<string, { n: number; band: number; sign: number; acc: number }>();
  for (const { b } of known.slice(0, HOUR_PEOPLE)) {
    const variants = HOURS.map((h) => build({ ...b, birthHour: h, birthMinute: 0 }, 0, HOUR_DAYS));
    const unknown = build({ ...b, birthHour: null, birthMinute: null }, 0, HOUR_DAYS);
    if (!unknown || variants.some((v) => !v)) continue;
    const vs = variants as { p: Pillars; days: Day[] }[];
    // 시주 12가지가 모두 다르고 일주는 같아야 "시주만 바꾼" 비교가 된다
    if (new Set(vs.map((v) => v.p[3])).size !== 12 || new Set(vs.map((v) => v.p[2])).size !== 1) continue;
    hourPeople++;
    for (let i = 0; i < HOUR_DAYS; i++) {
      const bands = vs.map((v) => v.days[i]!.band);
      const counts = new Map<string, number>();
      bands.forEach((x) => tally(counts, x));
      const [mode, top] = [...counts.entries()].sort((a, c) => c[1] - a[1])[0]!;
      const signs = new Map<string, number>();
      vs.forEach((v) => tally(signs, String(Math.sign(v.days[i]!.core.dayLuck.raw))));
      const signTop = Math.max(...signs.values());
      const u = unknown.days[i]!;
      const acc = bands.filter((x) => x === u.band).length / 12;
      hd++;
      modeShare.push(top / 12); signShare.push(signTop / 12); policyAcc.push(acc); modeAcc.push(top / 12);
      if (top === 12) allSame++;
      if (top <= 6) halfOrLess++;
      if (u.band === mode) policyIsMode++;
      const ww = u.core.dayLuck.agreement ?? 1;
      const key = ww >= 0.75 ? "용신 일치 9/12 이상" : ww >= 0.5 ? "6~8/12" : "5/12 이하";
      const cur = byW.get(key) ?? { n: 0, band: 0, sign: 0, acc: 0 };
      cur.n++; cur.band += top / 12; cur.sign += signTop / 12; cur.acc += acc;
      byW.set(key, cur);
    }
    await new Promise((res) => setTimeout(res, 0));
  }
  console.warn = warn;

  const out = {
    조건: { 사람: all.length, 날: DAYS, 시작: START, 총사람날: total, "7일 창 수": win, "시간 아는 사람": known.length },
    창7: {
      "서로 다른 핵심 십신 수(평균, 7 중)": mean(w.핵심십신),
      "핵심 십신이 한 번이라도 겹치는 창 %": pct(coreRepeat, win),
      "서로 다른 핵심 십신+읽기 수(평균)": mean(w.핵심읽기),
      "서로 다른 가+나 서명 수(평균)": mean(w.서명),
      "서명 7개가 모두 다른 창 %": pct(sigFull, win),
      "실제로 고른 각도 종류 수(평균)": mean(w.고른각도),
      "각도 없음인 날 수(평균)": mean(w.없음),
      "하루 후보 종류 수(평균) 지금 각도": mean(k1Size),
      "하루 후보 종류 수(평균) 새 사실 포함": mean(k2Size),
      "서로 다른 종류로 배정 가능한 날 수(평균) 지금 각도": mean(w.배정1),
      "서로 다른 종류로 배정 가능한 날 수(평균) 새 사실 포함": mean(w.배정2),
      "7일 모두 다른 종류로 배정 가능한 창 % 지금 각도": pct(m1Full, win),
      "7일 모두 다른 종류로 배정 가능한 창 % 새 사실 포함": pct(m2Full, win),
      "근사 검증: 실제 고른 각도가 근사 후보 밖인 비율 %": pct(pickedOutside, picked),
    },
    창7보강: {
      "가+나에 새 사실 종류와 바탕까지 넣은 서명이 7일 모두 다른 창 %": pct(sigAllFull, win),
      "창 안에서 월운이 바뀌는 창 %": pct(crossMonth, win),
      "창 안에서 세운이 바뀌는 창 %": pct(crossYear, win),
      "월운이 바뀌는 창에서 가+나 서명이 모두 다른 비율 %": pct(crossFull, crossMonth),
      "월운이 그대로인 창에서 가+나 서명이 모두 다른 비율 %": pct(stayFull, stay),
      "사람 단위(100명): 핵심 십신이 겹치는 창의 비율 %": ci(perRepeat),
      "사람 단위(100명): 실제로 고른 각도 종류 수": ci(perPicked),
    },
    배정: {
      "꽉 찬 7일 묶음 수": blocks,
      "서로 다른 각도 종류 수(묶음 평균) v4.26 실제": mean(A.지금), "없음인 날 v4.26 실제": mean(A.지금없음),
      "서로 다른 종류 수, 매칭만(고정 없음)": mean(A.매칭), "없음인 날, 매칭만": mean(A.매칭없음),
      "서로 다른 종류 수, 무거운 사실 고정 + 매칭": mean(A.고정매칭), "없음인 날, 고정 + 매칭": mean(A.고정매칭없음),
      "서로 다른 종류 수, 후보를 넓히고 고정 + 매칭": mean(A.넓힌고정매칭), "없음인 날, 넓힌 경우": mean(A.넓힌없음),
      "고정되는 날(일·월 자리 충)의 수(묶음 평균)": Math.round((pinDays / blocks) * 100) / 100,
      "고정이 둘 이상이라 같은 종류가 겹치는 묶음 %": pct(pinBlocksTwice, blocks),
      "묶음의 뒷날을 빼고 배정하면 그날의 답이 달라지는 비율 %": pct(partialDiff, partialN),
      "묶음 경계에서 앞 묶음 끝날과 같은 종류인 비율 %": pct(edgeSame, edgeN),
      "경계 손질 뒤 같은 종류인 비율 %": pct(edgeSameFixed, edgeN),
      "경계 손질 뒤 서로 다른 종류 수(묶음 평균)": mean(fixedKinds),
      "고정 + 매칭 + 경계 손질: 전날과 같은 종류인 날 %": pct(adjSame, adjN),
      "v4.26 실제: 전날과 같은 각도 종류인 날 %": pct(nowSame, nowN),
    },
    "반대인 날": {
      "유리 판정인데 주의 단계인 날 %": pct(opp, total),
      "주의·어려움 판정인데 좋음 단계인 날 수": oppReverse,
      "그중 원국 충 가감 + 대운·세운 가중이 음수인 날 %": pct(oppSumNeg, opp),
      "그중 대운·세운 가중이 음수인 날 %": pct(oppCtxNeg, opp),
      "그중 원국 충 가감이 음수인 날 %": pct(oppRelNeg, opp),
      "그중 시간 모름 사용자의 날 %": pct(oppUnknown, opp),
      "그날들의 일진 글자 점수(폭을 줄인 뒤)": spread(oppRaw),
      "그날들의 가감 합(충 + 큰 운)": spread(oppPush),
    },
    점수: {
      "단계 분포 %": { 지금: table(dist.지금, total), "원국 충 가감을 뺌": table(dist.충가감뺌, total), "대운·세운 가중을 뺌": table(dist.큰운가중뺌, total), "일진 글자 점수만": table(dist.일진만, total) },
      "원국 충 가감이 0이 아닌 날 %": pct(relDays, total),
      "원국 충 가감을 빼면 단계가 바뀌는 날 %": pct(dRel, total), "그중 올라가는 날 %": pct(dRelUp, dRel),
      "대운·세운 가중을 빼면 단계가 바뀌는 날 %": pct(dCtx, total), "그중 올라가는 날 % ": pct(dCtxUp, dCtx),
      "둘 다 빼면 단계가 바뀌는 날 %": pct(dRaw, total),
      "사람별 대운·세운 가중의 평균(최소/중간/최대)": spread(ctxMean),
      "사람별 가중의 날마다 흔들림(표준편차)": spread(ctxSd),
      "가중 평균의 절댓값이 0.5 이상인 사람 %": pct(ctxMean.filter((x) => Math.abs(x) >= 0.5).length, ctxMean.length),
      "사람별 주의 비율 % 지금": spread(cautionNow), "사람별 주의 비율 % 일진 글자 점수만": spread(cautionRaw),
      "코어 일진 판정 > 일기 단계 (날 %)": table(cross, total),
      "코어 판정과 단계가 반대인 날 %": pct(conflict, total),
    },
    T존: {
      "승인된 조합이 하나도 없는 사람 %": pct(noCombo, known.length),
      "조합별 사람 %": table(comboCount, known.length),
      "T존 세 자리의 무리 구성 가짓수": tzSets.size,
      "오늘 글자가 T존 자리에 직접 닿는 날 %(사람별)": spread(hitPer),
      "오늘 글자의 무리가 T존 무리와 같은 날 %(사람별)": spread(famPer),
    },
    중화: {
      "신강약 분포 %(복사본 기준, 견제형 없음)": table(strength, all.length),
      "중화 사람날": midDays,
      "일기 단계 > 코어 중화 표현 (중화 사람날 %)": table(mid, midDays),
      "단계와 중화 표현이 다른 갈래인 날 %": pct(midClash, midDays),
    },
    시간: {
      "사람": hourPeople, "사람날": hd,
      "12시주 가운데 가장 많은 단계의 몫(평균)": mean(modeShare),
      "12시주 가운데 코어 합계 부호가 같은 몫(평균)": mean(signShare),
      "12시주 단계가 모두 같은 날 %": pct(allSame, hd),
      "가장 많은 단계가 절반 이하인 날 %": pct(halfOrLess, hd),
      "지금 방식(시간 모름)의 단계가 최빈 단계와 같은 날 %": pct(policyIsMode, hd),
      "지금 방식의 기대 적중(12시주 중 같은 단계의 몫, 평균)": mean(policyAcc),
      "최빈 단계를 그대로 썼을 때의 기대 적중(평균)": mean(modeAcc),
      "용신 일치율 구간별": Object.fromEntries([...byW.entries()].map(([k, v]) => [k, { "날 %": pct(v.n, hd), "단계 최빈 몫": Math.round((v.band / v.n) * 100) / 100, "부호 최빈 몫": Math.round((v.sign / v.n) * 100) / 100, "지금 방식 기대 적중": Math.round((v.acc / v.n) * 100) / 100 }])),
    },
  };
  console.log(JSON.stringify(out, null, 1));
  if (process.env.AUDIT_OUT) writeFileSync(process.env.AUDIT_OUT, JSON.stringify(out, null, 1), "utf8");
}, 1_800_000);
