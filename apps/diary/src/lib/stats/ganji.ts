// 간지별 내 행복도. 기록을 60갑자 · 천간 · 지지 · 오행으로 묶어 평균을 낸다.
// 저장하지 않고 읽을 때 계산한다. 기록 수천 건이어도 즉시 끝난다.
import { BRANCHES, BRANCHES_KO, GANJI_60, STEMS, STEMS_KO, STEM_META, BRANCH_META } from "@saju/engine";
import type { EntryLike } from "../fortune/personal";

export type Signal = "없음" | "약함" | "보통" | "뚜렷함";

/** 기록 수 → 믿을 만한 정도. 숫자를 숨기지 않고 옆에 같이 보여 준다 */
export function signalOf(n: number): Signal {
  if (n <= 0) return "없음";
  if (n < 3) return "약함";
  if (n < 7) return "보통";
  return "뚜렷함";
}

export interface Bucket {
  key: string; // 한자 또는 오행 한글
  ko: string; // 읽는 이름
  n: number;
  mean: number | null;
  signal: Signal;
}

export interface GanjiCell extends Bucket {
  index: number; // 0~59
  hanja: string; // 甲子
}

const ELEMENT_KO: Record<string, string> = { wood: "목", fire: "화", earth: "토", metal: "금", water: "수" };
const ELEMENT_WORD: Record<string, string> = { 목: "나무", 화: "불", 토: "흙", 금: "쇠", 수: "물" };

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function bucketize<K extends string>(entries: EntryLike[], keyOf: (e: EntryLike) => K, keys: readonly K[], koOf: (k: K) => string): Bucket[] {
  const acc = new Map<K, number[]>();
  for (const e of entries) {
    const k = keyOf(e);
    const arr = acc.get(k) ?? [];
    arr.push(e.happiness);
    acc.set(k, arr);
  }
  return keys.map((k) => {
    const xs = acc.get(k) ?? [];
    const mean = xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
    return { key: k, ko: koOf(k), n: xs.length, mean, signal: signalOf(xs.length) };
  });
}

/** 60칸. 화면 격자 순서는 index 순 (甲子 → 癸亥) */
export function ganjiGrid(entries: EntryLike[]): GanjiCell[] {
  const buckets = bucketize(
    entries,
    (e) => String(e.day_ganji_index),
    GANJI_60.map((_, i) => String(i)),
    (k) => STEMS_KO[Number(k) % 10]! + BRANCHES_KO[Number(k) % 12]!,
  );
  return buckets.map((b) => ({ ...b, index: Number(b.key), hanja: GANJI_60[Number(b.key)]! }));
}

export function byStem(entries: EntryLike[]): Bucket[] {
  return bucketize(entries, (e) => e.day_stem, STEMS_KO, (k) => k);
}

export function byBranch(entries: EntryLike[]): Bucket[] {
  return bucketize(entries, (e) => e.day_branch, BRANCHES_KO, (k) => k);
}

/** 그날 천간의 오행 (목화토금수) */
export function stemElementKo(stemKo: string): string {
  const i = STEMS_KO.indexOf(stemKo as (typeof STEMS_KO)[number]);
  return i < 0 ? "?" : ELEMENT_KO[STEM_META[STEMS[i]!]!.element]!;
}

export function branchElementKo(branchKo: string): string {
  const i = BRANCHES_KO.indexOf(branchKo as (typeof BRANCHES_KO)[number]);
  return i < 0 ? "?" : ELEMENT_KO[BRANCH_META[BRANCHES[i]!]!.element]!;
}

export function byElement(entries: EntryLike[]): Bucket[] {
  return bucketize(entries, (e) => stemElementKo(e.day_stem), ["목", "화", "토", "금", "수"], (k) => `${ELEMENT_WORD[k]}(${k})`);
}

export interface Highlights {
  total: number;
  overallMean: number | null;
  /** n ≥ 2 인 60갑자 중 평균 최고/최저 */
  bestGanji: GanjiCell | null;
  worstGanji: GanjiCell | null;
  /** n ≥ 3 인 천간·지지 중 최고 */
  bestStem: Bucket | null;
  bestBranch: Bucket | null;
  /** 아직 한 번도 안 겪은 간지 수 */
  unseen: number;
}

function top(buckets: Bucket[], minN: number, dir: 1 | -1): Bucket | null {
  const ok = buckets.filter((b) => b.n >= minN && b.mean !== null);
  if (ok.length === 0) return null;
  return ok.reduce((best, b) => (dir * (b.mean! - best.mean!) > 0 ? b : best));
}

export function highlights(entries: EntryLike[]): Highlights {
  const grid = ganjiGrid(entries);
  const total = entries.length;
  const overallMean = total ? round1(entries.reduce((a, e) => a + e.happiness, 0) / total) : null;
  return {
    total,
    overallMean,
    bestGanji: top(grid, 2, 1) as GanjiCell | null,
    worstGanji: top(grid, 2, -1) as GanjiCell | null,
    bestStem: top(byStem(entries), 3, 1),
    bestBranch: top(byBranch(entries), 3, 1),
    unseen: grid.filter((c) => c.n === 0).length,
  };
}
