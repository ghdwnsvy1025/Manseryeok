// 내 기록으로 점수를 조금 민다 (v4.19, 2026-10-31 GPT 검토 반영).
//   v4.18까지: 점수 = 사주 점수 × (1 − w) + 내 평균 행복도 × w — 행복도 "절대값"을 섞어서, 평소 행복도가 높은 사람은 모든 날이 올라가고
//   낮은 사람은 모든 날이 내려갔다(사주와 상관없는 그 사람의 기본 기분이 점수가 됐다).
//   v4.19: 전체 기록 평균 대비 "편차"만 쓴다.
//     편차  = (같은 성분 날 n개의 평균 행복도) − (전체 기록 평균 행복도)
//     w     = n / (n + K)
//     shift = clamp(w × 편차 / 9, −0.08, +0.08)   (±0.08 = 10점 눈금 ±0.8점)
//     점수  = 사주 점수 + shift
//   전체 기록이 10개 미만이거나 같은 성분 기록이 3개 미만이면 shift 0 — 비교 수치(n·mean·overallMean)만 남긴다.
// n은 "오늘과 같은 일간 또는 같은 일지를 가진 날"의 기록 수. 60갑자가 완전히 같은 날은 따로 센다.
import type { PersonalAdjustment } from "./types";

/** 같은 성분 기록 K개면 편차의 반을 반영 (w = n/(n+K)) */
export const K_PERSONAL = 5;
/** v4.19: 기록이 점수를 움직일 수 있는 최대 폭 (0~1 눈금. 0.08 = ±0.8점) */
export const SHIFT_MAX = 0.08;
/** v4.19: 전체 기록이 이만큼 안 되면 보정하지 않는다 (평균이 아직 그 사람의 평소를 말하지 못함) */
export const MIN_ENTRIES_FOR_SHIFT = 10;
/** v4.19: 같은 성분 기록이 이만큼 안 되면 보정하지 않는다 */
export const MIN_MATCHING_FOR_SHIFT = 3;
/** 전체 기록 K개면 맞춤도 50% */
export const K_FIT = 20;

export interface EntryLike {
  day_ganji_index: number;
  day_stem: string;
  day_branch: string;
  happiness: number;
  /** 오늘의 작은 약속 (톤 v3.2). 컬럼 적용 전이거나 약속이 없던 날은 없음 */
  promise?: "kept" | "missed" | "na" | null;
  /** 기록 날짜 (YYYY-MM-DD). 통계·공유에서 "가장 최근 기록"을 고를 때만 쓴다 */
  entry_date?: string;
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
  const overall = mean(entries.map((e) => e.happiness));
  const weight = n / (n + K_PERSONAL);
  const enough = entries.length >= MIN_ENTRIES_FOR_SHIFT && n >= MIN_MATCHING_FOR_SHIFT && m !== null && overall !== null;
  const rawShift = enough ? Math.max(-SHIFT_MAX, Math.min(SHIFT_MAX, (weight * (m! - overall!)) / 9)) : 0;
  const shift = Math.round(rawShift * 1000) / 1000 || 0;   // −0 → 0
  const score = Math.max(0, Math.min(1, baseScore + shift));
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
    shift,
    overallMean: overall === null ? null : Math.round(overall * 10) / 10,
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
