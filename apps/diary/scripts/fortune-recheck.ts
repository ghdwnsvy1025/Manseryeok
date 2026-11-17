/**
 * 일운 재설계 재측정 — GPT 3차 요청(2026-11-06)의 실험 1~6. 모델·DB 없음(0원).
 * fortune-audit.ts와 다른 점: 각도 후보를 근사로 다시 만들지 않고 angle.ts의 candidatesOf·allowedOf·quietNotesOf를 그대로 부른다.
 *
 * 실행 (apps/diary 에서):
 *   npx vitest run --config vitest.scripts.config.ts scripts/fortune-recheck.ts
 *   환경변수 RECHECK_PEOPLE(기본 100), RECHECK_DAYS(기본 180), RECHECK_START(기본 2026-11-05),
 *           RECHECK_ENTRY_PEOPLE(기본 30), RECHECK_OUT(JSON 저장 파일)
 *
 * 묶음:
 *   검산     — 스크립트의 "기존 고르기" 재현이 pickAngle과 같은가, 긴 자취로 부른 pickAngle이 운영 경로(angleInputFor)와 같은가
 *   실험1·4  — 후보 제한(allowedOf) × 고르는 법(기존 걸음 / 이분 매칭)을 갈라, 모든 연속 7일 창에서 잰다
 *   실험3    — 후보를 넓히는 폭을 가른다 (여섯 / +셋 / +일곱 / 합 뺌)
 *   실험2    — 후보로 있었던 것과 실제 고른 것의 차이: 5일·7일 묶음 제한, 쉬게 하기(quietNotesOf)
 *   재료     — 확답 표시가 없는 재료가 작가 입력에 들어가는 날의 비율
 *   반대인날 — 코어 일진 판정은 유리인데 단계가 주의인 날에 작가가 받는 것
 *   실험6    — 기록 보정이 있을 때 지난 날의 단계와 오늘의 각도가 다시 계산해도 같은가
 *   절입     — 절입일의 월운·세운이 언제 바뀌는가
 */
import { writeFileSync } from "node:fs";
import { test } from "vitest";
import { monthGanjiList, toCorePillars, type Pillars } from "@saju/core-rules";
import { HIDDEN, STEM_EL, groupMap, mainStem, elementOf } from "@saju/core-rules/base";
import { allowedOf, angleInputFor, candidatesOf, pickAngle, quietNotesOf, sceneKey, type DayAngle } from "@/lib/fortune/angle";
import { computeCoreFortune, ipchunDate, toScore01 } from "@/lib/fortune/core";
import { adjustWithEntries, bandOf, toTenPoint, type EntryLike } from "@/lib/fortune/personal";
import { TEN_GOD_EXPRESSIONS } from "@/lib/fortune/expressions";
import { buildPlan, daySeed, stemSet, type FortunePlan } from "@/lib/fortune/plan";
import type { CoreFortune, PersonalAdjustment } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";
import { addDays } from "@/lib/time";

const PEOPLE = Number(process.env.RECHECK_PEOPLE ?? 100);
const DAYS = Number(process.env.RECHECK_DAYS ?? 180);
const START = process.env.RECHECK_START ?? "2026-11-05";
const ENTRY_PEOPLE = Number(process.env.RECHECK_ENTRY_PEOPLE ?? 30);
/** 각도 고르기 21일 + 쉬게 하기 14일 묶음을 처음부터 따라가려고 넉넉히 앞에서 시작한다 */
const LEAD = 42;
/** 마지막 7일 묶음을 끝까지 채우려고 뒤로 더 계산한다 */
const TAIL = 7;

type Band = "좋음" | "무난" | "주의";
interface Day { date: string; core: CoreFortune; band: Band; personal: PersonalAdjustment; g: ReturnType<typeof dayGanji>; nearClash: boolean; extra3: string[]; extra7: string[] }
type Pick = string | null;

// fortune-evidence.ts·fortune-audit.ts와 같은 씨앗 — 같은 100명이다
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
const verdict3 = (v: string | null | undefined) => (!v ? "없음" : v.includes("유리") ? "좋음" : v === "보통" ? "무난" : "주의");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const mean = (xs: number[]) => (xs.length ? r2(xs.reduce((a, c) => a + c, 0) / xs.length) : 0);
const spread = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { 최소: s[0] ?? 0, 중간: s[Math.floor(s.length / 2)] ?? 0, 최대: s.at(-1) ?? 0 }; };
const rotate = <T,>(xs: T[], seed: number): T[] => (xs.length ? [...xs.slice(seed % xs.length), ...xs.slice(0, seed % xs.length)] : []);
const block7 = (date: string) => Math.floor(daySeed(date) / 7);
const kinds = (xs: DayAngle[]): string[] => xs.map((x) => x.kind);

/** angle.ts pickAngle의 걸음을 그대로 옮긴 것. 후보 목록만 바꿔 끼울 수 있다 */
function walk(lists: string[][], days: Day[], i: number): Pick {
  let last: Pick = null, picked: Pick = null;
  for (let t = Math.max(1, i - 6); t <= i; t++) {
    const list = lists[t]!;
    if (!list.length) { picked = null; last = null; continue; }
    const rot = rotate(list, daySeed(days[t]!.date));
    picked = list.find((k) => k === "되돌아옴") ?? rot.find((k) => k !== last) ?? rot[0]!;
    last = picked;
  }
  return picked;
}

/**
 * "후보로 있었다"가 아니라 "실제로 골랐다"를 기준으로 5일·7일 묶음 제한을 건 고르기 (GPT 3차 2절).
 * 자취의 앞에서부터 차례로 고른다. 고르는 규칙은 기존과 같다(되돌아옴 먼저, 전날과 다른 종류, 날짜로 돌림).
 * 운영의 "지난 7일을 다시 걷기"와 달리 출발점이 고정이라, 운영에 넣으려면 출발점을 정하는 규칙이 따로 필요하다.
 */
function walkUsed(lists: string[][], days: Day[], from: number, to = days.length - 1): Pick[] {
  const SIZE: Record<string, number> = { 되돌아옴: 7, 어제와달라짐: 5 };
  const out: Pick[] = days.map(() => null);
  let last: Pick = null;
  for (let t = from; t <= to; t++) {
    const list = (lists[t] ?? []).filter((k) => {
      const size = SIZE[k];
      if (!size) return true;
      const bk = Math.floor(daySeed(days[t]!.date) / size);
      for (let j = t - 1; j >= from && Math.floor(daySeed(days[j]!.date) / size) === bk; j--) if (out[j] === k) return false;
      return true;
    });
    if (!list.length) { out[t] = null; last = null; continue; }
    const rot = rotate(list, daySeed(days[t]!.date));
    out[t] = list.find((k) => k === "되돌아옴") ?? rot.find((k) => k !== last) ?? rot[0]!;
    last = out[t]!;
  }
  return out;
}

/** 감사 문서 F.2의 배정: 무거운 사실 고정 → 이분 매칭 → 남은 날은 첫 후보. 묶음의 7일이 모두 있어야 한다 */
function assignBlock(blk: { leads: string[]; pin: boolean; seed: number }[], usePin: boolean): Pick[] {
  if (blk.length !== 7) throw new Error("묶음이 7일이 아니다");
  const out: (Pick | undefined)[] = blk.map(() => undefined);
  const used = new Set<string>();
  if (usePin) blk.forEach((d, i) => { if (d.pin) { out[i] = "충"; used.add("충"); } });
  const rest = blk.map((d, i) => ({ i, leads: rotate(d.leads, d.seed).filter((k) => !used.has(k)) })).filter((d) => out[d.i] === undefined)
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
  blk.forEach((d, i) => { if (out[i] === undefined) out[i] = rotate(d.leads, d.seed)[0] ?? null; });
  return out as Pick[];
}

/** 자취 전체를 7일 묶음으로 배정한다. fix = 묶음 첫날이 앞 묶음 끝날과 같은 종류면 첫날만 바꾼다 */
function matchAll(lists: string[][], days: Day[], usePin: boolean, fix: boolean): Pick[] {
  const out: Pick[] = days.map(() => null);
  const byBlock = new Map<number, number[]>();
  days.forEach((d, i) => byBlock.set(block7(d.date), [...(byBlock.get(block7(d.date)) ?? []), i]));
  let prevLast: Pick | undefined;
  for (const b of [...byBlock.keys()].sort((x, y) => x - y)) {
    const idx = byBlock.get(b)!;
    if (idx.length !== 7 || idx.some((i) => lists[i] === undefined)) { prevLast = undefined; continue; }
    const blk = idx.map((i) => ({ leads: lists[i]!, pin: usePin && days[i]!.nearClash && lists[i]!.includes("충"), seed: daySeed(days[i]!.date) }));
    const raw = assignBlock(blk, usePin);
    const res = [...raw];
    if (fix && prevLast && res[0] === prevLast && !blk[0]!.pin) {
      const alts = rotate(blk[0]!.leads, blk[0]!.seed).filter((k) => k !== prevLast);
      res[0] = alts.find((k) => !res.slice(1).includes(k)) ?? alts[0] ?? res[0]!;
    }
    idx.forEach((i, n) => { out[i] = res[n]!; });
    prevLast = raw[6];
  }
  return out;
}

interface Acc { win: number; distinct: number[]; noneInWin: number; repDays: number; winRep: number; alignedSum: number; alignedN: number; crossSum: number; crossN: number; adjSame: number; adjN: number; days: number; noneDays: number; heavyRep: number; heavySel: number; heavyHeavy: number; per: number[] }
const newAcc = (): Acc => ({ win: 0, distinct: [], noneInWin: 0, repDays: 0, winRep: 0, alignedSum: 0, alignedN: 0, crossSum: 0, crossN: 0, adjSame: 0, adjN: 0, days: 0, noneDays: 0, heavyRep: 0, heavySel: 0, heavyHeavy: 0, per: [] });
/** 한 사람의 180일 배정을 모든 연속 7일 창으로 잰다 */
function addAcc(acc: Acc, a: Pick[], dates: string[], pin: boolean[]): void {
  const mine: number[] = [];
  for (let i = 0; i + 7 <= a.length; i++) {
    const span = a.slice(i, i + 7);
    const some = span.filter(Boolean) as string[];
    const d = new Set(some).size;
    acc.win++; acc.distinct.push(d); mine.push(d);
    acc.noneInWin += 7 - some.length;
    acc.repDays += some.length - d;
    if (some.length > d) acc.winRep++;
    if (block7(dates[i]!) === block7(dates[i + 6]!)) { acc.alignedSum += d; acc.alignedN++; } else { acc.crossSum += d; acc.crossN++; }
  }
  for (let i = 0; i < a.length; i++) {
    acc.days++;
    if (!a[i]) acc.noneDays++;
    if (i > 0) { acc.adjN++; if (a[i] && a[i] === a[i - 1]) acc.adjSame++; }
    // 무거운 충(일·월 자리 충)이 앞선 날. 앞 엿새에 "어떤 충이든" 있었는지와 "무거운 충"이 있었는지를 따로 센다
    if (a[i] === "충" && pin[i]) {
      acc.heavySel++;
      let any = false, heavy = false;
      for (let j = Math.max(0, i - 6); j < i; j++) if (a[j] === "충") { any = true; if (pin[j]) heavy = true; }
      if (any) acc.heavyRep++;
      if (heavy) acc.heavyHeavy++;
    }
  }
  acc.per.push(mine.reduce((x, y) => x + y, 0) / mine.length);
}
function result(acc: Acc) {
  const m = acc.per.reduce((x, y) => x + y, 0) / acc.per.length;
  const sd = Math.sqrt(acc.per.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, acc.per.length - 1));
  const h = (1.96 * sd) / Math.sqrt(acc.per.length);
  return {
    "7일 창의 서로 다른 종류(평균)": mean(acc.distinct), "사람 단위 95% 구간": [r2(m - h), r2(m + h)], "창별 최소/중간/최대": spread(acc.distinct),
    "7일 창의 없음인 날(평균)": r2(acc.noneInWin / acc.win), "없음인 날 %": pct(acc.noneDays, acc.days),
    "7일 창에서 같은 종류가 다시 나온 날(평균)": r2(acc.repDays / acc.win), "같은 종류가 두 번 이상 나온 창 %": pct(acc.winRep, acc.win),
    "전날과 같은 종류인 날 %": pct(acc.adjSame, acc.adjN),
    "묶음과 맞물린 창의 종류 수": r2(acc.alignedSum / Math.max(1, acc.alignedN)), "묶음 경계를 넘는 창의 종류 수": r2(acc.crossSum / Math.max(1, acc.crossN)),
    "무거운 충이 엿새 안에 또 앞선 날 %": pct(acc.heavyRep, acc.days),
    "무거운 충을 고른 날 %": pct(acc.heavySel, acc.days),
    "그날 앞 엿새에 어떤 충이든 고른 적이 있는 날 %(무거운 충을 고른 날 대비)": pct(acc.heavyRep, acc.heavySel),
    "그날 앞 엿새에도 무거운 충을 고른 날 %(전체 날 대비)": pct(acc.heavyHeavy, acc.days),
    "그날 앞 엿새에도 무거운 충을 고른 날 %(무거운 충을 고른 날 대비)": pct(acc.heavyHeavy, acc.heavySel),
  };
}

function build(b: BirthProfile): { p: Pillars; pillars: PillarsSnapshot; days: Day[] } | null {
  const prof = computeProfile({ ...b, name: "x" });
  if (!prof.ok) return null;
  const p = toCorePillars(prof.value.pillars);
  const { toGroup } = groupMap(p[2][0]!);
  const natal = new Set<string>();
  p.forEach((g, i) => { if (!g) return; if (i !== 2) natal.add(toGroup[STEM_EL[g[0]!]!]); natal.add(toGroup[elementOf(mainStem(g[1]!))]); });
  const days: Day[] = [];
  for (let k = -LEAD; k < DAYS + TAIL; k++) {
    const date = addDays(START, k);
    const g = dayGanji(date);
    const core = computeCoreFortune({ pillars: prof.value.pillars, profile: b, date, todayHanja: g.hanja });
    const personal = adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
    const band = bandOf(toTenPoint(personal.score)) as Band;
    const S = core.dayLuck.stem.char, ctx = core.context;
    const base = verdict3(ctx.wolun?.판정);
    const extra3: string[] = [];
    if ((base === "좋음" && band === "주의") || (base === "주의" && band === "좋음")) extra3.push("바탕대조");
    if (p.some((x) => x && STEM_COMBINE[S] === x[0])) extra3.push("천간합");
    if (ctx.daeun?.union || ctx.seun.union || ctx.wolun?.union) extra3.push("운합");
    const extra7 = [...extra3];
    if ((ctx.daeun && STEM_COMBINE[S] === ctx.daeun.간지[0]) || STEM_COMBINE[S] === ctx.seun.간지[0] || (ctx.wolun && STEM_COMBINE[S] === ctx.wolun.간지[0])) extra7.push("운천간합");
    if (!natal.has(core.dayLuck.stem.family) || !natal.has(core.dayLuck.branch.family)) extra7.push("없던기운");
    if (p.some((x, i) => x && i !== 2 && x[0] === S)) extra7.push("같은천간");
    if (p.some((x) => x && HIDDEN[x[1]!]!.includes(S))) extra7.push("투출");
    const nearClash = core.relations.hits.some((h) => h.kind === "충" && (h.pos === "일" || h.pos === "월"));
    days.push({ date, core, band, personal, g, nearClash, extra3, extra7 });
  }
  return { p, pillars: prof.value.pillars, days };
}

const notesOf = (plan: FortunePlan) => {
  const type = new Set<string>(), scene = new Set<string>();
  if (plan.core.typeNote) type.add(plan.core.typeNote);
  if (plan.support?.kind === "기운" && plan.support.part.typeNote) type.add(plan.support.part.typeNote);
  for (const a of plan.areas) if (a.scene) scene.add(sceneKey(a.scene));
  return { type, scene };
};

test("일운 재설계 재측정", async () => {
  const warn = console.warn;
  console.warn = () => {};
  const roster = people(PEOPLE);
  const METHODS = [
    "A 실제 v4.26 (후보 제한 + 기존 고르기)", "B0 후보 제한 + 매칭만", "B1 후보 제한 + 고정·매칭·경계 손질",
    "C 제한 없음 + 기존 고르기", "D0 제한 없음 + 매칭만", "D1 제한 없음 + 고정·매칭·경계 손질",
    "A 합 뺌 (후보 제한 + 기존 고르기)", "D1 합 뺌", "A 셋 더함 (후보 제한 + 기존 고르기)", "B1 셋 더함", "D1 셋 더함", "D1 일곱 더함",
    "E 실제 사용 기준 제한 + 기존 고르기(순차)", "E 셋 더함", "E 합 뺌", "E21 실제 사용 기준 제한 + 기존 고르기(지난 21일만 다시 계산)",
  ] as const;
  const acc = Object.fromEntries(METHODS.map((m) => [m, newAcc()])) as Record<(typeof METHODS)[number], Acc>;

  let total = 0, walkMismatch = 0, prodMismatch = 0, prodChecked = 0;
  // 실험 2a
  const blk = { 되돌아옴: { size: 7, blocked: 0, justified: 0, candBlocks: 0, usedBlocks: 0, candDays: 0, pickedDays: 0 }, 어제와달라짐: { size: 5, blocked: 0, justified: 0, candBlocks: 0, usedBlocks: 0, candDays: 0, pickedDays: 0 } };
  const availDays = new Map<string, number>(), pickedDays = new Map<string, number>();
  const pickedE = new Map<string, number>();
  let diffE = 0;
  // E를 운영 방식(날마다 지난 21일만 다시 계산)으로 옮겼을 때
  const e21 = { n: 0, diffSeq: 0, pairs: 0, inconsistent: 0 };
  // 수정본(쉬게 하기 켬)에서 같은 재료가 7일 안에 다시 가는가
  const mr = { days: 0, exprRep: 0, expr2: 0, sameGodDays: 0, sameGodRep: 0, sceneDays: 0, sceneRep: 0, areaDays: 0, areaRep: 0 };
  let reconDiff = 0;
  // 실험 2b
  const q = { days: 0, daysBlocked: 0, daysUnjust: 0, typeBlocked: 0, typeUnjust: 0, sceneBlocked: 0, sceneUnjust: 0, wantedNotes: 0, neverSent: 0 };
  // 재료
  const mat = { 합풀이: 0, 자리풀이: 0, 유형문구: 0, 장면: 0, 가설표시: 0, 어느것이든: 0 };
  // 반대인 날
  const opp = { n: 0, ctxIn: 0, read: new Map<string, number>(), angle: new Map<string, number>() };

  const kept: { b: BirthProfile; pillars: PillarsSnapshot; days: Day[] }[] = [];
  for (const b of roster) {
    const built = build(b);
    if (!built) continue;
    const { days } = built;
    kept.push({ b, pillars: built.pillars, days });
    const from = 15, lo = LEAD, hi = LEAD + DAYS;
    const cand: string[][] = [], allowed: string[][] = [];
    for (let t = from; t < days.length; t++) { cand[t] = kinds(candidatesOf(days, t)); allowed[t] = kinds(allowedOf(days, t)); }
    for (let t = 0; t < from; t++) { cand[t] = []; allowed[t] = []; }
    const noHap = (ls: string[][]) => ls.map((l) => l.filter((k) => k !== "합"));
    const plus = (ls: string[][], key: "extra3" | "extra7") => ls.map((l, t) => [...l, ...days[t]![key]]);
    const dates = days.slice(lo, hi).map((d) => d.date);
    const pin = days.slice(lo, hi).map((d) => d.nearClash);
    const walkAll = (ls: string[][]) => { const out: Pick[] = []; for (let i = lo; i < hi; i++) out.push(walk(ls, days, i)); return out; };
    const matchCut = (ls: string[][], usePin: boolean, fix: boolean) => matchAll(ls, days, usePin, fix).slice(lo, hi);

    const A = walkAll(allowed);
    // 실제 고른 각도는 한 번만 계산해 두고 아래에서 다시 쓴다 (쉬게 하기를 따라가려고 14일 앞에서부터)
    const obj: (DayAngle | null)[] = [];
    for (let i = lo - 14; i < hi; i++) obj[i] = pickAngle(days, i);
    const real: Pick[] = [];
    for (let i = lo; i < hi; i++) real.push(obj[i]?.kind ?? null);
    real.forEach((k, n) => { total++; if (k !== A[n]) walkMismatch++; });

    addAcc(acc["A 실제 v4.26 (후보 제한 + 기존 고르기)"], real, dates, pin);
    addAcc(acc["B0 후보 제한 + 매칭만"], matchCut(allowed, false, false), dates, pin);
    addAcc(acc["B1 후보 제한 + 고정·매칭·경계 손질"], matchCut(allowed, true, true), dates, pin);
    addAcc(acc["C 제한 없음 + 기존 고르기"], walkAll(cand), dates, pin);
    addAcc(acc["D0 제한 없음 + 매칭만"], matchCut(cand, false, false), dates, pin);
    addAcc(acc["D1 제한 없음 + 고정·매칭·경계 손질"], matchCut(cand, true, true), dates, pin);
    addAcc(acc["A 합 뺌 (후보 제한 + 기존 고르기)"], walkAll(noHap(allowed)), dates, pin);
    addAcc(acc["D1 합 뺌"], matchCut(noHap(cand), true, true), dates, pin);
    addAcc(acc["A 셋 더함 (후보 제한 + 기존 고르기)"], walkAll(plus(allowed, "extra3")), dates, pin);
    addAcc(acc["B1 셋 더함"], matchCut(plus(allowed, "extra3"), true, true), dates, pin);
    addAcc(acc["D1 셋 더함"], matchCut(plus(cand, "extra3"), true, true), dates, pin);
    addAcc(acc["D1 일곱 더함"], matchCut(plus(cand, "extra7"), true, true), dates, pin);
    addAcc(acc["E 실제 사용 기준 제한 + 기존 고르기(순차)"], walkUsed(cand, days, from).slice(lo, hi), dates, pin);
    addAcc(acc["E 셋 더함"], walkUsed(plus(cand, "extra3"), days, from).slice(lo, hi), dates, pin);
    addAcc(acc["E 합 뺌"], walkUsed(noHap(cand), days, from).slice(lo, hi), dates, pin);
    const eSeq = walkUsed(cand, days, from);
    eSeq.slice(lo, hi).forEach((k, n) => { if (k) pickedE.set(k, (pickedE.get(k) ?? 0) + 1); if (k !== real[n]) diffE++; });
    {
      const own: Pick[] = days.map(() => null);
      for (let i = lo - 7; i < hi; i++) {
        const w = walkUsed(cand, days, Math.max(from, i - 21), i);
        own[i] = w[i]!;
        if (i < lo) continue;
        e21.n++;
        if (own[i] !== eSeq[i]) e21.diffSeq++;
        // 오늘의 걸음 안에서 "지난 엿새에 골랐다"고 본 것이, 그 날들이 실제로 받은 답과 같은가
        for (let j = i - 6; j < i; j++) { e21.pairs++; if (w[j] !== own[j]) e21.inconsistent++; }
      }
      addAcc(acc["E21 실제 사용 기준 제한 + 기존 고르기(지난 21일만 다시 계산)"], own.slice(lo, hi), dates, pin);
    }

    // ---- 실험 2a: 후보로 있었다 / 실제로 골랐다 ----
    const pickedAt = (i: number): Pick => (i >= lo - 14 && i < hi ? obj[i]?.kind ?? null : pickAngle(days, i)?.kind ?? null);
    for (let i = lo; i < hi; i++) {
      for (const k of cand[i]!) availDays.set(k, (availDays.get(k) ?? 0) + 1);
      const pk = real[i - lo];
      if (pk) pickedDays.set(pk, (pickedDays.get(pk) ?? 0) + 1);
      for (const K of ["되돌아옴", "어제와달라짐"] as const) {
        const s = blk[K];
        if (!cand[i]!.includes(K)) continue;
        s.candDays++;
        if (pk === K) s.pickedDays++;
        if (allowed[i]!.includes(K)) continue;
        s.blocked++;
        const bk = Math.floor(daySeed(days[i]!.date) / s.size);
        let just = false;
        for (let j = i - 1; j >= from && Math.floor(daySeed(days[j]!.date) / s.size) === bk; j--) if (pickedAt(j) === K) { just = true; break; }
        if (just) s.justified++;
      }
    }
    for (const K of ["되돌아옴", "어제와달라짐"] as const) {
      const s = blk[K];
      const seen = new Map<number, { cand: boolean; used: boolean }>();
      for (let i = lo; i < hi; i++) {
        const bk = Math.floor(daySeed(days[i]!.date) / s.size);
        const cur = seen.get(bk) ?? { cand: false, used: false };
        if (cand[i]!.includes(K)) cur.cand = true;
        if (real[i - lo] === K) cur.used = true;
        seen.set(bk, cur);
      }
      for (const v of seen.values()) if (v.cand) { s.candBlocks++; if (v.used) s.usedBlocks++; }
    }

    // ---- 실험 2b · 재료 · 반대인 날: 실제 계획을 날마다 만든다 ----
    let curBlock = -1;
    let sent = new Set<string>(), wanted = new Set<string>();
    const closeBlock = (count: boolean) => { if (count) for (const n of wanted) { q.wantedNotes++; if (!sent.has(n)) q.neverSent++; } sent = new Set(); wanted = new Set(); };
    let blockCounts = false;
    const hist: { scenes: Set<string>; exprs: Set<string>; areas: Set<string>; god: string }[] = [];
    for (let i = lo - 14; i < hi; i++) {
      const d = days[i]!;
      const b14 = Math.floor(daySeed(d.date) / 14);
      if (b14 !== curBlock) { closeBlock(blockCounts); curBlock = b14; blockCounts = i >= lo; }
      const angle = obj[i] ?? null;
      const input = { core: d.core, personal: d.personal, date: d.date, band: d.band, recent: [], angle };
      const planQ = buildPlan({ ...input, quietNotes: quietNotesOf(days, i) });
      const planW = buildPlan({ ...input, quietNotes: new Set<string>() });
      const nq = notesOf(planQ), nw = notesOf(planW);
      for (const n of [...nw.type, ...nw.scene]) wanted.add(n);
      if (i >= lo) {
        q.days++;
        let any = false, unjust = false;
        for (const n of nw.type) if (!nq.type.has(n)) { any = true; q.typeBlocked++; if (!sent.has(n)) { q.typeUnjust++; unjust = true; } }
        for (const n of nw.scene) if (!nq.scene.has(n)) { any = true; q.sceneBlocked++; if (!sent.has(n)) { q.sceneUnjust++; unjust = true; } }
        if (any) q.daysBlocked++;
        if (unjust) q.daysUnjust++;
        const hap = angle?.kind === "합";
        const pos = angle?.kind === "충" || planQ.support?.kind === "충" || planQ.support?.kind === "복음";
        const ty = nq.type.size > 0, sc = nq.scene.size > 0;
        if (hap) mat.합풀이++;
        if (pos) mat.자리풀이++;
        if (ty) mat.유형문구++;
        if (sc) mat.장면++;
        if (hap || sc) mat.가설표시++;
        if (hap || pos || ty || sc) mat.어느것이든++;
        // 같은 재료가 앞 7일의 계획에 있었는가 (쉬게 하기를 켠 계획 기준)
        const exprToday = planQ.core.expressions;
        const repE = exprToday.filter((e) => hist.some((h) => h.exprs.has(e))).length;
        const god = `${planQ.core.tenGod}:${planQ.core.read}`;
        mr.days++; mr.exprRep += repE;
        if (repE >= 2) mr.expr2++;
        if (hist.some((h) => h.god === god)) { mr.sameGodDays++; mr.sameGodRep += repE; }
        if (nq.scene.size) { mr.sceneDays++; if ([...nq.scene].some((x) => hist.some((h) => h.scenes.has(x)))) mr.sceneRep++; }
        const areaKeys = planQ.areas.map((a) => `${a.area}${a.signal}`);
        if (areaKeys.length) { mr.areaDays++; if (areaKeys.every((k) => hist.some((h) => h.areas.has(k)))) mr.areaRep++; }
        const { raw, rel, ctx } = d.core.parts;
        // 운영이 실제로 낸 단계(d.band)로 본다. 반올림된 세 값을 다시 더한 단계와 다른 날도 센다 (GPT 3차 7절)
        if (bandOf(toTenPoint(toScore01(raw + rel + ctx))) !== d.band) reconDiff++;
        const nowBand = d.band;
        const v = d.core.dayLuck.total;
        if (nowBand === "주의" && (v === "유리" || v === "매우 유리")) {
          opp.n++;
          if (planQ.includeContext) opp.ctxIn++;
          opp.read.set(planQ.core.read, (opp.read.get(planQ.core.read) ?? 0) + 1);
          opp.angle.set(angle?.kind ?? "없음", (opp.angle.get(angle?.kind ?? "없음") ?? 0) + 1);
        }
      }
      for (const n of [...nq.type, ...nq.scene]) sent.add(n);
      hist.push({ scenes: nq.scene, exprs: new Set([...planQ.core.expressions, ...(planQ.support?.kind === "기운" ? planQ.support.part.expressions : [])]), areas: new Set(planQ.areas.map((a) => `${a.area}${a.signal}`)), god: `${planQ.core.tenGod}:${planQ.core.read}` });
      if (hist.length > 7) hist.shift();
    }
    closeBlock(blockCounts);
    await new Promise((res) => setTimeout(res, 0));
  }

  // ---- 검산: 긴 자취의 pickAngle = 운영 경로(angleInputFor, 지난 21일만 다시 계산) ----
  for (const { b, pillars, days } of kept.slice(0, 5)) {
    for (let i = LEAD; i < LEAD + Math.min(40, DAYS); i++) {
      const d = days[i]!;
      const prod = angleInputFor({ date: d.date, pillars, profile: b, entries: [] }, d.core, d.band).angle?.kind ?? null;
      prodChecked++;
      if (prod !== (pickAngle(days, i)?.kind ?? null)) prodMismatch++;
    }
    await new Promise((res) => setTimeout(res, 0));
  }

  // ---- 실험 6: 기록 보정이 있을 때, 지난 날의 단계를 어떻게 구해야 화면에 나갔던 것과 맞는가 ----
  // 방법: 현행(오늘 가진 기록 전부로 다시 계산) / 보정 없이 / 그날보다 앞선 날짜의 기록만 / 저장된 그날의 단계(화면에 나간 값)
  const POLS = ["현행(오늘 가진 기록 전부로 다시 계산)", "보정 없이 계산", "그날보다 앞선 날짜의 기록만으로 계산", "저장된 그날의 단계를 읽음"] as const;
  type Pol = (typeof POLS)[number];
  const RANK: Record<Band, number> = { 주의: 0, 무난: 1, 좋음: 2 };
  const sim = (late: number) => {
    const st = Object.fromEntries(POLS.map((p) => [p, { yDiff: 0, falseChange: 0, missed: 0, flipped: 0, pickDiff: 0 }])) as Record<Pol, { yDiff: number; falseChange: number; missed: number; flipped: number; pickDiff: number }>;
    let n = 0, bandByShift = 0, lateEntries = 0, allEntries = 0;
    let example: string | null = null;
    for (const { days } of kept.slice(0, ENTRY_PEOPLE)) {
      const r = rng(1000 + daySeed(days[0]!.date) + Math.round(days[0]!.core.parts.score01 * 1000) + days.length + Math.round(late * 100));
      const normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
      // 날마다 그날 밤 행복도 하나(평균 6, 표준편차 2, 1~10). late의 비율만큼은 1~3일 뒤에 그날 것으로 적는다
      const ent = days.map((d, idx) => {
        const e: EntryLike = { day_ganji_index: d.g.index, day_stem: d.g.stemKo, day_branch: d.g.branchKo, happiness: Math.max(1, Math.min(10, Math.round(6 + 2 * normal()))), entry_date: d.date };
        const w = idx + (r() < late ? 1 + Math.floor(r() * 3) : 0);
        allEntries++; if (w !== idx) lateEntries++;
        return { e, d: idx, w };   // d = 기록이 가리키는 날, w = 실제로 적은 날(그날 밤)
      });
      const bandBy = (j: number, pick: (x: { d: number; w: number }) => boolean): Band => {
        const d = days[j]!;
        return bandOf(toTenPoint(adjustWithEntries(d.core.parts.score01, ent.filter(pick).map((x) => x.e), { index: d.g.index, stemKo: d.g.stemKo, branchKo: d.g.branchKo }).score)) as Band;
      };
      const shown: Band[] = days.map((_, j) => bandBy(j, (x) => x.w < j));   // 그날 화면에 나간 단계: 그때까지 적힌 기록
      for (let i = LEAD; i < LEAD + DAYS; i++) {
        n++;
        const today = shown[i]!;
        if (today !== days[i]!.band) bandByShift++;
        const past: Record<Pol, (j: number) => Band> = {
          "현행(오늘 가진 기록 전부로 다시 계산)": (j) => bandBy(j, (x) => x.w < i),
          "보정 없이 계산": (j) => days[j]!.band,
          "그날보다 앞선 날짜의 기록만으로 계산": (j) => bandBy(j, (x) => x.w < i && x.d < j),
          "저장된 그날의 단계를 읽음": (j) => shown[j]!,
        };
        // 운영과 같은 길이의 자취: 지난 21일 + 오늘
        const trailOf = (f: (j: number) => Band) => { const t: Day[] = []; for (let j = i - 21; j < i; j++) t.push({ ...days[j]!, band: f(j) }); t.push({ ...days[i]!, band: today }); return t; };
        const truth = trailOf(past["저장된 그날의 단계를 읽음"]);
        const kTruth = pickAngle(truth, 21)?.kind ?? null;
        const ys = shown[i - 1]!;
        for (const p of POLS) {
          const tr = p === "저장된 그날의 단계를 읽음" ? truth : trailOf(past[p]);
          const y = tr[20]!.band;
          if (y !== ys) st[p].yDiff++;
          const dP = RANK[today] - RANK[y], dT = RANK[today] - RANK[ys];
          if (dP !== 0 && dT === 0) st[p].falseChange++;
          else if (dP === 0 && dT !== 0) st[p].missed++;
          else if (dP * dT < 0) st[p].flipped++;
          if ((pickAngle(tr, 21)?.kind ?? null) !== kTruth) st[p].pickDiff++;
          if (!example && p === "보정 없이 계산" && dP !== 0 && dT === 0) example = `${days[i]!.date}: 어제 화면에 나간 단계 ${ys}, 어제를 보정 없이 계산한 단계 ${y}, 오늘 ${today}. 화면으로는 어제와 같은데 "어제와 달라짐" 후보가 생긴다`;
        }
      }
    }
    return {
      "사람날": n, "늦게 적은 기록 %": pct(lateEntries, allEntries), "보정으로 오늘 단계가 바뀐 날 %": pct(bandByShift, n),
      ...Object.fromEntries(POLS.map((p) => [p, {
        "어제의 단계가 어제 화면과 다른 날 %": pct(st[p].yDiff, n),
        "화면으로는 어제와 같은데 달라졌다고 보는 날 %": pct(st[p].falseChange, n),
        "화면으로는 달라졌는데 같다고 보는 날 %": pct(st[p].missed, n),
        "오르내림의 방향이 화면과 반대인 날 %": pct(st[p].flipped, n),
        "오늘의 각도가 화면 기준으로 고른 것과 다른 날 %": pct(st[p].pickDiff, n),
      }])),
      "보정 없이 계산할 때 어긋난 예": example,
    };
  };
  const e6 = { "모두 그날 밤에 적음": sim(0), "다섯 중 하나는 1~3일 뒤에 적음": sim(0.2) };

  // GPT가 요청한 시험: 어제 화면 단계 무난, 어제 보정 없는 단계 주의, 오늘 좋음 — 작가에게 가는 재료가 달라지는가
  const probe = (() => {
    const { days } = kept[0]!;
    const i = LEAD + 10;
    const mk = (y: Band, t: Band) => { const tr: Day[] = days.slice(i - 21, i + 1).map((d) => ({ ...d })); tr[20]!.band = y; tr[21]!.band = t; return candidatesOf(tr, 21).find((c) => c.kind === "어제와달라짐")?.story ?? "(후보 없음)"; };
    return { "어제 무난(화면) → 오늘 좋음": mk("무난", "좋음"), "어제 주의(보정 없음) → 오늘 좋음": mk("주의", "좋음"), "어제 무난(화면) → 오늘 무난": mk("무난", "무난"), "어제 주의(보정 없음) → 오늘 무난": mk("주의", "무난") };
  })();

  // ---- 짝지은 차이: 같은 사람의 A 대비 (사람 단위 짝 부트스트랩 2,000번) ----
  const baseArr = acc[METHODS[0]].per;
  const bootRng = rng(777);
  const paired = Object.fromEntries(METHODS.slice(1).map((m) => {
    const d = acc[m].per.map((x, k) => x - baseArr[k]!);
    const mu = d.reduce((x, y) => x + y, 0) / d.length;
    const bs: number[] = [];
    for (let k = 0; k < 2000; k++) { let sum = 0; for (let q2 = 0; q2 < d.length; q2++) sum += d[Math.floor(bootRng() * d.length)]!; bs.push(sum / d.length); }
    bs.sort((x, y) => x - y);
    return [m, { "A와의 차이(평균)": Math.round(mu * 1000) / 1000, "95% 구간": [Math.round(bs[49]! * 1000) / 1000, Math.round(bs[1949]! * 1000) / 1000], "A보다 늘어난 사람 %": pct(d.filter((x) => x > 0).length, d.length), "A보다 줄어든 사람 %": pct(d.filter((x) => x < 0).length, d.length) }];
  }));

  // ---- 표현 표 안에서, 서로 다른 십신인데 거의 같은 말 (어간 셋 이상 겹침: 계획이 최근 문장을 거를 때 쓰는 기준과 같다) ----
  const flat: { god: string; text: string }[] = [];
  for (const [god, ex] of Object.entries(TEN_GOD_EXPRESSIONS)) for (const text of [...ex.경향, ...ex.과할때, ...ex.활용]) flat.push({ god, text });
  const dup: string[] = [];
  let dupPairs = 0;
  for (let x = 0; x < flat.length; x++) for (let y = x + 1; y < flat.length; y++) {
    if (flat[x]!.god === flat[y]!.god) continue;
    const sa = stemSet(flat[x]!.text), sb = stemSet(flat[y]!.text);
    let shared = 0;
    for (const w of sa) if (sb.has(w)) shared++;
    if (shared >= 3) { dupPairs++; if (dup.length < 8) dup.push(`${flat[x]!.god} "${flat[x]!.text}" / ${flat[y]!.god} "${flat[y]!.text}"`); }
  }

  // ---- 절입: 월운·세운이 바뀌는 날 ----
  const first = kept[0]!;
  const ctxOf = (date: string) => computeCoreFortune({ pillars: first.pillars, profile: first.b, date, todayHanja: dayGanji(date).hanja }).context;
  const terms = monthGanjiList(START, 8).slice(1).map((m) => {
    const day = m.시작.slice(0, 10);
    return { 절입시각: m.시작, 정오기준: m.시작.slice(11, 16) < "12:00" ? "정오 전" : "정오 뒤", 새월운: m.간지, 전날월운: ctxOf(addDays(day, -1)).wolun?.간지, 당일월운: ctxOf(day).wolun?.간지, 다음날월운: ctxOf(addDays(day, 1)).wolun?.간지 };
  });
  const twoYears = monthGanjiList(START, 25).slice(1);
  const afterNoon = twoYears.filter((m) => m.시작.slice(11, 16) >= "12:00");
  const ip = ipchunDate(2027);
  const ipchun = { 입춘날짜: ip, 전날세운: ctxOf(addDays(ip, -1)).seun.간지, 당일세운: ctxOf(ip).seun.간지, 다음날세운: ctxOf(addDays(ip, 1)).seun.간지 };
  console.warn = warn;

  const share = (m: Map<string, number>, d: number) => Object.fromEntries([...m.entries()].sort((a, c) => c[1] - a[1]).map(([k, n]) => [k, pct(n, d)]));
  const out = {
    조건: { 사람: kept.length, 날: DAYS, 시작: START, 총사람날: total, "7일 창 수": acc[METHODS[0]].win },
    검산: {
      "스크립트의 기존 고르기 재현이 pickAngle과 다른 날": walkMismatch,
      "긴 자취의 pickAngle이 운영 경로(angleInputFor)와 다른 날": prodMismatch, "운영 경로와 견준 날 수": prodChecked,
    },
    "실험 1·3·4 (모든 연속 7일 창)": Object.fromEntries(METHODS.map((m) => [m, result(acc[m])])),
    "실험 2a 후보로 있었던 날과 실제 고른 날": {
      "각도별 후보인 날 %": share(availDays, total), "각도별 실제 고른 날 %": share(pickedDays, total),
      "실제 사용 기준으로 바꾸면 각도별 고른 날 %": share(pickedE, total), "실제 사용 기준으로 바꾸면 그날의 각도가 달라지는 날 %": pct(diffE, total),
      "되돌아옴(7일 묶음)": { "후보인 날": blk.되돌아옴.candDays, "그중 실제 고른 날 %": pct(blk.되돌아옴.pickedDays, blk.되돌아옴.candDays), "제한에 막힌 날": blk.되돌아옴.blocked, "그중 같은 묶음에서 이미 실제로 쓴 뒤 막힌 날 %": pct(blk.되돌아옴.justified, blk.되돌아옴.blocked), "후보가 있었던 묶음": blk.되돌아옴.candBlocks, "그중 한 번도 쓰이지 않은 묶음 %": pct(blk.되돌아옴.candBlocks - blk.되돌아옴.usedBlocks, blk.되돌아옴.candBlocks) },
      "어제와달라짐(5일 묶음)": { "후보인 날": blk.어제와달라짐.candDays, "그중 실제 고른 날 %": pct(blk.어제와달라짐.pickedDays, blk.어제와달라짐.candDays), "제한에 막힌 날": blk.어제와달라짐.blocked, "그중 같은 묶음에서 이미 실제로 쓴 뒤 막힌 날 %": pct(blk.어제와달라짐.justified, blk.어제와달라짐.blocked), "후보가 있었던 묶음": blk.어제와달라짐.candBlocks, "그중 한 번도 쓰이지 않은 묶음 %": pct(blk.어제와달라짐.candBlocks - blk.어제와달라짐.usedBlocks, blk.어제와달라짐.candBlocks) },
    },
    "실험 2b 쉬게 하기(14일 묶음)": {
      "문구나 장면이 쉬게 하기로 빠진 날 %": pct(q.daysBlocked, q.days),
      "그 묶음에서 한 번도 작가에게 가지 않았는데 빠진 날 %": pct(q.daysUnjust, q.days),
      "빠진 유형 문구 수": q.typeBlocked, "그중 한 번도 가지 않은 것 %": pct(q.typeUnjust, q.typeBlocked),
      "빠진 장면 수": q.sceneBlocked, "그중 한 번도 가지 않은 것 % ": pct(q.sceneUnjust, q.sceneBlocked),
      "묶음마다 쓰려던 문구·장면 수(합계)": q.wantedNotes, "그중 묶음 내내 한 번도 가지 못한 것 %": pct(q.neverSent, q.wantedNotes),
    },
    "재료가 작가 입력에 들어가는 날 %": {
      "합의 자리 풀이(가설 표시, angle.ts:33)": pct(mat.합풀이, q.days), "충·복음의 자리 풀이(core.ts POS_LIFE)": pct(mat.자리풀이, q.days),
      "유형 문구(typeNotes.ts)": pct(mat.유형문구, q.days), "영역 장면(가설 표시, areaScenes.ts)": pct(mat.장면, q.days),
      "가설 표시가 붙은 것(합 풀이 또는 장면)이 하나라도": pct(mat.가설표시, q.days), "넷 중 하나라도": pct(mat.어느것이든, q.days),
    },
    "반대인 날(유리 판정, 주의 단계)": {
      "날 %": pct(opp.n, q.days), "그중 맥락(큰 운 문장)이 작가에게 가는 날 %": pct(opp.ctxIn, opp.n),
      "그날 핵심의 읽기": share(opp.read, opp.n), "그날 고른 각도": share(opp.angle, opp.n),
    },
    "실험 6 지난 날의 단계를 구하는 네 가지 방법(기록 모의, 30명)": e6,
    "GPT 요청 시험: 어제와달라짐 재료의 문장": probe,
    "A와 짝지은 차이(7일 창의 서로 다른 종류)": paired,
    "E를 운영 방식으로 옮겼을 때(E21)": {
      "날 수": e21.n, "앞에서부터 차례로 고른 E와 답이 다른 날 %": pct(e21.diffSeq, e21.n),
      "오늘의 걸음이 지난 엿새에 골랐다고 본 것이 그 날들의 실제 답과 다른 비율 %": pct(e21.inconsistent, e21.pairs),
    },
    "수정본 계획에서 같은 재료가 앞 7일에 이미 갔던 정도(쉬게 하기 켬, 최근 글 없이 계산)": {
      "핵심 표현 넷 가운데 앞 7일에 이미 간 것(평균 개수)": r2(mr.exprRep / mr.days), "둘 이상이 다시 간 날 %": pct(mr.expr2, mr.days),
      "같은 핵심(십신+읽기)이 앞 7일에 있었던 날 %": pct(mr.sameGodDays, mr.days), "그런 날에 다시 간 표현(평균 개수)": r2(mr.sameGodRep / Math.max(1, mr.sameGodDays)),
      "장면이 간 날 가운데 앞 7일에 같은 장면이 갔던 날 %": pct(mr.sceneRep, mr.sceneDays),
      "영역이 간 날 가운데 그 영역과 방향이 모두 앞 7일에 갔던 날 %": pct(mr.areaRep, mr.areaDays),
    },
    "표현 표: 다른 십신인데 어간 셋 이상 겹치는 문장 쌍": { "쌍 수": dupPairs, "문장 수": flat.length, 예: dup },
    "반올림된 세 값을 다시 더한 단계가 실제 단계와 다른 날": reconDiff,
    절입: { 월운: terms, 세운: ipchun, "앞으로 24번의 절입 가운데 정오 뒤인 것": afterNoon.length, "정오 뒤 절입": afterNoon.map((m) => m.시작.slice(0, 16)) },
  };
  console.log(JSON.stringify(out, null, 1));
  if (process.env.RECHECK_OUT) writeFileSync(process.env.RECHECK_OUT, JSON.stringify(out, null, 1), "utf8");
}, 3_600_000);
