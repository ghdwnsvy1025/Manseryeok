// ============================================================
// 천간·지지 기반 오행 분포율 계산
// 입력 순서: 시간 → 일 → 월 → 년
// ============================================================

import type { Element } from "./constants";
import type { SajuResult } from "./types";

export type ElementKo = "목" | "화" | "토" | "금" | "수";

export const ELEMENT_ORDER: readonly ElementKo[] = ["목", "화", "토", "금", "수"] as const;

export const ELEMENT_KO_TO_EN: Record<ElementKo, Element> = {
  목: "wood",
  화: "fire",
  토: "earth",
  금: "metal",
  수: "water",
};

export const ELEMENT_EN_TO_KO: Record<Element, ElementKo> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

export type ElementVector = Record<ElementKo, number>;

const stemToElement: Record<string, ElementKo> = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
};

/** 천간을 생해주는 오행 */
const generatingElement: Record<ElementKo, ElementKo> = {
  목: "수",
  화: "목",
  토: "화",
  금: "토",
  수: "금",
};

const JIJANGGAN_WEIGHTS = {
  residual: 0.2,
  middle: 0.3,
  main: 0.5,
} as const;

/** 지지별 지장간 (여기, 중기, 정기) */
const BRANCH_JIJANGGAN: Record<string, [string, string, string]> = {
  자: ["임", "계", "계"],
  축: ["계", "신", "기"],
  인: ["무", "병", "갑"],
  묘: ["갑", "을", "을"],
  진: ["을", "계", "무"],
  사: ["무", "경", "병"],
  오: ["병", "기", "정"],
  미: ["정", "을", "기"],
  신: ["무", "임", "경"],
  유: ["경", "신", "신"],
  술: ["신", "정", "무"],
  해: ["무", "갑", "임"],
};

export type ElementDistributionDetail = {
  branchBase: ElementVector[];
  branchWeighted: ElementVector[];
  branchTotal: ElementVector;
  stemScores: number[];
  stemTotal: ElementVector;
};

export type ElementDistributionResult = {
  raw: ElementVector;
  percentage: ElementVector;
  detail: ElementDistributionDetail;
};

function emptyVector(): ElementVector {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}

function addScaled(target: ElementVector, source: ElementVector, scale: number): void {
  for (const el of ELEMENT_ORDER) {
    target[el] += source[el] * scale;
  }
}

function sumVector(vectors: ElementVector[]): ElementVector {
  const total = emptyVector();
  for (const v of vectors) {
    addScaled(total, v, 1);
  }
  return total;
}

function vectorSum(v: ElementVector): number {
  return ELEMENT_ORDER.reduce((acc, el) => acc + v[el], 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 지지 하나의 기본 오행 분포 (합계 1) */
export function getBranchBaseDistribution(branch: string): ElementVector {
  const jijanggan = BRANCH_JIJANGGAN[branch];
  if (!jijanggan) {
    throw new Error(`Unknown branch: ${branch}`);
  }

  const [residual, middle, main] = jijanggan;
  const dist = emptyVector();

  const stems = [
    { stem: residual, weight: JIJANGGAN_WEIGHTS.residual },
    { stem: middle, weight: JIJANGGAN_WEIGHTS.middle },
    { stem: main, weight: JIJANGGAN_WEIGHTS.main },
  ];

  for (const { stem, weight } of stems) {
    const el = stemToElement[stem];
    if (!el) {
      throw new Error(`Unknown stem in jijanggan: ${stem}`);
    }
    dist[el] += weight;
  }

  return dist;
}

/** 천간이 지지 기본 분포에서 받는 도움 스칼라값 */
export function stemHelpValue(stemKo: string, branchDist: ElementVector): number {
  const stemEl = stemToElement[stemKo];
  if (!stemEl) {
    throw new Error(`Unknown stem: ${stemKo}`);
  }
  const genEl = generatingElement[stemEl];
  return branchDist[stemEl] * 1 + branchDist[genEl] * 0.5;
}

/** 지지 위치별 실제 가중합 벡터 */
export function computeBranchWeightedPosition(
  index: number,
  branchBases: ElementVector[]
): ElementVector {
  const result = emptyVector();
  addScaled(result, branchBases[index], 1);
  if (index - 1 >= 0) {
    addScaled(result, branchBases[index - 1], 0.2);
  }
  if (index + 1 < branchBases.length) {
    addScaled(result, branchBases[index + 1], 0.2);
  }
  return result;
}

/** 천간 위치별 실제 가중합 스칼라 (해당 천간 오행에 더함) */
export function computeStemPositionScore(
  stemKo: string,
  index: number,
  branchBases: ElementVector[]
): number {
  let total = 0;

  if (index < branchBases.length) {
    total += stemHelpValue(stemKo, branchBases[index]) * 1;
  }
  if (index - 1 >= 0) {
    total += stemHelpValue(stemKo, branchBases[index - 1]) * 0.2;
  }
  if (index + 1 < branchBases.length) {
    total += stemHelpValue(stemKo, branchBases[index + 1]) * 0.2;
  }

  return total;
}

/**
 * 천간·지지 문자열로 오행 분포율 계산
 * @param stems 시간→일→월→년 천간 (예: "신기병을")
 * @param branches 시간→일→월→년 지지 (예: "미축술해")
 */
export function calculateElementDistribution(
  stems: string,
  branches: string
): ElementDistributionResult {
  if (stems.length !== branches.length) {
    throw new Error("천간과 지지 길이가 일치해야 합니다.");
  }
  if (stems.length === 0) {
    throw new Error("천간과 지지가 비어 있습니다.");
  }

  const stemChars = Array.from(stems);
  const branchChars = Array.from(branches);

  const branchBase = branchChars.map((b) => getBranchBaseDistribution(b));
  const branchWeighted = branchBase.map((_, i) =>
    computeBranchWeightedPosition(i, branchBase)
  );
  const branchTotal = sumVector(branchWeighted);

  const stemScores = stemChars.map((s, i) =>
    computeStemPositionScore(s, i, branchBase)
  );

  const stemTotal = emptyVector();
  for (let i = 0; i < stemChars.length; i++) {
    const stemEl = stemToElement[stemChars[i]];
    if (!stemEl) {
      throw new Error(`Unknown stem: ${stemChars[i]}`);
    }
    stemTotal[stemEl] += stemScores[i];
  }

  const raw = emptyVector();
  addScaled(raw, branchTotal, 1);
  addScaled(raw, stemTotal, 1);

  const total = vectorSum(raw);
  const percentage = emptyVector();
  for (const el of ELEMENT_ORDER) {
    percentage[el] = total > 0 ? round2((raw[el] / total) * 100) : 0;
  }

  return {
    raw,
    percentage,
    detail: {
      branchBase,
      branchWeighted,
      branchTotal,
      stemScores,
      stemTotal,
    },
  };
}

/** SajuResult 기둥에서 오행 분포 계산 (시간→일→월→년 순) */
export function calculateElementDistributionFromPillars(
  pillars: SajuResult["pillars"]
): ElementDistributionResult | null {
  const order = ["hour", "day", "month", "year"] as const;
  let stems = "";
  let branches = "";

  for (const key of order) {
    const p = pillars[key];
    if (!p) continue;
    stems += p.stem.ko;
    branches += p.branch.ko;
  }

  if (stems.length === 0) return null;
  return calculateElementDistribution(stems, branches);
}
