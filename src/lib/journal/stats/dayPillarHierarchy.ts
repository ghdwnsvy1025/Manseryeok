/**
 * 일주(일간·일지·간지) 계층 통계 — 잔차 · 부분 풀링 · 축소
 *
 * 왜 필요한가
 * - d1Aggregates의 단순 평균은 표본이 2~3건인 간지도 60건인 간지와 동등하게 취급한다.
 *   60간지는 표본이 흩어질 수밖에 없어 우연한 고득점을 "이 날은 좋은 날"로 과대 주장하게 된다.
 *
 * 어떻게 푸는가
 * 1) 잔차화: 개인 기준선(카테고리 평균)을 빼서 사람 수준 효과를 제거한다.
 * 2) 계층 분해: 잔차 → 일간(10) 효과 → 남은 잔차에서 일지(12) 효과 → 남은 잔차에서 간지(60) 상호작용.
 *    간지 평균에 이미 포함된 일간·일지 효과를 중복 계산하지 않는다.
 * 3) 부분 풀링(경험적 베이즈): 각 그룹 평균을 전체 평균(0)으로 축소한다.
 *    λ_g = τ² / (τ² + σ²_within / n_g) — 표본이 적을수록 0에 가깝게 축소된다.
 */
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { assessRecall } from "@/lib/journal/recallConfidence";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

export const DAY_PILLAR_STATS_VERSION = "day-pillar-hierarchy-v1.0.0";

/** 이 관측 수 미만이면 어떤 일주 효과도 주장하지 않는다 */
export const MIN_TOTAL_OBSERVATIONS = 14;
/** 그룹을 "표시 가능"으로 볼 최소 표본 */
export const MIN_GROUP_OBSERVATIONS = 5;
/**
 * 이 축소계수 미만이면 신뢰할 수 없는 추정으로 본다.
 * 관측된 그룹 차이의 1/3 이상이 풀링 후에도 남아야 효과라고 부른다.
 */
export const MIN_RELIABLE_SHRINKAGE = 0.35;
/** 분산이 0에 수렴할 때의 하한 (0 나눗셈 방지) */
const VARIANCE_FLOOR = 1e-6;

export type PillarLevel = "stem" | "branch" | "ganji";

export type PillarEffect = {
  level: PillarLevel;
  /** 갑 / 자 / 갑자 */
  code: string;
  n: number;
  /** 축소 전 그룹 잔차 평균 */
  rawMean: number;
  /** 부분 풀링 후 효과 (점수 단위) */
  shrunkEffect: number;
  /** 축소계수 λ (1=원본 유지, 0=완전 축소) */
  shrinkage: number;
  reliable: boolean;
};

export type LevelSummary = {
  level: PillarLevel;
  groups: number;
  withinVariance: number;
  betweenVariance: number;
};

export type DayPillarHierarchy = {
  version: string;
  categoryCode: CategoryCode;
  /** 잔차 계산에 쓴 개인 기준선 */
  personalBaseline: number;
  totalObservations: number;
  /** 회상 지연이 커서 통계에서 제외한 기록 수 */
  excludedByRecall: number;
  /** 관측이 충분하지 않으면 false — 이때 모든 효과는 0 */
  sufficient: boolean;
  levels: LevelSummary[];
  effects: PillarEffect[];
};

export type DayPillarPrediction = {
  /** 기준선 + 계층 효과 합 */
  predicted: number;
  /** 계층 효과 합 (기준선 제외) */
  effect: number;
  contributions: Array<{ level: PillarLevel; code: string; value: number }>;
  /** 0~1 — 표본과 축소계수 기반 */
  confidence: number;
};

type Observation = { date: string; value: number };

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 표본분산 (n-1). 표본이 1개면 0. */
function sampleVariance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return nums.reduce((acc, x) => acc + (x - m) ** 2, 0) / (nums.length - 1);
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function pillarKeys(date: string): Record<PillarLevel, string> {
  const { dayPillar } = getPillarsForDate(date);
  return {
    stem: dayPillar.stem.ko,
    branch: dayPillar.branch.ko,
    ganji: dayPillar.ganjiKo,
  };
}

/**
 * 날짜별 최신 1건만 남기고 해당 카테고리 점수를 추출.
 * 회상 지연이 큰(몰아서 채워 넣은) 기록은 기억 왜곡이 섞이므로 제외한다.
 */
function collectObservations(
  entries: JournalEntry[],
  categoryCode: CategoryCode
): { observations: Observation[]; excludedByRecall: number } {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.entryDate, e);
  }

  const out: Observation[] = [];
  let excludedByRecall = 0;
  for (const entry of Array.from(byDate.values())) {
    const s = entry.scores.find((x) => x.categoryCode === categoryCode);
    if (!s || s.isNotApplicable || s.finalScore == null) continue;
    const recall = assessRecall(
      entry.entryDate,
      entry.firstRecordedAt ?? entry.createdAt
    );
    if (!recall.usableForStats) {
      excludedByRecall += 1;
      continue;
    }
    out.push({ date: entry.entryDate, value: s.finalScore });
  }
  return {
    observations: out.sort((a, b) => a.date.localeCompare(b.date)),
    excludedByRecall,
  };
}

/** SSW / (N - G) — 그룹 내 풀링 분산. 자유도를 정확히 쓴다. */
function pooledWithinVariance(
  groups: Map<string, number[]>,
  fallback: number[]
): number {
  let ssw = 0;
  let n = 0;
  const g = groups.size;
  for (const vals of Array.from(groups.values())) {
    const m = mean(vals);
    for (const v of vals) ssw += (v - m) ** 2;
    n += vals.length;
  }
  const df = n - g;
  if (df <= 0) return sampleVariance(fallback);
  return ssw / df;
}

/**
 * 경험적 베이즈 부분 풀링.
 *
 * τ²는 ANOVA 분산성분 추정량(Cochran)을 쓴다.
 *   τ̂² = max(0, (SSB - (G-1)·σ²_w) / (N - Σn_g²/N))
 * 그룹 평균의 단순 분산에서 σ²_w/n̄만 빼는 적률법은 그룹 크기가 불균형할 때
 * τ²를 과대추정해 순수 잡음에서도 효과가 남는다.
 */
function poolLevel(
  groups: Map<string, number[]>,
  withinVariance: number
): { betweenVariance: number; effects: Omit<PillarEffect, "level">[] } {
  const entries = Array.from(groups.entries());
  const G = entries.length;
  const N = entries.reduce((acc, [, vals]) => acc + vals.length, 0);
  const grandMean =
    N > 0
      ? entries.reduce((acc, [, vals]) => acc + vals.reduce((a, b) => a + b, 0), 0) / N
      : 0;

  const ssb = entries.reduce(
    (acc, [, vals]) => acc + vals.length * (mean(vals) - grandMean) ** 2,
    0
  );
  const sumNSquared = entries.reduce(
    (acc, [, vals]) => acc + vals.length ** 2,
    0
  );
  const effectiveN = N - sumNSquared / N;

  const betweenVariance =
    G < 2 || effectiveN <= VARIANCE_FLOOR
      ? 0
      : Math.max(0, (ssb - (G - 1) * withinVariance) / effectiveN);

  const effects = entries.map(([code, vals]) => {
    const n = vals.length;
    const rawMean = mean(vals);
    // τ²이 0이면 λ=0 → 그룹 차이를 전부 노이즈로 보고 완전히 축소
    const denom = betweenVariance + withinVariance / n;
    const shrinkage =
      denom <= VARIANCE_FLOOR ? 0 : betweenVariance / denom;
    const shrunkEffect = shrinkage * rawMean;
    return {
      code,
      n,
      rawMean: round4(rawMean),
      shrunkEffect: round4(shrunkEffect),
      shrinkage: round4(shrinkage),
      reliable:
        n >= MIN_GROUP_OBSERVATIONS && shrinkage >= MIN_RELIABLE_SHRINKAGE,
    };
  });

  return { betweenVariance: round4(betweenVariance), effects };
}

export function buildDayPillarHierarchy(
  entries: JournalEntry[],
  categoryCode: CategoryCode
): DayPillarHierarchy {
  const { observations: obs, excludedByRecall } = collectObservations(
    entries,
    categoryCode
  );
  const personalBaseline = round4(mean(obs.map((o) => o.value)));

  const empty: DayPillarHierarchy = {
    version: DAY_PILLAR_STATS_VERSION,
    categoryCode,
    personalBaseline,
    totalObservations: obs.length,
    excludedByRecall,
    sufficient: false,
    levels: [],
    effects: [],
  };
  if (obs.length < MIN_TOTAL_OBSERVATIONS) return empty;

  // 1) 잔차화 — 사람 수준 효과 제거
  const rows = obs.map((o) => ({
    keys: pillarKeys(o.date),
    residual: o.value - personalBaseline,
  }));

  const levels: LevelSummary[] = [];
  const effects: PillarEffect[] = [];
  const effectByLevel: Record<PillarLevel, Map<string, number>> = {
    stem: new Map(),
    branch: new Map(),
    ganji: new Map(),
  };

  // 2) 계층 순차 분해: 일간 → 일지 → 간지 상호작용
  let current = rows.map((r) => r.residual);
  const order: PillarLevel[] = ["stem", "branch", "ganji"];

  for (const level of order) {
    const groups = new Map<string, number[]>();
    rows.forEach((row, i) => {
      const key = row.keys[level];
      const list = groups.get(key);
      if (list) list.push(current[i]!);
      else groups.set(key, [current[i]!]);
    });

    // σ²_within = SSW / (N - G).
    // 자유도를 N-1로 잡으면 그룹이 많을수록(간지 60개) 잡음을 과소추정해
    // 순수 잡음에서도 τ²가 양수로 새어 나온다.
    const withinVariance = pooledWithinVariance(groups, current);

    const pooled = poolLevel(groups, withinVariance);
    levels.push({
      level,
      groups: groups.size,
      withinVariance: round4(withinVariance),
      betweenVariance: pooled.betweenVariance,
    });

    for (const e of pooled.effects) {
      effects.push({ level, ...e });
      effectByLevel[level].set(e.code, e.shrunkEffect);
    }

    // 3) 다음 계층은 이번 효과를 제거한 잔차에서 추정 (중복 계산 방지)
    current = rows.map(
      (row, i) =>
        current[i]! - (effectByLevel[level].get(row.keys[level]) ?? 0)
    );
  }

  return {
    version: DAY_PILLAR_STATS_VERSION,
    categoryCode,
    personalBaseline,
    totalObservations: obs.length,
    excludedByRecall,
    sufficient: true,
    levels,
    effects,
  };
}

export function predictDayPillarEffect(
  hierarchy: DayPillarHierarchy,
  date: string
): DayPillarPrediction {
  if (!hierarchy.sufficient) {
    return {
      predicted: hierarchy.personalBaseline,
      effect: 0,
      contributions: [],
      confidence: 0,
    };
  }

  const keys = pillarKeys(date);
  const contributions: DayPillarPrediction["contributions"] = [];
  const shrinkages: number[] = [];
  let effect = 0;

  for (const level of ["stem", "branch", "ganji"] as PillarLevel[]) {
    const hit = hierarchy.effects.find(
      (e) => e.level === level && e.code === keys[level]
    );
    if (!hit) continue;
    effect += hit.shrunkEffect;
    shrinkages.push(hit.shrinkage);
    contributions.push({ level, code: hit.code, value: hit.shrunkEffect });
  }

  // 표본이 많고 축소가 적을수록(=실제 신호일수록) 신뢰도가 높다
  const sampleTerm = Math.min(1, hierarchy.totalObservations / 90);
  const signalTerm = shrinkages.length > 0 ? mean(shrinkages) : 0;

  return {
    predicted: round4(hierarchy.personalBaseline + effect),
    effect: round4(effect),
    contributions,
    confidence: round4(Math.min(0.9, sampleTerm * 0.5 + signalTerm * 0.5)),
  };
}

/** 표시 가능한(신뢰 가능한) 효과만 강한 순으로 */
export function reliableEffects(
  hierarchy: DayPillarHierarchy,
  limit = 5
): PillarEffect[] {
  return hierarchy.effects
    .filter((e) => e.reliable && e.shrunkEffect !== 0)
    .sort((a, b) => Math.abs(b.shrunkEffect) - Math.abs(a.shrunkEffect))
    .slice(0, limit);
}
