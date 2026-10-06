// 내 기록으로 점수를 당긴다. 베이지안 수축: 기록이 적으면 사주 쪽, 많으면 기록 쪽.
//   w     = n / (n + K)
//   점수  = 사주 점수 × (1 − w) + 내 평균 행복도 × w
// n은 "오늘과 같은 일간 또는 같은 일지를 가진 날"의 기록 수. 60갑자가 완전히 같은 날은 따로 센다.
import type { PersonalAdjustment } from "./types";

/** 같은 성분 기록 K개면 사주와 기록이 반반 */
export const K_PERSONAL = 5;
/** 전체 기록 K개면 맞춤도 50% */
export const K_FIT = 20;

export interface EntryLike {
  day_ganji_index: number;
  day_stem: string;
  day_branch: string;
  happiness: number;
  /** 오늘의 작은 약속 (톤 v3.2). 컬럼 적용 전이거나 약속이 없던 날은 없음 */
  promise?: "kept" | "missed" | "na" | null;
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** 행복도 1~10 → 0~1 (5.5가 0.5) */
export function happinessToScore(h: number): number {
  return (h - 1) / 9;
}

export function adjustWithEntries(
  baseScore: number,
  entries: EntryLike[],
  today: { index: number; stemKo: string; branchKo: string },
): PersonalAdjustment {
  const matching = entries.filter((e) => e.day_stem === today.stemKo || e.day_branch === today.branchKo);
  const sameGanji = entries.filter((e) => e.day_ganji_index === today.index);
  const n = matching.length;
  const m = mean(matching.map((e) => e.happiness));
  const weight = n / (n + K_PERSONAL);
  const score = m === null ? baseScore : baseScore * (1 - weight) + happinessToScore(m) * weight;
  return {
    n,
    mean: m === null ? null : Math.round(m * 10) / 10,
    sameGanjiCount: sameGanji.length,
    sameGanjiMean: (() => {
      const g = mean(sameGanji.map((e) => e.happiness));
      return g === null ? null : Math.round(g * 10) / 10;
    })(),
    weight: Math.round(weight * 100) / 100,
    score,
  };
}

export function fitPercent(totalEntries: number): number {
  return Math.round((100 * totalEntries) / (totalEntries + K_FIT));
}

export function toTenPoint(score: number): number {
  return Math.round(score * 100) / 10;
}

export function bandOf(tenPoint: number): "좋음" | "무난" | "주의" {
  if (tenPoint >= 6.8) return "좋음";
  if (tenPoint >= 4.8) return "무난";
  return "주의";
}
