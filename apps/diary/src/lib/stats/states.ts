// 오늘 있었던 일(상태값) 통계 (2026-11-14). 저장하지 않고 읽을 때 계산한다.
//   stateSummary — 최근 N일, 축마다 세 단계가 몇 번이었나 ("바쁨 12일 · 여유 5일")
//   stateTagTop — 최근 N일 자주 고른 세부 낱말
//   stateByGroup — 십신 갈래가 온 날(그날 천간 또는 지지가 내 일간에게 그 갈래)에 그 갈래의 축이 어땠나
//     ("비겁이 온 날 4번 중 3번 마찰이 있었어요"). 운세가 예고한 것을 기록으로 맞춰 보는 자리다.
//     표본이 5번 미만이면 비율(ratio)을 내지 않는다 — 횟수만 보여 준다.
import { STEMS, STEMS_KO, getTenGod, type StemHanja } from "@saju/engine";
import { FAMILY_OF } from "../fortune/base";
import type { TenGodFamily } from "../fortune/types";
import { STATE_AXES, STATE_TAG_LABEL, stateSay, type StateKey, type States } from "../entry";
import { addDays } from "../time";

export interface StateEntry {
  entry_date?: string;
  day_stem: string;
  day_branch: string;
  states?: States | null;
}

export interface StateAxisSummary {
  key: StateKey;
  label: string;
  levels: readonly [string, string, string];
  /** 이 축을 고른 날 수 */
  n: number;
  /** 단계 1·2·3을 고른 날 수 */
  counts: [number, number, number];
}

const inWindow = (e: StateEntry, today: string, days: number): boolean => {
  if (!e.entry_date) return true;
  return e.entry_date > addDays(today, -days) && e.entry_date <= today;
};

function tally(entries: StateEntry[], key: StateKey): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (const e of entries) {
    const lv = e.states?.[key];
    if (lv === 1 || lv === 2 || lv === 3) c[lv - 1]++;
  }
  return c;
}

export function stateSummary(entries: StateEntry[], today: string, days = 30): StateAxisSummary[] {
  const recent = entries.filter((e) => e.states && inWindow(e, today, days));
  return STATE_AXES.map((a) => {
    const counts = tally(recent, a.key);
    return { key: a.key, label: a.label, levels: a.levels, n: counts[0] + counts[1] + counts[2], counts };
  });
}

export interface StateTagCount { key: string; label: string; axis: StateKey; n: number }
export function stateTagTop(entries: StateEntry[], today: string, days = 30, limit = 5): StateTagCount[] {
  const acc = new Map<string, number>();
  for (const e of entries) if (e.states?.tags && inWindow(e, today, days)) for (const t of e.states.tags) acc.set(t, (acc.get(t) ?? 0) + 1);
  const axisOf = (t: string): StateKey => STATE_AXES.find((a) => a.tags.some((x) => x.key === t))!.key;
  return [...acc.entries()]
    .filter(([t]) => STATE_TAG_LABEL[t])
    .map(([t, n]) => ({ key: t, label: STATE_TAG_LABEL[t]!, axis: axisOf(t), n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

/** 지지의 정기(본기) 천간 — 지지의 십신은 정기로 본다 (운세 코어와 같은 기준) */
const MAIN_STEM_KO: Record<string, string> = { 자: "계", 축: "기", 인: "갑", 묘: "을", 진: "무", 사: "병", 오: "정", 미: "기", 신: "경", 유: "신", 술: "무", 해: "임" };
const stemHanja = (ko: string): StemHanja | null => {
  const i = STEMS_KO.indexOf(ko as (typeof STEMS_KO)[number]);
  return i >= 0 ? (STEMS[i] as StemHanja) : null;
};

/** 그날 온 십신 갈래 (천간·지지 정기, 겹치면 하나) */
export function groupsOfDay(e: Pick<StateEntry, "day_stem" | "day_branch">, dayMaster: string): TenGodFamily[] {
  const out: TenGodFamily[] = [];
  for (const ko of [e.day_stem, MAIN_STEM_KO[e.day_branch] ?? ""]) {
    const h = stemHanja(ko);
    if (!h) continue;
    const g = FAMILY_OF[getTenGod(dayMaster as StemHanja, h)];
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

/** 비율을 말해도 되는 최소 표본 */
export const STATE_RATIO_MIN = 5;

export interface GroupStateRow {
  group: TenGodFamily;
  axis: StateKey;
  label: string;
  levels: readonly [string, string, string];
  /** 그 갈래가 온 날 가운데 이 축을 고른 날 수 */
  n: number;
  counts: [number, number, number];
  /** 가장 많이 고른 단계. n이 STATE_RATIO_MIN 미만이면 ratio는 null(횟수만 말한다). 고른 날이 없으면 null */
  top: { level: 1 | 2 | 3; word: string; count: number; ratio: number | null } | null;
  /** 견줄 값: 그 갈래가 오지 않은 날의 같은 단계 비율 (그날들 표본도 5 이상일 때만) */
  otherRatio: number | null;
}

/**
 * 십신 갈래가 온 날의 상태. dayMaster = 내 일간(한자). 공통 축(pace)은 갈래가 없어 들어가지 않는다.
 */
export function stateByGroup(entries: StateEntry[], dayMaster: string): GroupStateRow[] {
  const withStates = entries.filter((e) => e.states);
  return STATE_AXES.filter((a) => a.group !== null).map((a) => {
    const group = a.group as TenGodFamily;
    const on = withStates.filter((e) => groupsOfDay(e, dayMaster).includes(group));
    const off = withStates.filter((e) => !groupsOfDay(e, dayMaster).includes(group));
    const counts = tally(on, a.key);
    const n = counts[0] + counts[1] + counts[2];
    let top: GroupStateRow["top"] = null;
    let otherRatio: number | null = null;
    if (n > 0) {
      // 같은 횟수면 더 센 단계를 먼저 (3 → 1 → 2: 보통은 맨 뒤)
      const order: (1 | 2 | 3)[] = [3, 1, 2];
      const level = order.reduce((best, lv) => (counts[lv - 1] > counts[best - 1] ? lv : best), order[0]!);
      top = { level, word: a.levels[level - 1]!, count: counts[level - 1], ratio: n >= STATE_RATIO_MIN ? Math.round((counts[level - 1] / n) * 100) / 100 : null };
      const offCounts = tally(off, a.key);
      const offN = offCounts[0] + offCounts[1] + offCounts[2];
      otherRatio = n >= STATE_RATIO_MIN && offN >= STATE_RATIO_MIN ? Math.round((offCounts[level - 1] / offN) * 100) / 100 : null;
    }
    return { group, axis: a.key, label: a.label, levels: a.levels, n, counts, top, otherRatio };
  });
}

// ---------- 있었던 일별 행복도 (2026-11-20 앱 주인: "있었던 일에 있는 거를 영역별 행복도처럼 계산해 줘", 명세 50) ----------
/** 평균을 말해도 되는 최소 날 수 */
export const STATE_HAPPY_MIN = 2;
export interface StateHappyRow {
  /** "pace:3", "tag:treat" 꼴 */
  key: string;
  /** 혼자 읽히는 말: "바쁨", "돈 많이 나감", "사 줬음" */
  label: string;
  axis: StateKey;
  /** 그 일을 고른 날 수 */
  n: number;
  /** 그날들의 행복도 평균(1~10, 소수 한 자리). n이 STATE_HAPPY_MIN 미만이면 null */
  avg: number | null;
}
/**
 * 있었던 일마다 그날의 내 행복도 평균. 축의 가운데 단계("보통", "평소만큼")는 빼고 양 끝 단계와 세부 낱말만 센다.
 * 한 번도 고르지 않은 것은 줄을 만들지 않는다. 평균 높은 순(평균을 못 내는 줄은 뒤, 그 안에서는 날 수 많은 순).
 */
export function stateHappiness(entries: (StateEntry & { happiness: number })[]): StateHappyRow[] {
  const acc = new Map<string, { label: string; axis: StateKey; s: number; n: number }>();
  const put = (key: string, label: string, axis: StateKey, h: number) => {
    const cur = acc.get(key) ?? { label, axis, s: 0, n: 0 };
    acc.set(key, { ...cur, s: cur.s + h, n: cur.n + 1 });
  };
  const tagAxis = new Map<string, StateKey>(STATE_AXES.flatMap((a) => a.tags.map((t) => [t.key, a.key] as [string, StateKey])));
  for (const e of entries) {
    if (!e.states) continue;
    for (const a of STATE_AXES) {
      const lv = e.states[a.key];
      if (typeof lv !== "number" || lv === 2) continue;
      put(`${a.key}:${lv}`, stateSay(a.key, lv), a.key, e.happiness);
    }
    for (const t of e.states.tags ?? []) {
      const axis = tagAxis.get(t);
      if (axis && STATE_TAG_LABEL[t]) put(`tag:${t}`, STATE_TAG_LABEL[t]!, axis, e.happiness);
    }
  }
  return [...acc.entries()]
    .map(([key, v]) => ({ key, label: v.label, axis: v.axis, n: v.n, avg: v.n >= STATE_HAPPY_MIN ? Math.round((v.s / v.n) * 10) / 10 : null }))
    .sort((a, b) => Number(b.avg !== null) - Number(a.avg !== null) || (b.avg ?? 0) - (a.avg ?? 0) || b.n - a.n || (a.key < b.key ? -1 : 1));
}
