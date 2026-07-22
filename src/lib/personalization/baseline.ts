/**
 * Phase 4 — 개인화 Ridge MVP: 정규화·기준선
 * 반감기 30일, lookback 60, std floor 0.5, z clamp ±2.5
 */
import type { BaselineStats, NormalizedSample, ScoreSample } from "./types";

export const HALF_LIFE_DAYS = 30;
export const MAX_LOOKBACK = 60;
export const STD_FLOOR = 0.5;
export const Z_CLAMP = 2.5;
export const FALLBACK_CENTER = 3;
export const MIN_SAMPLES_FULL_NORM = 14;

function daysBetween(a: string, b: string): number {
  const ms =
    Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Math.abs(ms) / (1000 * 60 * 60 * 24);
}

export function decayWeight(ageDays: number, halfLife = HALF_LIFE_DAYS): number {
  return Math.pow(0.5, ageDays / halfLife);
}

export function filterValidScores(scores: ScoreSample[]): ScoreSample[] {
  return scores.filter(
    (s) =>
      !s.isNotApplicable &&
      s.rawScore != null &&
      Number.isFinite(s.rawScore) &&
      s.rawScore >= 1 &&
      s.rawScore <= 5
  );
}

/** 최근 maxLookback개 (날짜 오름차순으로 반환) */
export function takeRecentValid(
  scores: ScoreSample[],
  asOfDate: string,
  maxLookback = MAX_LOOKBACK
): ScoreSample[] {
  const valid = filterValidScores(scores)
    .filter((s) => s.localDate <= asOfDate)
    .sort((a, b) => a.localDate.localeCompare(b.localDate));
  if (valid.length <= maxLookback) return valid;
  return valid.slice(valid.length - maxLookback);
}

export function detectLowVariance(scores: ScoreSample[]): boolean {
  const recent = [...scores]
    .sort((a, b) => b.localDate.localeCompare(a.localDate))
    .slice(0, 14);
  const distinct = new Set(recent.map((s) => s.rawScore));
  return distinct.size <= 2;
}

export function computeBaselineStats(
  scores: ScoreSample[],
  asOfDate: string
): BaselineStats {
  const recent = takeRecentValid(scores, asOfDate);
  const n = recent.length;
  if (n === 0) {
    return {
      weightedMean: FALLBACK_CENTER,
      mean: FALLBACK_CENTER,
      std: STD_FLOOR,
      validCount: 0,
      coverage30d: 0,
      lowVariance: true,
      halfLifeDays: HALF_LIFE_DAYS,
      maxLookback: MAX_LOOKBACK,
    };
  }

  let wSum = 0;
  let wx = 0;
  let sum = 0;
  for (const s of recent) {
    const w = decayWeight(daysBetween(s.localDate, asOfDate));
    wSum += w;
    wx += w * s.rawScore;
    sum += s.rawScore;
  }
  const weightedMean = wx / wSum;
  const mean = sum / n;
  let varAcc = 0;
  for (const s of recent) {
    const d = s.rawScore - mean;
    varAcc += d * d;
  }
  const std = Math.max(STD_FLOOR, Math.sqrt(varAcc / Math.max(n - 1, 1)));

  const cutoff = new Date(`${asOfDate}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  const from30 = cutoff.toISOString().slice(0, 10);
  const in30 = recent.filter((s) => s.localDate >= from30).length;
  const coverage30d = Math.min(1, in30 / 30);

  return {
    weightedMean,
    mean,
    std,
    validCount: n,
    coverage30d,
    lowVariance: detectLowVariance(recent),
    halfLifeDays: HALF_LIFE_DAYS,
    maxLookback: MAX_LOOKBACK,
  };
}

export function clampZ(z: number, limit = Z_CLAMP): number {
  return Math.max(-limit, Math.min(limit, z));
}

export function normalizeScores(
  scores: ScoreSample[],
  asOfDate: string
): { baseline: BaselineStats; samples: NormalizedSample[] } {
  const recent = takeRecentValid(scores, asOfDate);
  const baseline = computeBaselineStats(scores, asOfDate);
  const useFallback = recent.length < MIN_SAMPLES_FULL_NORM;

  const samples: NormalizedSample[] = recent.map((s) => {
    if (useFallback) {
      return {
        localDate: s.localDate,
        rawScore: s.rawScore,
        normalizedZ: clampZ(s.rawScore - FALLBACK_CENTER),
        usedFallbackCenter: true,
      };
    }
    return {
      localDate: s.localDate,
      rawScore: s.rawScore,
      normalizedZ: clampZ((s.rawScore - baseline.weightedMean) / baseline.std),
      usedFallbackCenter: false,
    };
  });

  return { baseline, samples };
}

/** baseline 예측 = 가중평균을 z 공간으로 (학습 타깃이 z일 때 0에 가깝게) */
export function baselinePredictionZ(baseline: BaselineStats): number {
  if (baseline.validCount < MIN_SAMPLES_FULL_NORM) {
    return clampZ(baseline.weightedMean - FALLBACK_CENTER);
  }
  return 0; // 가중평균으로 정규화했으므로 기준선 z ≈ 0
}
