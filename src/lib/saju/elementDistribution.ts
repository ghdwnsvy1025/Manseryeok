// ============================================================
// 천간·지지 기반 오행 분포율 계산
// 입력 순서: 시간 → 일 → 월 → 년
// ============================================================

import { BRANCH_META, STEM_META, type Element } from "./constants";
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

/** 오행 상생 (A가 B를 생함) */
const generates: Record<ElementKo, ElementKo> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

/** 오행 상극 (A가 B를 극함) */
const controls: Record<ElementKo, ElementKo> = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
};

const JIJANGGAN_WEIGHTS = {
  residual: 0.2,
  middle: 0.3,
  main: 0.5,
} as const;

const SELF_BRANCH_WEIGHT = 1;
const ADJACENT_BRANCH_WEIGHT = 0.2;

const STEM_MIN_SCORE = 0.4;
const ADJACENT_SAME_STEM_MULTIPLIER = 1.25;

const BRANCH_BANGHAP_TWO_MULTIPLIER = 1.2;
const BRANCH_BANGHAP_THREE_MULTIPLIER = 1.4;

const DAEWOON_INFLUENCE_RATE = 0.25;
const ORIGINAL_INFLUENCE_RATE = 0.75;

const DAEWOON_GENERATED_MULTIPLIER = 1.25;
const DAEWOON_CONTROLLED_MULTIPLIER = 0.75;

const DAEWOON_SAME_STEM_MULTIPLIER = 1.2;
const DAEWOON_SAME_BRANCH_MULTIPLIER = 1.2;

const DAEWOON_BANGHAP_TWO_MULTIPLIER = 1.15;
const DAEWOON_BANGHAP_THREE_MULTIPLIER = 1.3;

const BANGHAP_GROUPS = [
  { name: "해자축", element: "수" as ElementKo, branches: ["해", "자", "축"] },
  { name: "인묘진", element: "목" as ElementKo, branches: ["인", "묘", "진"] },
  { name: "사오미", element: "화" as ElementKo, branches: ["사", "오", "미"] },
  { name: "신유술", element: "금" as ElementKo, branches: ["신", "유", "술"] },
] as const;

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

export type DaewoonGanjiRelation =
  | "same_element"
  | "stem_generates_branch"
  | "branch_generates_stem"
  | "stem_controls_branch"
  | "branch_controls_stem";

export type StemScoreDetail = {
  index: number;
  stem: string;
  element: ElementKo;
  rawScore: number;
  minAdjustedScore: number;
  adjacentSameStemMultiplier: number;
  finalScore: number;
};

export type BanghapGroupDetail = {
  name: string;
  element: ElementKo;
  matchedBranches: string[];
  multiplier: number;
};

export type BanghapDetail = {
  applied: boolean;
  groups: BanghapGroupDetail[];
  boostedBranches: { branch: string; multiplier: number }[];
};

export type DaewoonDetail = {
  applied: boolean;
  influenceRate: number;
  stem?: string;
  branch?: string;
  stemElement?: ElementKo;
  branchMainElement?: ElementKo;
  relation?: DaewoonGanjiRelation;
  stemGanjiMultiplier?: number;
  branchGanjiMultiplier?: number;
  stemSameCharWithOriginal?: boolean;
  stemSameCharMultiplier?: number;
  branchSameCharWithOriginal?: boolean;
  branchSameCharMultiplier?: number;
  branchBanghapWithOriginal?: boolean;
  branchBanghapMultiplier?: number;
  branchBanghapDetail?: BanghapGroupDetail | null;
  branchExternalMultiplier?: number;
  stemFinalMultiplier?: number;
  branchFinalMultiplier?: number;
  daewoonRaw?: ElementVector;
  daewoonPercentage?: ElementVector;
};

export type ElementDistributionDetail = {
  branchBase: ElementVector[];
  branchWeighted: ElementVector[];
  branchTotal: ElementVector;
  stemScores: StemScoreDetail[];
  stemTotal: ElementVector;
  banghap: BanghapDetail;
  daewoon: DaewoonDetail;
};

export type DaewoonInput = {
  stem: string;
  branch: string;
};

export type ElementDistributionResult = {
  originalRaw: ElementVector;
  originalPercentage: ElementVector;
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

function toPercentage(raw: ElementVector): ElementVector {
  const total = vectorSum(raw);
  const percentage = emptyVector();
  for (const el of ELEMENT_ORDER) {
    percentage[el] = total > 0 ? round2((raw[el] / total) * 100) : 0;
  }
  return percentage;
}

function blendPercentage(
  _originalPct: ElementVector,
  _daewoonPct: ElementVector,
  originalRaw: ElementVector,
  daewoonRaw: ElementVector
): ElementVector {
  const originalTotal = vectorSum(originalRaw);
  const daewoonTotal = vectorSum(daewoonRaw);
  const blended = emptyVector();

  for (const el of ELEMENT_ORDER) {
    const originalElPct =
      originalTotal > 0 ? (originalRaw[el] / originalTotal) * 100 : 0;
    const daewoonElPct =
      daewoonTotal > 0 ? (daewoonRaw[el] / daewoonTotal) * 100 : 0;
    blended[el] = round2(
      originalElPct * ORIGINAL_INFLUENCE_RATE + daewoonElPct * DAEWOON_INFLUENCE_RATE
    );
  }

  return blended;
}

function normalizeStemKo(stem: string): string {
  if (stemToElement[stem]) return stem;
  const ko = STEM_META[stem]?.ko;
  if (ko) return ko;
  throw new Error(`Unknown stem: ${stem}`);
}

function normalizeBranchKo(branch: string): string {
  if (BRANCH_JIJANGGAN[branch]) return branch;
  const ko = BRANCH_META[branch]?.ko;
  if (ko) return ko;
  throw new Error(`Unknown branch: ${branch}`);
}

function getStemElement(stem: string): ElementKo {
  const ko = normalizeStemKo(stem);
  return stemToElement[ko];
}

function getBranchMainElement(branch: string): ElementKo {
  const ko = normalizeBranchKo(branch);
  const jijanggan = BRANCH_JIJANGGAN[ko];
  if (!jijanggan) throw new Error(`Unknown branch: ${branch}`);
  return getStemElement(jijanggan[2]);
}

/** 지지 하나의 기본 오행 분포 (합계 1) */
export function getBranchBaseDistribution(branch: string): ElementVector {
  const ko = normalizeBranchKo(branch);
  const jijanggan = BRANCH_JIJANGGAN[ko];
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

function computeOriginalBanghap(branchChars: string[]): BanghapDetail {
  const uniqueBranches = Array.from(new Set(branchChars));
  const branchMultipliers: Record<string, number> = {};
  const groups: BanghapGroupDetail[] = [];

  for (const group of BANGHAP_GROUPS) {
    const matched = uniqueBranches.filter((b) =>
      (group.branches as readonly string[]).includes(b)
    );
    let multiplier = 1;
    if (matched.length === 2) multiplier = BRANCH_BANGHAP_TWO_MULTIPLIER;
    else if (matched.length >= 3) multiplier = BRANCH_BANGHAP_THREE_MULTIPLIER;

    if (multiplier > 1) {
      groups.push({
        name: group.name,
        element: group.element,
        matchedBranches: matched,
        multiplier,
      });
      for (const b of matched) {
        branchMultipliers[b] = multiplier;
      }
    }
  }

  const boostedBranches = Object.entries(branchMultipliers).map(([branch, multiplier]) => ({
    branch,
    multiplier,
  }));

  return {
    applied: groups.length > 0,
    groups,
    boostedBranches,
  };
}

function getBranchBanghapMultiplier(branch: string, banghap: BanghapDetail): number {
  const found = banghap.boostedBranches.find((b) => b.branch === branch);
  return found?.multiplier ?? 1;
}

/** 지지 위치별 실제 가중합 벡터 (방합 배수 적용) */
export function computeBranchWeightedPosition(
  index: number,
  branchChars: string[],
  branchBases: ElementVector[],
  banghap: BanghapDetail
): ElementVector {
  const result = emptyVector();

  const selfMult = getBranchBanghapMultiplier(branchChars[index], banghap);
  addScaled(result, branchBases[index], SELF_BRANCH_WEIGHT * selfMult);

  if (index - 1 >= 0) {
    const leftMult = getBranchBanghapMultiplier(branchChars[index - 1], banghap);
    addScaled(result, branchBases[index - 1], ADJACENT_BRANCH_WEIGHT * leftMult);
  }
  if (index + 1 < branchBases.length) {
    const rightMult = getBranchBanghapMultiplier(branchChars[index + 1], banghap);
    addScaled(result, branchBases[index + 1], ADJACENT_BRANCH_WEIGHT * rightMult);
  }

  return result;
}

/** 천간 위치별 raw 스칼라 (방합 미적용) */
export function computeStemRawScore(
  stemKo: string,
  index: number,
  branchBases: ElementVector[]
): number {
  let total = 0;

  if (index < branchBases.length) {
    total += stemHelpValue(stemKo, branchBases[index]) * SELF_BRANCH_WEIGHT;
  }
  if (index - 1 >= 0) {
    total += stemHelpValue(stemKo, branchBases[index - 1]) * ADJACENT_BRANCH_WEIGHT;
  }
  if (index + 1 < branchBases.length) {
    total += stemHelpValue(stemKo, branchBases[index + 1]) * ADJACENT_BRANCH_WEIGHT;
  }

  return total;
}

function getAdjacentSameStemMultipliers(stemChars: string[]): number[] {
  const multipliers = stemChars.map(() => 1);

  for (let i = 0; i < stemChars.length - 1; i++) {
    if (stemChars[i] === stemChars[i + 1]) {
      multipliers[i] = ADJACENT_SAME_STEM_MULTIPLIER;
      multipliers[i + 1] = ADJACENT_SAME_STEM_MULTIPLIER;
    }
  }

  return multipliers;
}

function computeStemScoreDetails(
  stemChars: string[],
  branchBases: ElementVector[]
): StemScoreDetail[] {
  const adjacentMultipliers = getAdjacentSameStemMultipliers(stemChars);

  return stemChars.map((stem, index) => {
    const element = getStemElement(stem);
    const rawScore = computeStemRawScore(stem, index, branchBases);
    const minAdjustedScore = Math.max(rawScore, STEM_MIN_SCORE);
    const adjacentSameStemMultiplier = adjacentMultipliers[index];
    const finalScore = minAdjustedScore * adjacentSameStemMultiplier;

    return {
      index,
      stem,
      element,
      rawScore,
      minAdjustedScore,
      adjacentSameStemMultiplier,
      finalScore,
    };
  });
}

function getDaewoonRelation(
  stemElement: ElementKo,
  branchMainElement: ElementKo
): {
  relation: DaewoonGanjiRelation;
  stemGanjiMultiplier: number;
  branchGanjiMultiplier: number;
} {
  if (stemElement === branchMainElement) {
    return {
      relation: "same_element",
      stemGanjiMultiplier: 1,
      branchGanjiMultiplier: 1,
    };
  }
  if (generates[stemElement] === branchMainElement) {
    return {
      relation: "stem_generates_branch",
      stemGanjiMultiplier: 1,
      branchGanjiMultiplier: DAEWOON_GENERATED_MULTIPLIER,
    };
  }
  if (generates[branchMainElement] === stemElement) {
    return {
      relation: "branch_generates_stem",
      stemGanjiMultiplier: DAEWOON_GENERATED_MULTIPLIER,
      branchGanjiMultiplier: 1,
    };
  }
  if (controls[stemElement] === branchMainElement) {
    return {
      relation: "stem_controls_branch",
      stemGanjiMultiplier: 1,
      branchGanjiMultiplier: DAEWOON_CONTROLLED_MULTIPLIER,
    };
  }
  if (controls[branchMainElement] === stemElement) {
    return {
      relation: "branch_controls_stem",
      stemGanjiMultiplier: DAEWOON_CONTROLLED_MULTIPLIER,
      branchGanjiMultiplier: 1,
    };
  }

  return {
    relation: "same_element",
    stemGanjiMultiplier: 1,
    branchGanjiMultiplier: 1,
  };
}

function getDaewoonBranchBanghap(
  daewoonBranch: string,
  originalBranches: string[]
): { multiplier: number; detail: BanghapGroupDetail | null } {
  const allBranches = [...originalBranches, daewoonBranch];
  const uniqueBranches = Array.from(new Set(allBranches));

  for (const group of BANGHAP_GROUPS) {
    if (!(group.branches as readonly string[]).includes(daewoonBranch)) continue;

    const matched = uniqueBranches.filter((b) =>
      (group.branches as readonly string[]).includes(b)
    );

    if (matched.length === 2) {
      return {
        multiplier: DAEWOON_BANGHAP_TWO_MULTIPLIER,
        detail: {
          name: group.name,
          element: group.element,
          matchedBranches: matched,
          multiplier: DAEWOON_BANGHAP_TWO_MULTIPLIER,
        },
      };
    }
    if (matched.length >= 3) {
      return {
        multiplier: DAEWOON_BANGHAP_THREE_MULTIPLIER,
        detail: {
          name: group.name,
          element: group.element,
          matchedBranches: matched,
          multiplier: DAEWOON_BANGHAP_THREE_MULTIPLIER,
        },
      };
    }
  }

  return { multiplier: 1, detail: null };
}

function computeDaewoonDistribution(
  daewoon: DaewoonInput,
  originalStems: string[],
  originalBranches: string[]
): { raw: ElementVector; detail: DaewoonDetail } {
  const stem = daewoon.stem;
  const branch = daewoon.branch;
  const stemElement = getStemElement(stem);
  const branchMainElement = getBranchMainElement(branch);

  const { relation, stemGanjiMultiplier, branchGanjiMultiplier } = getDaewoonRelation(
    stemElement,
    branchMainElement
  );

  const stemSameCharWithOriginal = originalStems.includes(stem);
  const stemSameCharMultiplier = stemSameCharWithOriginal
    ? DAEWOON_SAME_STEM_MULTIPLIER
    : 1;
  const stemFinalMultiplier = stemGanjiMultiplier * stemSameCharMultiplier;

  const branchSameCharWithOriginal = originalBranches.includes(branch);
  const branchSameCharMultiplier = branchSameCharWithOriginal
    ? DAEWOON_SAME_BRANCH_MULTIPLIER
    : 1;

  const { multiplier: branchBanghapMultiplier, detail: branchBanghapDetail } =
    getDaewoonBranchBanghap(branch, originalBranches);
  const branchBanghapWithOriginal = branchBanghapMultiplier > 1;

  const branchExternalMultiplier = Math.max(
    branchSameCharMultiplier,
    branchBanghapMultiplier
  );
  const branchFinalMultiplier = branchGanjiMultiplier * branchExternalMultiplier;

  const raw = emptyVector();
  raw[stemElement] += 1 * stemFinalMultiplier;

  const branchBase = getBranchBaseDistribution(branch);
  addScaled(raw, branchBase, branchFinalMultiplier);

  return {
    raw,
    detail: {
      applied: true,
      influenceRate: DAEWOON_INFLUENCE_RATE,
      stem,
      branch,
      stemElement,
      branchMainElement,
      relation,
      stemGanjiMultiplier,
      branchGanjiMultiplier,
      stemSameCharWithOriginal,
      stemSameCharMultiplier,
      branchSameCharWithOriginal,
      branchSameCharMultiplier,
      branchBanghapWithOriginal,
      branchBanghapMultiplier,
      branchBanghapDetail,
      branchExternalMultiplier,
      stemFinalMultiplier,
      branchFinalMultiplier,
      daewoonRaw: { ...raw },
    },
  };
}

function computeOriginalDistribution(
  stemChars: string[],
  branchChars: string[]
): {
  originalRaw: ElementVector;
  originalPercentage: ElementVector;
  detail: Omit<ElementDistributionDetail, "daewoon">;
} {
  const branchBase = branchChars.map((b) => getBranchBaseDistribution(b));
  const banghap = computeOriginalBanghap(branchChars);

  const branchWeighted = branchBase.map((_, i) =>
    computeBranchWeightedPosition(i, branchChars, branchBase, banghap)
  );
  const branchTotal = sumVector(branchWeighted);

  const stemScores = computeStemScoreDetails(stemChars, branchBase);
  const stemTotal = emptyVector();
  for (const score of stemScores) {
    stemTotal[score.element] += score.finalScore;
  }

  const originalRaw = emptyVector();
  addScaled(originalRaw, branchTotal, 1);
  addScaled(originalRaw, stemTotal, 1);

  return {
    originalRaw,
    originalPercentage: toPercentage(originalRaw),
    detail: {
      branchBase,
      branchWeighted,
      branchTotal,
      stemScores,
      stemTotal,
      banghap,
    },
  };
}

/**
 * 천간·지지 문자열로 오행 분포율 계산
 * @param stems 시간→일→월→년 천간 (예: "신기병을")
 * @param branches 시간→일→월→년 지지 (예: "미축술해")
 * @param daewoon 선택된 대운 간지 (천간·지지)
 */
export function calculateElementDistribution(
  stems: string,
  branches: string,
  daewoon?: DaewoonInput | null
): ElementDistributionResult {
  if (stems.length !== branches.length) {
    throw new Error("천간과 지지 길이가 일치해야 합니다.");
  }
  if (stems.length === 0) {
    throw new Error("천간과 지지가 비어 있습니다.");
  }

  const stemChars = Array.from(stems).map(normalizeStemKo);
  const branchChars = Array.from(branches).map(normalizeBranchKo);
  const normalizedDaewoon = daewoon
    ? {
        stem: normalizeStemKo(daewoon.stem),
        branch: normalizeBranchKo(daewoon.branch),
      }
    : null;

  const original = computeOriginalDistribution(stemChars, branchChars);

  if (!normalizedDaewoon) {
    return {
      originalRaw: original.originalRaw,
      originalPercentage: original.originalPercentage,
      raw: original.originalRaw,
      percentage: original.originalPercentage,
      detail: {
        ...original.detail,
        daewoon: {
          applied: false,
          influenceRate: 0,
        },
      },
    };
  }

  const daewoonResult = computeDaewoonDistribution(
    normalizedDaewoon,
    stemChars,
    branchChars
  );
  const daewoonPercentage = toPercentage(daewoonResult.raw);
  const finalPercentage = blendPercentage(
    original.originalPercentage,
    daewoonPercentage,
    original.originalRaw,
    daewoonResult.raw
  );

  return {
    originalRaw: original.originalRaw,
    originalPercentage: original.originalPercentage,
    raw: original.originalRaw,
    percentage: finalPercentage,
    detail: {
      ...original.detail,
      daewoon: {
        ...daewoonResult.detail,
        daewoonPercentage,
      },
    },
  };
}

/** SajuResult 기둥에서 오행 분포 계산 (시간→일→월→년 순) */
export function calculateElementDistributionFromPillars(
  pillars: SajuResult["pillars"],
  daewoon?: DaewoonInput | null
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
  return calculateElementDistribution(stems, branches, daewoon);
}
