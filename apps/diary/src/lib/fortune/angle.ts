// 오늘의 각도 (v4.26, 2026-11-05 앱 주인 결정, 시험 중). 같은 사람이 매일 읽는 글이 다르게 읽히게 한다.
// 측정: 81.5%의 날은 최근 14일 안에 같은 핵심 십신이 있었고, 핵심이 같으면 본문 겹침이 3.6배였다. 재료를 핵심 하나로만 고르던 것이 뿌리다.
// 그런데 같은 핵심이 다시 온 날의 81%는 다른 쪽 글자·합충 자리·단계 가운데 하나가 지난번과 달랐고, 합은 52%의 날에 있었지만 글 재료로 쓰지 않았다.
// 코드가 그날 실제로 있는 근거 가운데 하나를 골라 작가에게 준다. 점수와 단계는 건드리지 않는다.
// 합은 코어 삼합.md대로 좋고 나쁨을 정하지 않는다. 자리별 생활 풀이는 일기 앱의 가설이다.
// 1차 시험(K12)에서 재료 문구가 글에 그대로 샜다("좋고 나쁨을 정할 필요는 없어요", "따로 두는 편이 나아요") — 재료에 작가용 안내 말을 넣지 않는다.
import { areaScene } from "./areaScenes";
import { TEN_GOD_THEME } from "./base";
import { computeCoreFortune } from "./core";
import { adjustWithEntries, bandOf, toTenPoint, type EntryLike } from "./personal";
import { daySeed } from "./plan";
import { typeNoteOf } from "./typeNotes";
import type { AreaName, CoreFortune, CoreLuckPart } from "./types";
import { dayGanji } from "../ganji";
import { addDays } from "../time";
import type { BirthProfile, PillarsSnapshot } from "../profile";

export type AngleKind = "합" | "충" | "엇갈림" | "어제와달라짐" | "되돌아옴" | "큰흐름";
export interface DayAngle {
  kind: AngleKind;
  /** 작가에게 주는 내부 재료. 글에 그대로 쓰지 않는다 */
  story: string;
}

type Band = "좋음" | "무난" | "주의";
export interface DayTrace { date: string; core: CoreFortune; band: Band }

/** 14일 안의 지난 핵심과 앞선 며칠의 각도까지 보려고 21일을 계산한다. 코어 계산은 하루 약 4ms다 */
const TRAIL_DAYS = 21;
/** 각도 고르기를 앞에서부터 따라가는 날 수 */
const WALK_DAYS = 7;

/** 합이 걸린 내 자리의 생활 풀이 두 가지씩 (가설). 날짜로 돌린다 */
const UNION_STORY: Record<"연" | "월" | "일" | "시", readonly [string, string]> = {
  연: ["오래 알고 지낸 사람이나 예전에 하던 일이 다시 떠오르기 쉬움", "오랜만에 연락이 닿거나 지난 인연과 다시 엮일 일이 생기기 쉬움"],
  월: ["집안이나 일터 사람들과 호흡을 맞출 일이 늘기 쉬움", "집안이나 일터에서 누군가와 한편이 되어 움직이기 쉬움"],
  일: ["가장 가까운 사람과의 거리가 평소보다 줄어들기 쉬움", "곁에 있는 사람에게 마음이 쓰이고 같이 하고 싶은 일이 생기기 쉬움"],
  시: ["앞으로 하려던 일에 함께할 사람이 떠오르기 쉬움", "미래 계획을 누군가와 나누고 싶어지기 쉬움"],
};
const BAND_RANK: Record<Band, number> = { 주의: 0, 무난: 1, 좋음: 2 };

/** 계획과 같은 기준: |점수| 큰 쪽이 핵심, 같으면 천간 */
function partsOf(core: CoreFortune): [CoreLuckPart, CoreLuckPart] {
  const { stem, branch } = core.dayLuck;
  return Math.abs(stem.score) >= Math.abs(branch.score) ? [stem, branch] : [branch, stem];
}
const isHelp = (p: CoreLuckPart) => p.label === "용" || p.label === "희";
const isExcess = (p: CoreLuckPart) => p.label === "구" || p.label === "기";

/** 그날 쓸 수 있는 각도 전부. 측정 스크립트(scripts/fortune-recheck.ts)가 같은 후보로 재려고 내보낸다 */
export function candidatesOf(trail: readonly DayTrace[], i: number): DayAngle[] {
  const { core, band, date } = trail[i]!;
  const [main, other] = partsOf(core);
  const out: DayAngle[] = [];

  // 사신합은 코어가 한쪽으로 쏠리지 않는 대립으로 본다 (삼합.md). 합의 생활 풀이를 쓰지 않는다
  const union = core.relations.hits.find((h) => (h.kind === "육합" || h.kind === "삼합" || h.kind === "반합") && !(h.chars.includes("巳") && h.chars.includes("申")));
  if (union) out.push({ kind: "합", story: UNION_STORY[union.pos][daySeed(date) % 2]! });

  const clash = core.relations.hits.find((h) => h.kind === "충" && h.fact);
  if (clash?.fact) out.push({ kind: "충", story: clash.fact });

  if (other.tenGod !== main.tenGod && ((isHelp(main) && isExcess(other)) || (isExcess(main) && isHelp(other)))) {
    const [good, over] = isHelp(main) ? [main, other] : [other, main];
    out.push({ kind: "엇갈림", story: `'${TEN_GOD_THEME[good.tenGod]}' 쪽은 오늘 도움이 되는데 '${TEN_GOD_THEME[over.tenGod]}' 쪽은 필요 이상으로 세지기 쉬움` });
  }

  const yesterday = trail[i - 1];
  if (yesterday && yesterday.band !== band) {
    const up = BAND_RANK[band] > BAND_RANK[yesterday.band];
    const [yMain] = partsOf(yesterday.core);
    out.push({ kind: "어제와달라짐", story: `어제는 '${TEN_GOD_THEME[yMain.tenGod]}' 쪽이었고 오늘은 '${TEN_GOD_THEME[main.tenGod]}' 쪽이며, 어제보다 ${up ? "걸리는 일이 줄어듦" : "조심할 일이 늘어남"}` });
  }

  for (let j = i - 1; j >= Math.max(0, i - 14); j--) {
    const past = trail[j]!;
    const [pMain, pOther] = partsOf(past.core);
    if (pMain.tenGod !== main.tenGod) continue;
    const differs: string[] = [];
    if (pOther.tenGod !== other.tenGod) differs.push(`지난번엔 '${TEN_GOD_THEME[pOther.tenGod]}' 쪽이 함께 왔고 오늘은 '${TEN_GOD_THEME[other.tenGod]}' 쪽이 함께 옴`);
    if (past.band !== band) differs.push(BAND_RANK[band] > BAND_RANK[past.band] ? "지난번보다 걸리는 일이 적음" : "지난번보다 조심할 일이 많음");
    if (differs.length) out.push({ kind: "되돌아옴", story: `며칠 전에도 같은 '${TEN_GOD_THEME[main.tenGod]}' 성향이 왔음. ${differs.join(". ")}` });
    break;
  }

  if (core.context.daeun?.clash || core.context.seun.clash || core.context.wolun?.clash) {
    out.push({ kind: "큰흐름", story: "이번 달이나 올해의 큰 흐름과 오늘이 어긋남. 사건보다 체감이 평소보다 들쭉날쭉하기 쉬움" });
  }
  return out;
}

/** 이 꼴들은 "그때는 ~, 오늘은 ~"로 읽혀 틀로 굳기 쉽다 (K12: 14일에 4번). 날짜 묶음마다 처음 쓸 수 있는 날에만 쓴다 */
const BLOCK_DAYS: Partial<Record<AngleKind, number>> = { 되돌아옴: 7, 어제와달라짐: 5 };

export function allowedOf(trail: readonly DayTrace[], t: number): DayAngle[] {
  return candidatesOf(trail, t).filter((c) => {
    const size = BLOCK_DAYS[c.kind];
    if (!size) return true;
    const block = Math.floor(daySeed(trail[t]!.date) / size);
    for (let j = t - 1; j >= 1 && Math.floor(daySeed(trail[j]!.date) / size) === block; j--) {
      if (candidatesOf(trail, j).some((x) => x.kind === c.kind)) return false;
    }
    return true;
  });
}

/**
 * 되돌아옴을 쓸 수 있는 날은 그것을 쓰고(7일에 한 번), 나머지는 날짜로 돌리되 전날과 같은 종류를 피한다.
 * 다른 각도가 없으면 전날과 같은 종류도 쓴다. 같은 날이면 늘 같은 값이다.
 */
export function pickAngle(trail: readonly DayTrace[], i: number): DayAngle | null {
  let lastKind: AngleKind | null = null;
  let picked: DayAngle | null = null;
  for (let t = Math.max(1, i - WALK_DAYS + 1); t <= i; t++) {
    const list = allowedOf(trail, t);
    if (!list.length) { picked = null; lastKind = null; continue; }
    const seed = daySeed(trail[t]!.date);
    const rotated = [...list.slice(seed % list.length), ...list.slice(0, seed % list.length)];
    picked = list.find((c) => c.kind === "되돌아옴") ?? rotated.find((c) => c.kind !== lastKind) ?? rotated[0]!;
    lastKind = picked.kind;
  }
  return picked;
}

/** 장면을 집합에서 찾을 때 쓰는 열쇠 */
export const sceneKey = (note: { 좋은: string } | { 조심: string }): string => ("좋은" in note ? note.좋은 : note.조심);

/**
 * 설명 층 문구는 한 사람이 5.7종뿐이고 장면도 같은 영역 신호면 같은 문장이라 그대로 두면 며칠마다 돌아온다
 * (K12: "몫을 두고 신경전" 9일에 세 번). 14일 묶음마다 문구별로 처음 나오는 날에만 보낸다.
 * 묶음은 날짜로 정해져 앞날의 결정을 거슬러 찾지 않아도 된다.
 */
export function quietNotesOf(trail: readonly DayTrace[], i: number): Set<string> {
  const block = (date: string) => Math.floor(daySeed(date) / 14);
  const today = trail[i]!;
  const quiet = new Set<string>();
  for (const past of trail.slice(0, i)) {
    if (block(past.date) !== block(today.date)) continue;
    for (const part of partsOf(past.core)) {
      const note = typeNoteOf(past.core, part);
      if (note) quiet.add(note);
    }
    const profile = past.core.todayAreaProfile;
    if (!profile) continue;
    for (const a of past.core.areas) {
      if (a.period !== "오늘" || a.signal === "→") continue;
      const entry = profile[a.area as AreaName];
      const scene = entry ? areaScene(a.area as AreaName, entry) : null;
      if (scene) quiet.add(sceneKey(scene));
    }
  }
  return quiet;
}

export interface AngleRequest {
  date: string;
  pillars: PillarsSnapshot;
  profile: BirthProfile | null;
  entries: EntryLike[];
}

/** 계획에 넣을 오늘의 각도와, 오늘은 쉬게 할 설명 층 문구·장면 */
export function angleInputFor(req: AngleRequest, core: CoreFortune, band: Band): { angle: DayAngle | null; quietNotes: Set<string> } {
  const trail: DayTrace[] = [];
  for (let k = TRAIL_DAYS; k >= 1; k--) {
    const date = addDays(req.date, -k);
    const g = dayGanji(date);
    const c = computeCoreFortune({ pillars: req.pillars, profile: req.profile, date, todayHanja: g.hanja });
    const p = adjustWithEntries(c.parts.score01, req.entries, { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
    trail.push({ date, core: c, band: bandOf(toTenPoint(p.score)) });
  }
  trail.push({ date: req.date, core, band });
  return { angle: pickAngle(trail, TRAIL_DAYS), quietNotes: quietNotesOf(trail, TRAIL_DAYS) };
}
