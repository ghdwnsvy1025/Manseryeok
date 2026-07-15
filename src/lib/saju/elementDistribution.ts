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

export const DAEWOON_INFLUENCE_RATE = 0.5;
export const ORIGINAL_INFLUENCE_RATE = 0.5;

/** 대운 percentage 내부: 자체 기운 vs 원국 기둥 작용 */
export const DAEWOON_SELF_RATE = 0.4;
export const DAEWOON_PILLAR_INTERACTION_RATE = 0.6;

/** 시→일→월→년 기둥별 대운 작용 가중치 (합=1, 균등) */
export const PILLAR_INFLUENCE_WEIGHTS = {
  time: 0.25,
  day: 0.25,
  month: 0.25,
  year: 0.25,
} as const;
export const PILLAR_WEIGHTS = [0.25, 0.25, 0.25, 0.25] as const;

export type DaewoonPillarKey = keyof typeof PILLAR_INFLUENCE_WEIGHTS;

/** 대운 천간 → 원국 천간 */
export const DAEWOON_TO_PILLAR_STEM_SAME_BONUS = 0.12;
export const DAEWOON_TO_PILLAR_STEM_GENERATE_BONUS = 0.18;
export const PILLAR_STEM_DRAINS_TO_DAEWOON_PENALTY = 0.08;
export const DAEWOON_TO_PILLAR_STEM_CONTROL_PENALTY = 0.18;
export const PILLAR_STEM_CONTROLS_DAEWOON_BONUS = 0.06;
export const DAEWOON_PILLAR_STEM_MULTIPLIER_MIN = 0.88;
export const DAEWOON_PILLAR_STEM_MULTIPLIER_MAX = 1.12;

/** 대운 지지 → 원국 지지 (지장간 분포) */
export const DAEWOON_BRANCH_SAME_ELEMENT_BONUS = 0.1;
export const DAEWOON_BRANCH_GENERATE_BONUS = 0.16;
export const NATIVE_BRANCH_DRAINS_TO_DAEWOON_PENALTY = 0.06;
export const DAEWOON_BRANCH_CONTROL_PENALTY = 0.16;
export const NATIVE_BRANCH_CONTROLS_DAEWOON_BONUS = 0.04;
export const DAEWOON_PILLAR_BRANCH_MULTIPLIER_MIN = 0.88;
export const DAEWOON_PILLAR_BRANCH_MULTIPLIER_MAX = 1.12;

const DAEWOON_GENERATED_MULTIPLIER = 1.25;
const DAEWOON_CONTROLLED_MULTIPLIER = 0.75;

const DAEWOON_SAME_STEM_MULTIPLIER = 1.2;
const DAEWOON_SAME_BRANCH_MULTIPLIER = 1.2;

const DAEWOON_BANGHAP_TWO_MULTIPLIER = 1.15;
const DAEWOON_BANGHAP_THREE_MULTIPLIER = 1.3;

/** 원국 천간끼리 / 지지끼리 생극 보정 */
export const PEER_GENERATE_BONUS = 0.08;
export const PEER_CONTROL_PENALTY = 0.1;
export const PEER_DISTANCE_FACTOR: Record<number, number> = {
  1: 1.0,
  2: 0.35,
  3: 0.15,
};
export const PEER_CONTIGUOUS_SAME_ELEMENT_FACTOR: Record<number, number> = {
  1: 1.0,
  2: 1.35,
  3: 1.6,
  4: 1.8,
};
export const PEER_MULTIPLIER_MIN = 0.72;
export const PEER_MULTIPLIER_MAX = 1.22;

/** 화수 특수 보정 (지장간 분포 기준) */
export const FIRE_WATER_PRESENCE_THRESHOLD = 0.15;
export const FIRE_WATER_RUN_BONUS = 0.2;
export const FIRE_WATER_BALANCE_THRESHOLD = 0.1;
export const FIRE_WATER_WATER_DOMINANT_FIRE_PENALTY = 0.4;
export const FIRE_WATER_WATER_DOMINANT_WATER_PENALTY = 0.15;
export const FIRE_WATER_FIRE_DOMINANT_FIRE_PENALTY = 0.15;
export const FIRE_WATER_FIRE_DOMINANT_WATER_PENALTY = 0.4;
export const FIRE_WATER_MULTIPLIER_MIN = 0.7;
export const FIRE_WATER_MULTIPLIER_MAX = 1;
export const FIRE_WATER_DISTANCE_FACTOR: Record<number, number> = {
  1: 1.0,
  2: 0.35,
  3: 0.15,
};
export const DAEWOON_FIRE_WATER_DISTANCE_FACTOR = 0.85;

/** 같은 기둥 천간-지지 화수 보정 */
export const GANJI_FIRE_STEM_WATER_BRANCH_STEM_MULT = 0.92;
export const GANJI_FIRE_STEM_WATER_BRANCH_WATER_MULT = 0.97;
export const GANJI_WATER_STEM_FIRE_BRANCH_STEM_MULT = 0.97;
export const GANJI_WATER_STEM_FIRE_BRANCH_FIRE_MULT = 0.92;

/** 토 지지(축·진·미·술) 지장간 오행 분포 보정 */
export const EARTH_BRANCH_ELEMENT_DISTRIBUTION: Record<string, ElementVector> = {
  축: { 목: 0, 화: 0, 토: 0.4, 금: 0.25, 수: 0.35 },
  진: { 목: 0.35, 화: 0, 토: 0.4, 금: 0, 수: 0.25 },
  미: { 목: 0.25, 화: 0.35, 토: 0.4, 금: 0, 수: 0 },
  술: { 목: 0, 화: 0.35, 토: 0.4, 금: 0.25, 수: 0 },
};

export const SAMHAP_FULL_MULTIPLIER = 1.35;
export const SAMHAP_PARTIAL_WITH_MIDDLE_MULTIPLIER = 1.18;
export const SAMHAP_PARTIAL_EDGE_ONLY_MULTIPLIER = 1.08;

/** 원국 삼합/반합 matchedBranches의 index span → 거리 보정 계수 */
export const SAMHAP_DISTANCE_FACTOR_BY_SPAN: Record<number, number> = {
  1: 1.0,
  2: 0.75,
  3: 0.55,
};

/** 대운↔원국 삼합/반합은 외부 작용으로 고정 거리 계수 사용 */
export const DAEWOON_SAMHAP_DISTANCE_FACTOR = 0.85;

export const YANG_STEM_STRENGTH_MULTIPLIER = 1.04;
export const YIN_STEM_STRENGTH_MULTIPLIER = 0.96;
export const YANG_BRANCH_STRENGTH_MULTIPLIER = 1.03;
export const YIN_BRANCH_STRENGTH_MULTIPLIER = 0.97;

export type StemPolarity = "yang" | "yin";
export type BranchPolarity = "yang" | "yin";

const STEM_POLARITY: Record<string, StemPolarity> = {
  갑: "yang",
  병: "yang",
  무: "yang",
  경: "yang",
  임: "yang",
  을: "yin",
  정: "yin",
  기: "yin",
  신: "yin",
  계: "yin",
};

const BRANCH_POLARITY: Record<string, BranchPolarity> = {
  자: "yang",
  축: "yin",
  인: "yang",
  묘: "yin",
  진: "yang",
  사: "yin",
  오: "yang",
  미: "yin",
  신: "yang",
  유: "yin",
  술: "yang",
  해: "yin",
};

/** 토 지지 보정 분포의 오행별 대표 지장간 (양/음 보정용) */
const EARTH_BRANCH_REPRESENTATIVE_STEM: Record<string, Partial<Record<ElementKo, string>>> = {
  축: { 수: "계", 금: "신", 토: "기" },
  진: { 목: "을", 수: "계", 토: "무" },
  미: { 목: "을", 화: "정", 토: "기" },
  술: { 화: "정", 금: "신", 토: "무" },
};

export function getStemPolarityMultiplier(stem: string): number {
  const ko = stemToElement[stem] ? stem : STEM_META[stem]?.ko;
  const polarity = ko ? STEM_POLARITY[ko] : undefined;
  return polarity === "yang" ? YANG_STEM_STRENGTH_MULTIPLIER : YIN_STEM_STRENGTH_MULTIPLIER;
}

export function getBranchPolarityMultiplier(branch: string): number {
  const ko = BRANCH_JIJANGGAN[branch] ? branch : BRANCH_META[branch]?.ko;
  const polarity = ko ? BRANCH_POLARITY[ko] : undefined;
  return polarity === "yang" ? YANG_BRANCH_STRENGTH_MULTIPLIER : YIN_BRANCH_STRENGTH_MULTIPLIER;
}

export function getStemPolarity(stem: string): StemPolarity {
  const ko = stemToElement[stem] ? stem : STEM_META[stem]?.ko;
  return (ko && STEM_POLARITY[ko]) || "yin";
}

export function getBranchPolarity(branch: string): BranchPolarity {
  const ko = BRANCH_JIJANGGAN[branch] ? branch : BRANCH_META[branch]?.ko;
  return (ko && BRANCH_POLARITY[ko]) || "yin";
}

function applyEffectiveSamhapMultiplier(
  baseMultiplier: number,
  distanceFactor: number
): number {
  return 1 + (baseMultiplier - 1) * distanceFactor;
}

function normalizeElementVector(dist: ElementVector): ElementVector {
  const total = vectorSum(dist);
  if (total <= 0) return emptyVector();
  const out = emptyVector();
  for (const el of ELEMENT_ORDER) {
    out[el] = dist[el] / total;
  }
  return out;
}

export const SAMHAP_GROUPS = [
  { name: "해묘미", element: "목" as ElementKo, branches: ["해", "묘", "미"], middle: "묘" },
  { name: "신자진", element: "수" as ElementKo, branches: ["신", "자", "진"], middle: "자" },
  { name: "인오술", element: "화" as ElementKo, branches: ["인", "오", "술"], middle: "오" },
  { name: "사유축", element: "금" as ElementKo, branches: ["사", "유", "축"], middle: "유" },
] as const;

export type SamhapMatchType = "full" | "partial_with_middle" | "partial_edge_only";

export type SamhapGroupDetail = {
  name: string;
  element: ElementKo;
  matchedBranches: string[];
  matchedIndexes: number[];
  span: number;
  distanceFactor: number;
  type: SamhapMatchType;
  baseMultiplier: number;
  multiplier: number;
};

export type SamhapDetail = {
  applied: boolean;
  groups: SamhapGroupDetail[];
  boostedBranches: { branch: string; element: ElementKo; multiplier: number }[];
};

export type EarthBranchAdjustmentDetail = {
  applied: boolean;
  adjustedBranches: { branch: string; distribution: ElementVector }[];
};

export type DaewoonSamhapDetail = {
  applied: boolean;
  groups: SamhapGroupDetail[];
  elementMultiplier: ElementVector;
};

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
  polarity: StemPolarity;
  rawScore: number;
  minAdjustedScore: number;
  adjacentSameStemMultiplier: number;
  stemPolarityMultiplier: number;
  stemPeerInteractionMultiplier: number;
  stemGanjiFireWaterMultiplier: number;
  finalScore: number;
};

export type PeerInteractionRelation =
  | "generated_by_source"
  | "controlled_by_source"
  | "none";

export type PeerInteractionEffectDetail = {
  sourceIndex: number;
  sourceChar: string;
  sourceElement: ElementKo;
  relation: PeerInteractionRelation;
  distance: number;
  distanceFactor: number;
  contiguousSameElementSize: number;
  contiguousFactor: number;
  delta: number;
};

export type PeerInteractionMultiplierDetail = {
  index: number;
  char: string;
  element: ElementKo;
  rawMultiplier: number;
  multiplier: number;
  effects: PeerInteractionEffectDetail[];
};

/** 천간 peer 생극 detail (대표 오행 기준) */
export type PeerInteractionDetail = {
  applied: boolean;
  elements: ElementKo[];
  multipliers: Array<{
    index: number;
    stem?: string;
    branch?: string;
    element: ElementKo;
    rawMultiplier: number;
    multiplier: number;
    effects: Array<{
      sourceIndex: number;
      sourceStem?: string;
      sourceBranch?: string;
      sourceElement: ElementKo;
      relation: PeerInteractionRelation;
      distance: number;
      distanceFactor: number;
      contiguousSameElementSize: number;
      contiguousFactor: number;
      delta: number;
    }>;
  }>;
};

/** 지지 peer 생극 detail (지장간 분포 기준) */
export type BranchPeerInteractionDetail = {
  applied: boolean;
  mode: "hidden_stem_distribution";
  multipliers: Array<{
    index: number;
    branch: string;
    baseDistribution: ElementVector;
    elementMultiplier: ElementVector;
  }>;
};

export type FireWaterDominant = "water" | "fire" | "balanced";

export type FireWaterBranchMultiplierDetail = {
  index: number;
  branch: string;
  baseFire: number;
  baseWater: number;
  fireMultiplier: number;
  waterMultiplier: number;
  elementMultiplier: ElementVector;
};

export type FireWaterBranchDetail = {
  applied: boolean;
  mode: "hidden_stem_distribution";
  fireAmounts: number[];
  waterAmounts: number[];
  fireTotal: number;
  waterTotal: number;
  fireScore: number;
  waterScore: number;
  dominant: FireWaterDominant;
  multipliers: FireWaterBranchMultiplierDetail[];
};

export type FireWaterGanjiDetail = {
  index: number;
  stem: string;
  stemElement: ElementKo;
  branch: string;
  branchDistribution: ElementVector;
  stemGanjiFireWaterMultiplier: number;
  branchGanjiFireWaterElementMultiplier: ElementVector;
};

export type FireWaterExtremeDetail = {
  branch: FireWaterBranchDetail;
  ganji: FireWaterGanjiDetail[];
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

export type BranchContributionDetail = {
  sourceIndex: number;
  sourceBranch: string;
  sourceBranchPolarity: BranchPolarity;
  branchPolarityMultiplier: number;
  branchPeerElementMultiplier: ElementVector;
  branchFireWaterElementMultiplier: ElementVector;
  branchGanjiFireWaterElementMultiplier: ElementVector;
  positionWeight: number;
  banghapMultiplier: number;
  samhapElementMultiplier: ElementVector;
};

export type BranchWeightedPositionDetail = {
  positionIndex: number;
  contributions: BranchContributionDetail[];
  weighted: ElementVector;
};

export type DaewoonToPillarStemRelation =
  | "same_element"
  | "daewoon_generates_native"
  | "native_generates_daewoon"
  | "daewoon_controls_native"
  | "native_controls_daewoon"
  | "none";

export type DaewoonPillarBranchElementStrengths = {
  sameStrength: number;
  generatedByDaewoonStrength: number;
  controlledByDaewoonStrength: number;
  nativeDrainsToDaewoonStrength: number;
  nativeControlsDaewoonStrength: number;
};

export type DaewoonPillarInteractionByPillar = {
  index: number;
  pillar: DaewoonPillarKey;
  pillarWeight: number;
  nativeStem: string;
  nativeStemElement: ElementKo;
  nativeStemBaseScore: number;
  stemRelation: DaewoonToPillarStemRelation;
  stemMultiplier: number;
  adjustedStemScore: number;
  nativeBranch: string;
  nativeBranchBaseContribution: ElementVector;
  branchElementStrengths: Record<ElementKo, DaewoonPillarBranchElementStrengths>;
  branchElementMultipliers: ElementVector;
  adjustedBranchContribution: ElementVector;
};

export type DaewoonPillarInteractionDetail = {
  applied: boolean;
  pillarWeights: typeof PILLAR_INFLUENCE_WEIGHTS;
  byPillar: DaewoonPillarInteractionByPillar[];
  raw: ElementVector;
  percentage: ElementVector;
};

export type DaewoonDetail = {
  applied: boolean;
  influenceRate: number;
  selfRate?: number;
  pillarInteractionRate?: number;
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
  stemPolarity?: StemPolarity;
  stemPolarityMultiplier?: number;
  branchPolarity?: BranchPolarity;
  branchPolarityMultiplier?: number;
  branchSamhapDetail?: DaewoonSamhapDetail;
  stemFireWaterExtraMultiplier?: number;
  branchFireWaterElementMultiplier?: ElementVector;
  branchBaseDistribution?: ElementVector;
  /** @deprecated daewoonSelfRaw 사용 */
  daewoonRaw?: ElementVector;
  daewoonSelfRaw?: ElementVector;
  daewoonSelfPercentage?: ElementVector;
  pillarInteraction?: DaewoonPillarInteractionDetail;
  daewoonPercentage?: ElementVector;
};

export type ElementDistributionDetail = {
  branchBase: ElementVector[];
  branchWeighted: ElementVector[];
  branchWeightedDetail: BranchWeightedPositionDetail[];
  branchTotal: ElementVector;
  stemScores: StemScoreDetail[];
  stemTotal: ElementVector;
  banghap: BanghapDetail;
  earthBranchAdjustment: EarthBranchAdjustmentDetail;
  samhap: SamhapDetail;
  branchPeerInteraction: BranchPeerInteractionDetail;
  stemPeerInteraction: PeerInteractionDetail;
  fireWaterExtreme: FireWaterExtremeDetail;
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

function blendOriginalAndDaewoonPercentage(
  originalPct: ElementVector,
  daewoonPct: ElementVector
): ElementVector {
  const blended = emptyVector();
  for (const el of ELEMENT_ORDER) {
    blended[el] = round2(
      originalPct[el] * ORIGINAL_INFLUENCE_RATE +
        daewoonPct[el] * DAEWOON_INFLUENCE_RATE
    );
  }
  return blended;
}

function percentageToRaw(percentage: ElementVector, originalSum: number): ElementVector {
  const raw = emptyVector();
  for (const el of ELEMENT_ORDER) {
    raw[el] = (percentage[el] / 100) * originalSum;
  }
  return raw;
}

function resolvePillarSlots(count: number): { key: DaewoonPillarKey; weight: number }[] {
  const all: { key: DaewoonPillarKey; weight: number }[] = [
    { key: "time", weight: PILLAR_INFLUENCE_WEIGHTS.time },
    { key: "day", weight: PILLAR_INFLUENCE_WEIGHTS.day },
    { key: "month", weight: PILLAR_INFLUENCE_WEIGHTS.month },
    { key: "year", weight: PILLAR_INFLUENCE_WEIGHTS.year },
  ];
  const selected = count >= 4 ? all : all.slice(Math.max(0, 4 - count));
  const sum = selected.reduce((acc, s) => acc + s.weight, 0);
  return selected.map((s) => ({
    key: s.key,
    weight: sum > 0 ? s.weight / sum : 0,
  }));
}

function getDaewoonToPillarStemRelation(
  daewoonStemElement: ElementKo,
  nativeStemElement: ElementKo
): DaewoonToPillarStemRelation {
  if (daewoonStemElement === nativeStemElement) return "same_element";
  if (generates[daewoonStemElement] === nativeStemElement) return "daewoon_generates_native";
  if (generates[nativeStemElement] === daewoonStemElement) return "native_generates_daewoon";
  if (controls[daewoonStemElement] === nativeStemElement) return "daewoon_controls_native";
  if (controls[nativeStemElement] === daewoonStemElement) return "native_controls_daewoon";
  return "none";
}

function computeDaewoonToPillarStemMultiplier(
  daewoonStemElement: ElementKo,
  nativeStemElement: ElementKo,
  pillarWeight: number
): { relation: DaewoonToPillarStemRelation; multiplier: number } {
  const relation = getDaewoonToPillarStemRelation(daewoonStemElement, nativeStemElement);
  let delta = 0;

  if (daewoonStemElement === nativeStemElement) {
    delta += DAEWOON_TO_PILLAR_STEM_SAME_BONUS * pillarWeight;
  }
  if (generates[daewoonStemElement] === nativeStemElement) {
    delta += DAEWOON_TO_PILLAR_STEM_GENERATE_BONUS * pillarWeight;
  }
  if (generates[nativeStemElement] === daewoonStemElement) {
    delta -= PILLAR_STEM_DRAINS_TO_DAEWOON_PENALTY * pillarWeight;
  }
  if (controls[daewoonStemElement] === nativeStemElement) {
    delta -= DAEWOON_TO_PILLAR_STEM_CONTROL_PENALTY * pillarWeight;
  }
  if (controls[nativeStemElement] === daewoonStemElement) {
    delta += PILLAR_STEM_CONTROLS_DAEWOON_BONUS * pillarWeight;
  }

  const multiplier = clamp(
    1 + delta,
    DAEWOON_PILLAR_STEM_MULTIPLIER_MIN,
    DAEWOON_PILLAR_STEM_MULTIPLIER_MAX
  );

  return { relation, multiplier };
}

function computeDaewoonBranchElementStrengths(
  daewoonBranchBase: ElementVector,
  targetElement: ElementKo
): DaewoonPillarBranchElementStrengths {
  let generatedByDaewoonStrength = 0;
  let controlledByDaewoonStrength = 0;
  let nativeDrainsToDaewoonStrength = 0;
  let nativeControlsDaewoonStrength = 0;

  for (const sourceElement of ELEMENT_ORDER) {
    const strength = daewoonBranchBase[sourceElement];
    if (strength <= 0) continue;
    if (elementGenerates(sourceElement, targetElement)) {
      generatedByDaewoonStrength += strength;
    }
    if (elementControls(sourceElement, targetElement)) {
      controlledByDaewoonStrength += strength;
    }
    if (elementGenerates(targetElement, sourceElement)) {
      nativeDrainsToDaewoonStrength += strength;
    }
    if (elementControls(targetElement, sourceElement)) {
      nativeControlsDaewoonStrength += strength;
    }
  }

  return {
    sameStrength: daewoonBranchBase[targetElement],
    generatedByDaewoonStrength,
    controlledByDaewoonStrength,
    nativeDrainsToDaewoonStrength,
    nativeControlsDaewoonStrength,
  };
}

function computeDaewoonToPillarBranchElementMultiplier(
  daewoonBranchBase: ElementVector,
  targetElement: ElementKo,
  pillarWeight: number
): { strengths: DaewoonPillarBranchElementStrengths; multiplier: number } {
  const strengths = computeDaewoonBranchElementStrengths(daewoonBranchBase, targetElement);
  const delta =
    pillarWeight *
    (strengths.sameStrength * DAEWOON_BRANCH_SAME_ELEMENT_BONUS +
      strengths.generatedByDaewoonStrength * DAEWOON_BRANCH_GENERATE_BONUS -
      strengths.nativeDrainsToDaewoonStrength * NATIVE_BRANCH_DRAINS_TO_DAEWOON_PENALTY -
      strengths.controlledByDaewoonStrength * DAEWOON_BRANCH_CONTROL_PENALTY +
      strengths.nativeControlsDaewoonStrength * NATIVE_BRANCH_CONTROLS_DAEWOON_BONUS);

  const multiplier = clamp(
    1 + delta,
    DAEWOON_PILLAR_BRANCH_MULTIPLIER_MIN,
    DAEWOON_PILLAR_BRANCH_MULTIPLIER_MAX
  );

  return { strengths, multiplier };
}

export function computeDaewoonPillarInteraction(
  daewoonStem: string,
  daewoonBranch: string,
  stemChars: string[],
  branchChars: string[],
  stemScores: StemScoreDetail[],
  branchWeighted: ElementVector[],
  originalPercentage: ElementVector
): DaewoonPillarInteractionDetail {
  const daewoonStemElement = getStemElement(daewoonStem);
  const daewoonBranchBase = getBranchBaseDistribution(daewoonBranch);
  const slots = resolvePillarSlots(stemChars.length);
  const total = emptyVector();
  const byPillar: DaewoonPillarInteractionByPillar[] = [];

  for (let i = 0; i < stemChars.length; i++) {
    const slot = slots[i] ?? { key: "day" as DaewoonPillarKey, weight: 0 };
    const pillarWeight = slot.weight;

    const nativeStem = stemChars[i];
    const nativeStemElement = getStemElement(nativeStem);
    const nativeStemBaseScore = stemScores[i]?.finalScore ?? 0;
    const { relation: stemRelation, multiplier: stemMultiplier } =
      computeDaewoonToPillarStemMultiplier(
        daewoonStemElement,
        nativeStemElement,
        pillarWeight
      );
    const adjustedStemScore = nativeStemBaseScore * stemMultiplier;
    total[nativeStemElement] += adjustedStemScore;

    const nativeBranch = branchChars[i];
    const nativeBranchBaseContribution = { ...(branchWeighted[i] ?? emptyVector()) };
    const branchElementMultipliers = emptyVectorOnes();
    const branchElementStrengths = {} as Record<
      ElementKo,
      DaewoonPillarBranchElementStrengths
    >;
    const adjustedBranchContribution = emptyVector();

    for (const el of ELEMENT_ORDER) {
      const { strengths, multiplier } = computeDaewoonToPillarBranchElementMultiplier(
        daewoonBranchBase,
        el,
        pillarWeight
      );
      branchElementStrengths[el] = strengths;
      branchElementMultipliers[el] = multiplier;
      adjustedBranchContribution[el] = nativeBranchBaseContribution[el] * multiplier;
      total[el] += adjustedBranchContribution[el];
    }

    byPillar.push({
      index: i,
      pillar: slot.key,
      pillarWeight,
      nativeStem,
      nativeStemElement,
      nativeStemBaseScore,
      stemRelation,
      stemMultiplier,
      adjustedStemScore,
      nativeBranch,
      nativeBranchBaseContribution,
      branchElementStrengths,
      branchElementMultipliers,
      adjustedBranchContribution,
    });
  }

  const sum = vectorSum(total);
  const percentage =
    sum > 0 ? toPercentage(total) : { ...originalPercentage };

  return {
    applied: true,
    pillarWeights: { ...PILLAR_INFLUENCE_WEIGHTS },
    byPillar,
    raw: total,
    percentage,
  };
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function elementGenerates(from: ElementKo, to: ElementKo): boolean {
  return generates[from] === to;
}

function elementControls(from: ElementKo, to: ElementKo): boolean {
  return controls[from] === to;
}

/** source index 기준 같은 오행 연속 그룹 크기 */
export function getContiguousSameElementGroupSize(
  elements: ElementKo[],
  index: number
): number {
  const element = elements[index];
  let size = 1;

  let left = index - 1;
  while (left >= 0 && elements[left] === element) {
    size++;
    left--;
  }

  let right = index + 1;
  while (right < elements.length && elements[right] === element) {
    size++;
    right++;
  }

  return size;
}

export type PeerInteractionMultiplierResult = {
  index: number;
  element: ElementKo;
  rawMultiplier: number;
  multiplier: number;
  effects: Array<{
    sourceIndex: number;
    sourceElement: ElementKo;
    relation: PeerInteractionRelation;
    distance: number;
    distanceFactor: number;
    contiguousSameElementSize: number;
    contiguousFactor: number;
    delta: number;
  }>;
};

/** 원국 동일 층위(천간끼리/지지끼리) 생극 multiplier */
export function getPeerInteractionMultipliers(
  elements: ElementKo[]
): PeerInteractionMultiplierResult[] {
  const multipliers: PeerInteractionMultiplierResult[] = [];

  for (let targetIndex = 0; targetIndex < elements.length; targetIndex++) {
    const targetElement = elements[targetIndex];
    let delta = 0;
    const effects: PeerInteractionMultiplierResult["effects"] = [];

    for (let sourceIndex = 0; sourceIndex < elements.length; sourceIndex++) {
      if (sourceIndex === targetIndex) continue;

      const sourceElement = elements[sourceIndex];
      const distance = Math.abs(sourceIndex - targetIndex);
      const distanceFactor = PEER_DISTANCE_FACTOR[distance] ?? 0;
      if (distanceFactor === 0) continue;

      const contiguousSameElementSize = getContiguousSameElementGroupSize(
        elements,
        sourceIndex
      );
      const contiguousFactor =
        PEER_CONTIGUOUS_SAME_ELEMENT_FACTOR[contiguousSameElementSize] ?? 1.8;

      if (elementGenerates(sourceElement, targetElement)) {
        const effectDelta =
          PEER_GENERATE_BONUS * distanceFactor * contiguousFactor;
        delta += effectDelta;
        effects.push({
          sourceIndex,
          sourceElement,
          relation: "generated_by_source",
          distance,
          distanceFactor,
          contiguousSameElementSize,
          contiguousFactor,
          delta: effectDelta,
        });
      }

      if (elementControls(sourceElement, targetElement)) {
        const effectDelta =
          -(PEER_CONTROL_PENALTY * distanceFactor * contiguousFactor);
        delta += effectDelta;
        effects.push({
          sourceIndex,
          sourceElement,
          relation: "controlled_by_source",
          distance,
          distanceFactor,
          contiguousSameElementSize,
          contiguousFactor,
          delta: effectDelta,
        });
      }
    }

    const rawMultiplier = 1 + delta;
    const multiplier = clamp(rawMultiplier, PEER_MULTIPLIER_MIN, PEER_MULTIPLIER_MAX);

    multipliers[targetIndex] = {
      index: targetIndex,
      element: targetElement,
      rawMultiplier,
      multiplier,
      effects,
    };
  }

  return multipliers;
}

function buildStemPeerInteractionDetail(
  stemChars: string[],
  peerResults: PeerInteractionMultiplierResult[]
): PeerInteractionDetail {
  return {
    applied: true,
    elements: peerResults.map((p) => p.element),
    multipliers: peerResults.map((p) => ({
      index: p.index,
      stem: stemChars[p.index],
      element: p.element,
      rawMultiplier: p.rawMultiplier,
      multiplier: p.multiplier,
      effects: p.effects.map((e) => ({
        sourceIndex: e.sourceIndex,
        sourceStem: stemChars[e.sourceIndex],
        sourceElement: e.sourceElement,
        relation: e.relation,
        distance: e.distance,
        distanceFactor: e.distanceFactor,
        contiguousSameElementSize: e.contiguousSameElementSize,
        contiguousFactor: e.contiguousFactor,
        delta: e.delta,
      })),
    })),
  };
}

/** source index 기준 특정 오행 성분이 연속으로 존재하는 그룹 크기 */
export function getContiguousElementPresenceGroupSize(
  bases: ElementVector[],
  index: number,
  element: ElementKo,
  threshold = 0
): number {
  if (bases[index][element] <= threshold) return 0;

  let size = 1;
  let left = index - 1;
  while (left >= 0 && bases[left][element] > threshold) {
    size++;
    left--;
  }
  let right = index + 1;
  while (right < bases.length && bases[right][element] > threshold) {
    size++;
    right++;
  }
  return size;
}

function maxContiguousRun(present: boolean[]): number {
  let maxRun = 0;
  let current = 0;
  for (const p of present) {
    if (p) {
      current++;
      maxRun = Math.max(maxRun, current);
    } else {
      current = 0;
    }
  }
  return maxRun;
}

/** 지지 peer 생극 — 지장간 분포 벡터 기준, 오행별 multiplier */
export function getBranchPeerElementMultipliers(
  bases: ElementVector[]
): ElementVector[] {
  return bases.map((_, targetIndex) => {
    const elementMultiplier = emptyVectorOnes();

    for (const targetElement of ELEMENT_ORDER) {
      let delta = 0;

      for (let sourceIndex = 0; sourceIndex < bases.length; sourceIndex++) {
        if (sourceIndex === targetIndex) continue;

        const distance = Math.abs(sourceIndex - targetIndex);
        const distanceFactor = PEER_DISTANCE_FACTOR[distance] ?? 0;
        if (distanceFactor === 0) continue;

        for (const sourceElement of ELEMENT_ORDER) {
          const sourceStrength = bases[sourceIndex][sourceElement];
          if (sourceStrength <= 0) continue;

          const contiguousSameElementSize = getContiguousElementPresenceGroupSize(
            bases,
            sourceIndex,
            sourceElement
          );
          const contiguousFactor =
            PEER_CONTIGUOUS_SAME_ELEMENT_FACTOR[contiguousSameElementSize] ?? 1.8;

          if (elementGenerates(sourceElement, targetElement)) {
            delta +=
              PEER_GENERATE_BONUS *
              sourceStrength *
              distanceFactor *
              contiguousFactor;
          }
          if (elementControls(sourceElement, targetElement)) {
            delta -=
              PEER_CONTROL_PENALTY *
              sourceStrength *
              distanceFactor *
              contiguousFactor;
          }
        }
      }

      elementMultiplier[targetElement] = clamp(
        1 + delta,
        PEER_MULTIPLIER_MIN,
        PEER_MULTIPLIER_MAX
      );
    }

    return elementMultiplier;
  });
}

function buildBranchPeerInteractionDetail(
  branchChars: string[],
  bases: ElementVector[],
  elementMultipliers: ElementVector[]
): BranchPeerInteractionDetail {
  return {
    applied: true,
    mode: "hidden_stem_distribution",
    multipliers: branchChars.map((branch, index) => ({
      index,
      branch,
      baseDistribution: { ...bases[index] },
      elementMultiplier: { ...elementMultipliers[index] },
    })),
  };
}

function computeContactFactor(
  bases: ElementVector[],
  index: number,
  opposingElement: ElementKo
): number {
  let maxFactor = 0;
  for (let j = 0; j < bases.length; j++) {
    if (j === index) continue;
    const distance = Math.abs(j - index);
    const distanceFactor = FIRE_WATER_DISTANCE_FACTOR[distance] ?? 0;
    if (distanceFactor === 0) continue;
    maxFactor = Math.max(maxFactor, bases[j][opposingElement] * distanceFactor);
  }
  return maxFactor;
}

/** 연속 같은 오행 성분 그룹에 그룹 max contactFactor 공유 */
function shareContactAcrossContiguousGroups(
  bases: ElementVector[],
  factors: number[],
  element: ElementKo
): number[] {
  const shared = [...factors];
  let i = 0;
  while (i < bases.length) {
    if (bases[i][element] < FIRE_WATER_PRESENCE_THRESHOLD) {
      i++;
      continue;
    }
    let j = i;
    let groupMax = factors[i];
    while (
      j + 1 < bases.length &&
      bases[j + 1][element] >= FIRE_WATER_PRESENCE_THRESHOLD
    ) {
      j++;
      groupMax = Math.max(groupMax, factors[j]);
    }
    for (let k = i; k <= j; k++) shared[k] = groupMax;
    i = j + 1;
  }
  return shared;
}

export type BranchFireWaterResult = {
  applied: boolean;
  fireAmounts: number[];
  waterAmounts: number[];
  fireTotal: number;
  waterTotal: number;
  fireScore: number;
  waterScore: number;
  dominant: FireWaterDominant;
  elementMultipliers: ElementVector[];
};

/** 원국 지지 화수 특수 보정 — 지장간 화/수 성분 기준 */
export function getBranchFireWaterElementMultipliers(
  bases: ElementVector[]
): BranchFireWaterResult {
  const fireAmounts = bases.map((b) => b.화);
  const waterAmounts = bases.map((b) => b.수);
  const fireTotal = fireAmounts.reduce((a, b) => a + b, 0);
  const waterTotal = waterAmounts.reduce((a, b) => a + b, 0);

  const firePresent = fireAmounts.map((v) => v >= FIRE_WATER_PRESENCE_THRESHOLD);
  const waterPresent = waterAmounts.map((v) => v >= FIRE_WATER_PRESENCE_THRESHOLD);
  const fireMaxContiguousRun = maxContiguousRun(firePresent);
  const waterMaxContiguousRun = maxContiguousRun(waterPresent);

  const fireScore =
    fireTotal + FIRE_WATER_RUN_BONUS * Math.max(0, fireMaxContiguousRun - 1);
  const waterScore =
    waterTotal + FIRE_WATER_RUN_BONUS * Math.max(0, waterMaxContiguousRun - 1);

  let dominant: FireWaterDominant = "balanced";
  if (Math.abs(fireScore - waterScore) < FIRE_WATER_BALANCE_THRESHOLD) {
    dominant = "balanced";
  } else if (waterScore > fireScore) {
    dominant = "water";
  } else {
    dominant = "fire";
  }

  const elementMultipliers = bases.map(() => emptyVectorOnes());
  const bothSidesPresent =
    fireTotal >= FIRE_WATER_PRESENCE_THRESHOLD &&
    waterTotal >= FIRE_WATER_PRESENCE_THRESHOLD;

  if (!bothSidesPresent || dominant === "balanced") {
    return {
      applied: false,
      fireAmounts,
      waterAmounts,
      fireTotal,
      waterTotal,
      fireScore,
      waterScore,
      dominant,
      elementMultipliers,
    };
  }

  let waterContactFactors = bases.map((_, i) => computeContactFactor(bases, i, "수"));
  let fireContactFactors = bases.map((_, i) => computeContactFactor(bases, i, "화"));
  waterContactFactors = shareContactAcrossContiguousGroups(bases, waterContactFactors, "화");
  fireContactFactors = shareContactAcrossContiguousGroups(bases, fireContactFactors, "수");

  for (let i = 0; i < bases.length; i++) {
    let fireMultiplier = 1;
    let waterMultiplier = 1;

    if (dominant === "water") {
      fireMultiplier = 1 - FIRE_WATER_WATER_DOMINANT_FIRE_PENALTY * waterContactFactors[i];
      waterMultiplier =
        1 - FIRE_WATER_WATER_DOMINANT_WATER_PENALTY * fireContactFactors[i];
    } else {
      fireMultiplier = 1 - FIRE_WATER_FIRE_DOMINANT_FIRE_PENALTY * waterContactFactors[i];
      waterMultiplier =
        1 - FIRE_WATER_FIRE_DOMINANT_WATER_PENALTY * fireContactFactors[i];
    }

    elementMultipliers[i].화 = clamp(
      fireMultiplier,
      FIRE_WATER_MULTIPLIER_MIN,
      FIRE_WATER_MULTIPLIER_MAX
    );
    elementMultipliers[i].수 = clamp(
      waterMultiplier,
      FIRE_WATER_MULTIPLIER_MIN,
      FIRE_WATER_MULTIPLIER_MAX
    );
  }

  return {
    applied: true,
    fireAmounts,
    waterAmounts,
    fireTotal,
    waterTotal,
    fireScore,
    waterScore,
    dominant,
    elementMultipliers,
  };
}

export type GanjiFireWaterResult = {
  stemMultipliers: number[];
  branchElementMultipliers: ElementVector[];
  details: FireWaterGanjiDetail[];
};

/** 같은 기둥 천간-지지 화수 보정 (지장간 화/수 성분 기준) */
export function getGanjiFireWaterMultipliers(
  stemChars: string[],
  branchChars: string[],
  bases: ElementVector[]
): GanjiFireWaterResult {
  const stemMultipliers = stemChars.map(() => 1);
  const branchElementMultipliers = bases.map(() => emptyVectorOnes());
  const details: FireWaterGanjiDetail[] = [];

  for (let i = 0; i < stemChars.length; i++) {
    const stem = stemChars[i];
    const branch = branchChars[i];
    const stemElement = getStemElement(stem);
    const branchDist = bases[i];
    let stemMult = 1;
    const branchMult = emptyVectorOnes();

    if (stemElement === "화" && branchDist.수 > 0) {
      stemMult = GANJI_FIRE_STEM_WATER_BRANCH_STEM_MULT;
      branchMult.수 = GANJI_FIRE_STEM_WATER_BRANCH_WATER_MULT;
    } else if (stemElement === "수" && branchDist.화 > 0) {
      stemMult = GANJI_WATER_STEM_FIRE_BRANCH_STEM_MULT;
      branchMult.화 = GANJI_WATER_STEM_FIRE_BRANCH_FIRE_MULT;
    }

    stemMultipliers[i] = stemMult;
    branchElementMultipliers[i] = branchMult;
    details.push({
      index: i,
      stem,
      stemElement,
      branch,
      branchDistribution: { ...branchDist },
      stemGanjiFireWaterMultiplier: stemMult,
      branchGanjiFireWaterElementMultiplier: { ...branchMult },
    });
  }

  return { stemMultipliers, branchElementMultipliers, details };
}

/** 대운 지지 ↔ 원국 지지 화수 보정 (대운 쪽만) */
export function getDaewoonBranchFireWaterElementMultiplier(
  originalBases: ElementVector[],
  daewoonBranchBase: ElementVector
): ElementVector {
  const result = emptyVectorOnes();
  const originalFireContact = Math.max(0, ...originalBases.map((b) => b.화));
  const originalWaterContact = Math.max(0, ...originalBases.map((b) => b.수));
  const fireContactFactor = originalFireContact * DAEWOON_FIRE_WATER_DISTANCE_FACTOR;
  const waterContactFactor = originalWaterContact * DAEWOON_FIRE_WATER_DISTANCE_FACTOR;

  const allBases = [...originalBases, daewoonBranchBase];
  const fireTotal = allBases.reduce((a, b) => a + b.화, 0);
  const waterTotal = allBases.reduce((a, b) => a + b.수, 0);

  if (
    fireTotal < FIRE_WATER_PRESENCE_THRESHOLD ||
    waterTotal < FIRE_WATER_PRESENCE_THRESHOLD
  ) {
    return result;
  }

  const dominant: FireWaterDominant =
    Math.abs(fireTotal - waterTotal) < FIRE_WATER_BALANCE_THRESHOLD
      ? "balanced"
      : waterTotal > fireTotal
        ? "water"
        : "fire";

  if (dominant === "balanced") return result;

  let fireMultiplier = 1;
  let waterMultiplier = 1;
  if (dominant === "water") {
    fireMultiplier = 1 - FIRE_WATER_WATER_DOMINANT_FIRE_PENALTY * waterContactFactor;
    waterMultiplier = 1 - FIRE_WATER_WATER_DOMINANT_WATER_PENALTY * fireContactFactor;
  } else {
    fireMultiplier = 1 - FIRE_WATER_FIRE_DOMINANT_FIRE_PENALTY * waterContactFactor;
    waterMultiplier = 1 - FIRE_WATER_FIRE_DOMINANT_WATER_PENALTY * fireContactFactor;
  }

  if (daewoonBranchBase.화 > 0 && originalWaterContact > 0) {
    result.화 = clamp(
      fireMultiplier,
      FIRE_WATER_MULTIPLIER_MIN,
      FIRE_WATER_MULTIPLIER_MAX
    );
  }
  if (daewoonBranchBase.수 > 0 && originalFireContact > 0) {
    result.수 = clamp(
      waterMultiplier,
      FIRE_WATER_MULTIPLIER_MIN,
      FIRE_WATER_MULTIPLIER_MAX
    );
  }

  return result;
}

function buildFireWaterExtremeDetail(
  branchChars: string[],
  bases: ElementVector[],
  fireWater: BranchFireWaterResult,
  ganjiDetails: FireWaterGanjiDetail[]
): FireWaterExtremeDetail {
  return {
    branch: {
      applied: fireWater.applied,
      mode: "hidden_stem_distribution",
      fireAmounts: fireWater.fireAmounts,
      waterAmounts: fireWater.waterAmounts,
      fireTotal: fireWater.fireTotal,
      waterTotal: fireWater.waterTotal,
      fireScore: fireWater.fireScore,
      waterScore: fireWater.waterScore,
      dominant: fireWater.dominant,
      multipliers: branchChars.map((branch, index) => ({
        index,
        branch,
        baseFire: bases[index].화,
        baseWater: bases[index].수,
        fireMultiplier: fireWater.elementMultipliers[index].화,
        waterMultiplier: fireWater.elementMultipliers[index].수,
        elementMultiplier: { ...fireWater.elementMultipliers[index] },
      })),
    },
    ganji: ganjiDetails,
  };
}

/** 지지 하나의 기본 오행 분포 (합계 1). 토 지지 보정 + 지장간 양/음 보정 후 normalize. */
export function getBranchBaseDistribution(branch: string): ElementVector {
  const ko = normalizeBranchKo(branch);

  const earthAdj = EARTH_BRANCH_ELEMENT_DISTRIBUTION[ko];
  if (earthAdj) {
    const reps = EARTH_BRANCH_REPRESENTATIVE_STEM[ko] ?? {};
    const weighted = emptyVector();
    for (const el of ELEMENT_ORDER) {
      if (earthAdj[el] <= 0) continue;
      const repStem = reps[el];
      const polarityMult = repStem ? getStemPolarityMultiplier(repStem) : 1;
      weighted[el] = earthAdj[el] * polarityMult;
    }
    return normalizeElementVector(weighted);
  }

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
    dist[el] += weight * getStemPolarityMultiplier(stem);
  }

  return normalizeElementVector(dist);
}

function findAllBranchIndexes(branches: string[], target: string): number[] {
  const indexes: number[] = [];
  branches.forEach((b, i) => {
    if (b === target) indexes.push(i);
  });
  return indexes;
}

/** matchedBranches의 index 조합 중 span이 가장 작은 조합 선택 */
function chooseMinimalSpanIndexes(
  matchedBranches: string[],
  branches: string[]
): { indexes: number[]; span: number } {
  const optionsPerBranch = matchedBranches.map((b) => findAllBranchIndexes(branches, b));
  if (optionsPerBranch.some((opts) => opts.length === 0)) {
    return { indexes: [], span: 0 };
  }

  const combos = optionsPerBranch.reduce<number[][]>(
    (acc, curr) => acc.flatMap((prefix) => curr.map((c) => [...prefix, c])),
    [[]]
  );

  let best = combos[0];
  let bestSpan = Math.max(...best) - Math.min(...best);
  for (const combo of combos.slice(1)) {
    const span = Math.max(...combo) - Math.min(...combo);
    if (span < bestSpan) {
      bestSpan = span;
      best = combo;
    }
  }

  return { indexes: best, span: bestSpan };
}

function classifySamhapType(
  matchedBranches: string[],
  middle: string
): { type: SamhapMatchType; baseMultiplier: number } {
  if (matchedBranches.length === 3) {
    return { type: "full", baseMultiplier: SAMHAP_FULL_MULTIPLIER };
  }
  if (matchedBranches.includes(middle)) {
    return {
      type: "partial_with_middle",
      baseMultiplier: SAMHAP_PARTIAL_WITH_MIDDLE_MULTIPLIER,
    };
  }
  return {
    type: "partial_edge_only",
    baseMultiplier: SAMHAP_PARTIAL_EDGE_ONLY_MULTIPLIER,
  };
}

/** 원국 지지에서 성립한 삼합/반합 목록 (거리 보정 포함) */
export function getSamhapMatches(branches: string[]): SamhapGroupDetail[] {
  const normalized = branches.map(normalizeBranchKo);
  const branchSet = new Set(normalized);
  const matches: SamhapGroupDetail[] = [];

  for (const group of SAMHAP_GROUPS) {
    const matchedBranches = group.branches.filter((b) => branchSet.has(b));
    if (matchedBranches.length < 2) continue;

    const { type, baseMultiplier } = classifySamhapType(matchedBranches, group.middle);
    const { indexes: matchedIndexes, span } = chooseMinimalSpanIndexes(
      matchedBranches,
      normalized
    );
    const distanceFactor = SAMHAP_DISTANCE_FACTOR_BY_SPAN[span] ?? 1;
    const multiplier = applyEffectiveSamhapMultiplier(baseMultiplier, distanceFactor);

    matches.push({
      name: group.name,
      element: group.element,
      matchedBranches: [...matchedBranches],
      matchedIndexes,
      span,
      distanceFactor,
      type,
      baseMultiplier,
      multiplier,
    });
  }

  return matches;
}

/**
 * 대운 지지 + 원국으로 삼합/반합 감지.
 * 대운 지지가 포함된 것만 반환하며, 거리는 고정 계수(0.85)로 보정한다.
 */
export function getDaewoonSamhapMatches(
  originalBranches: string[],
  daewoonBranch: string
): SamhapGroupDetail[] {
  const original = originalBranches.map(normalizeBranchKo);
  const dae = normalizeBranchKo(daewoonBranch);
  const branchSet = new Set([...original, dae]);
  const matches: SamhapGroupDetail[] = [];

  for (const group of SAMHAP_GROUPS) {
    if (!(group.branches as readonly string[]).includes(dae)) continue;
    const matchedBranches = group.branches.filter((b) => branchSet.has(b));
    if (matchedBranches.length < 2) continue;
    if (!(matchedBranches as readonly string[]).includes(dae)) continue;

    const { type, baseMultiplier } = classifySamhapType(matchedBranches, group.middle);
    const distanceFactor = DAEWOON_SAMHAP_DISTANCE_FACTOR;
    const multiplier = applyEffectiveSamhapMultiplier(baseMultiplier, distanceFactor);

    matches.push({
      name: group.name,
      element: group.element,
      matchedBranches: [...matchedBranches],
      matchedIndexes: [],
      span: 0,
      distanceFactor,
      type,
      baseMultiplier,
      multiplier,
    });
  }

  return matches;
}

/** 지지별·오행별 삼합 배수 맵 */
export function getSamhapElementMultiplierMap(branches: string[]): {
  matches: SamhapGroupDetail[];
  map: Record<string, ElementVector>;
} {
  const normalized = branches.map(normalizeBranchKo);
  const matches = getSamhapMatches(normalized);
  const map: Record<string, ElementVector> = {};

  for (const branch of normalized) {
    if (!map[branch]) map[branch] = emptyVectorOnes();
  }

  for (const match of matches) {
    for (const branch of match.matchedBranches) {
      if (!map[branch]) map[branch] = emptyVectorOnes();
      map[branch][match.element] = Math.max(map[branch][match.element], match.multiplier);
    }
  }

  return { matches, map };
}

function emptyVectorOnes(): ElementVector {
  return { 목: 1, 화: 1, 토: 1, 금: 1, 수: 1 };
}

function buildEarthBranchAdjustmentDetail(branchChars: string[]): EarthBranchAdjustmentDetail {
  const seen = new Set<string>();
  const adjustedBranches: { branch: string; distribution: ElementVector }[] = [];

  for (const b of branchChars) {
    if (seen.has(b)) continue;
    seen.add(b);
    if (EARTH_BRANCH_ELEMENT_DISTRIBUTION[b]) {
      adjustedBranches.push({
        branch: b,
        distribution: getBranchBaseDistribution(b),
      });
    }
  }

  return {
    applied: adjustedBranches.length > 0,
    adjustedBranches,
  };
}

function buildSamhapDetail(
  matches: SamhapGroupDetail[],
  map: Record<string, ElementVector>
): SamhapDetail {
  if (matches.length === 0) {
    return { applied: false, groups: [], boostedBranches: [] };
  }

  const boostedBranches: SamhapDetail["boostedBranches"] = [];
  for (const [branch, multipliers] of Object.entries(map)) {
    for (const el of ELEMENT_ORDER) {
      if (multipliers[el] > 1) {
        boostedBranches.push({
          branch,
          element: el,
          multiplier: multipliers[el],
        });
      }
    }
  }

  return {
    applied: true,
    groups: matches,
    boostedBranches,
  };
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

/** 지지 위치별 실제 가중합 벡터 (방합 × 삼합 × 양/음 × peer·화수·간지 오행별) */
export function computeBranchWeightedPosition(
  index: number,
  branchChars: string[],
  branchBases: ElementVector[],
  banghap: BanghapDetail,
  samhapMap: Record<string, ElementVector> = {},
  branchPeerElementMultipliers: ElementVector[] = [],
  branchFireWaterElementMultipliers: ElementVector[] = [],
  branchGanjiFireWaterElementMultipliers: ElementVector[] = []
): ElementVector {
  const result = emptyVector();

  const addContribution = (sourceIndex: number, positionWeight: number) => {
    const branch = branchChars[sourceIndex];
    const banghapMult = getBranchBanghapMultiplier(branch, banghap);
    const elementMult = samhapMap[branch] ?? emptyVectorOnes();
    const branchPolarityMult = getBranchPolarityMultiplier(branch);
    const peerElMult = branchPeerElementMultipliers[sourceIndex] ?? emptyVectorOnes();
    const fireWaterElMult =
      branchFireWaterElementMultipliers[sourceIndex] ?? emptyVectorOnes();
    const ganjiFireWaterElMult =
      branchGanjiFireWaterElementMultipliers[sourceIndex] ?? emptyVectorOnes();
    const base = branchBases[sourceIndex];

    for (const el of ELEMENT_ORDER) {
      result[el] +=
        base[el] *
        positionWeight *
        banghapMult *
        elementMult[el] *
        branchPolarityMult *
        peerElMult[el] *
        fireWaterElMult[el] *
        ganjiFireWaterElMult[el];
    }
  };

  addContribution(index, SELF_BRANCH_WEIGHT);
  if (index - 1 >= 0) addContribution(index - 1, ADJACENT_BRANCH_WEIGHT);
  if (index + 1 < branchBases.length) addContribution(index + 1, ADJACENT_BRANCH_WEIGHT);

  return result;
}

function buildBranchWeightedDetails(
  branchChars: string[],
  branchBases: ElementVector[],
  banghap: BanghapDetail,
  samhapMap: Record<string, ElementVector>,
  branchPeerElementMultipliers: ElementVector[],
  branchFireWaterElementMultipliers: ElementVector[],
  branchGanjiFireWaterElementMultipliers: ElementVector[]
): BranchWeightedPositionDetail[] {
  return branchChars.map((_branch, index) => {
    const contributions: BranchContributionDetail[] = [];

    const pushContribution = (sourceIndex: number, positionWeight: number) => {
      const sourceBranch = branchChars[sourceIndex];
      contributions.push({
        sourceIndex,
        sourceBranch,
        sourceBranchPolarity: getBranchPolarity(sourceBranch),
        branchPolarityMultiplier: getBranchPolarityMultiplier(sourceBranch),
        branchPeerElementMultiplier: {
          ...(branchPeerElementMultipliers[sourceIndex] ?? emptyVectorOnes()),
        },
        branchFireWaterElementMultiplier: {
          ...(branchFireWaterElementMultipliers[sourceIndex] ?? emptyVectorOnes()),
        },
        branchGanjiFireWaterElementMultiplier: {
          ...(branchGanjiFireWaterElementMultipliers[sourceIndex] ?? emptyVectorOnes()),
        },
        positionWeight,
        banghapMultiplier: getBranchBanghapMultiplier(sourceBranch, banghap),
        samhapElementMultiplier: {
          ...(samhapMap[sourceBranch] ?? emptyVectorOnes()),
        },
      });
    };

    pushContribution(index, SELF_BRANCH_WEIGHT);
    if (index - 1 >= 0) pushContribution(index - 1, ADJACENT_BRANCH_WEIGHT);
    if (index + 1 < branchChars.length) pushContribution(index + 1, ADJACENT_BRANCH_WEIGHT);

    return {
      positionIndex: index,
      contributions,
      weighted: computeBranchWeightedPosition(
        index,
        branchChars,
        branchBases,
        banghap,
        samhapMap,
        branchPeerElementMultipliers,
        branchFireWaterElementMultipliers,
        branchGanjiFireWaterElementMultipliers
      ),
    };
  });
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
  branchBases: ElementVector[],
  stemPeerMultipliers: number[] = [],
  stemGanjiFireWaterMultipliers: number[] = []
): StemScoreDetail[] {
  const adjacentMultipliers = getAdjacentSameStemMultipliers(stemChars);

  return stemChars.map((stem, index) => {
    const element = getStemElement(stem);
    const polarity = getStemPolarity(stem);
    const rawScore = computeStemRawScore(stem, index, branchBases);
    const minAdjustedScore = Math.max(rawScore, STEM_MIN_SCORE);
    const adjacentSameStemMultiplier = adjacentMultipliers[index];
    const stemPolarityMultiplier = getStemPolarityMultiplier(stem);
    const stemPeerInteractionMultiplier = stemPeerMultipliers[index] ?? 1;
    const stemGanjiFireWaterMultiplier = stemGanjiFireWaterMultipliers[index] ?? 1;
    const finalScore =
      minAdjustedScore *
      adjacentSameStemMultiplier *
      stemPolarityMultiplier *
      stemPeerInteractionMultiplier *
      stemGanjiFireWaterMultiplier;

    return {
      index,
      stem,
      element,
      polarity,
      rawScore,
      minAdjustedScore,
      adjacentSameStemMultiplier,
      stemPolarityMultiplier,
      stemPeerInteractionMultiplier,
      stemGanjiFireWaterMultiplier,
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
  originalBranches: string[],
  originalBranchBases: ElementVector[]
): { raw: ElementVector; detail: DaewoonDetail } {
  const stem = daewoon.stem;
  const branch = daewoon.branch;
  const stemElement = getStemElement(stem);
  const branchMainElement = getBranchMainElement(branch);
  const branchBase = getBranchBaseDistribution(branch);

  const { relation, stemGanjiMultiplier, branchGanjiMultiplier } = getDaewoonRelation(
    stemElement,
    branchMainElement
  );

  const stemSameCharWithOriginal = originalStems.includes(stem);
  const stemSameCharMultiplier = stemSameCharWithOriginal
    ? DAEWOON_SAME_STEM_MULTIPLIER
    : 1;

  // 대운 간지 내부 화수 (지장간 분포 기준) — 중복 감점 완화 정책
  let stemFireWaterExtraMultiplier = 1;
  const branchGanjiFireWaterEl = emptyVectorOnes();
  if (stemElement === "화" && branchBase.수 > 0) {
    stemFireWaterExtraMultiplier = GANJI_FIRE_STEM_WATER_BRANCH_STEM_MULT;
    branchGanjiFireWaterEl.수 = GANJI_FIRE_STEM_WATER_BRANCH_WATER_MULT;
  } else if (stemElement === "수" && branchBase.화 > 0) {
    stemFireWaterExtraMultiplier = GANJI_WATER_STEM_FIRE_BRANCH_STEM_MULT;
    // 권장: 수 천간만 추가 보정, 지지 화는 간지 화수로 줄이지 않음
  }

  const stemFinalMultiplier =
    stemGanjiMultiplier * stemSameCharMultiplier * stemFireWaterExtraMultiplier;

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

  const daewoonSamhapGroups = getDaewoonSamhapMatches(originalBranches, branch);
  const daewoonSamhapElementMult = emptyVectorOnes();
  for (const match of daewoonSamhapGroups) {
    daewoonSamhapElementMult[match.element] = Math.max(
      daewoonSamhapElementMult[match.element],
      match.multiplier
    );
  }
  const branchSamhapDetail: DaewoonSamhapDetail = {
    applied: daewoonSamhapGroups.length > 0,
    groups: daewoonSamhapGroups,
    elementMultiplier: { ...daewoonSamhapElementMult },
  };

  const stemPolarity = getStemPolarity(stem);
  const stemPolarityMultiplier = getStemPolarityMultiplier(stem);
  const branchPolarity = getBranchPolarity(branch);
  const branchPolarityMultiplier = getBranchPolarityMultiplier(branch);

  const daewoonVsOriginalFireWater = getDaewoonBranchFireWaterElementMultiplier(
    originalBranchBases,
    branchBase
  );
  const branchFireWaterElementMultiplier = emptyVectorOnes();
  for (const el of ELEMENT_ORDER) {
    branchFireWaterElementMultiplier[el] =
      branchGanjiFireWaterEl[el] * daewoonVsOriginalFireWater[el];
  }

  const raw = emptyVector();
  raw[stemElement] += 1 * stemFinalMultiplier * stemPolarityMultiplier;

  for (const el of ELEMENT_ORDER) {
    raw[el] +=
      branchBase[el] *
      branchFinalMultiplier *
      daewoonSamhapElementMult[el] *
      branchPolarityMultiplier *
      branchFireWaterElementMultiplier[el];
  }

  return {
    raw,
    detail: {
      applied: true,
      influenceRate: DAEWOON_INFLUENCE_RATE,
      selfRate: DAEWOON_SELF_RATE,
      pillarInteractionRate: DAEWOON_PILLAR_INTERACTION_RATE,
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
      stemPolarity,
      stemPolarityMultiplier,
      branchPolarity,
      branchPolarityMultiplier,
      branchSamhapDetail,
      stemFireWaterExtraMultiplier,
      branchFireWaterElementMultiplier: { ...branchFireWaterElementMultiplier },
      branchBaseDistribution: { ...branchBase },
      daewoonRaw: { ...raw },
      daewoonSelfRaw: { ...raw },
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

  const branchPeerElementMultipliers = getBranchPeerElementMultipliers(branchBase);
  const branchPeerInteraction = buildBranchPeerInteractionDetail(
    branchChars,
    branchBase,
    branchPeerElementMultipliers
  );

  const fireWater = getBranchFireWaterElementMultipliers(branchBase);
  const ganjiFireWater = getGanjiFireWaterMultipliers(
    stemChars,
    branchChars,
    branchBase
  );
  const fireWaterExtreme = buildFireWaterExtremeDetail(
    branchChars,
    branchBase,
    fireWater,
    ganjiFireWater.details
  );

  const stemElements = stemChars.map((s) => getStemElement(s));
  const stemPeerResults = getPeerInteractionMultipliers(stemElements);
  const stemPeerMultipliers = stemPeerResults.map((p) => p.multiplier);
  const stemPeerInteraction = buildStemPeerInteractionDetail(
    stemChars,
    stemPeerResults
  );

  const banghap = computeOriginalBanghap(branchChars);
  const { matches: samhapMatches, map: samhapMap } =
    getSamhapElementMultiplierMap(branchChars);
  const earthBranchAdjustment = buildEarthBranchAdjustmentDetail(branchChars);
  const samhap = buildSamhapDetail(samhapMatches, samhapMap);

  const branchWeighted = branchBase.map((_, i) =>
    computeBranchWeightedPosition(
      i,
      branchChars,
      branchBase,
      banghap,
      samhapMap,
      branchPeerElementMultipliers,
      fireWater.elementMultipliers,
      ganjiFireWater.branchElementMultipliers
    )
  );
  const branchWeightedDetail = buildBranchWeightedDetails(
    branchChars,
    branchBase,
    banghap,
    samhapMap,
    branchPeerElementMultipliers,
    fireWater.elementMultipliers,
    ganjiFireWater.branchElementMultipliers
  );
  const branchTotal = sumVector(branchWeighted);

  const stemScores = computeStemScoreDetails(
    stemChars,
    branchBase,
    stemPeerMultipliers,
    ganjiFireWater.stemMultipliers
  );
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
      branchWeightedDetail,
      branchTotal,
      stemScores,
      stemTotal,
      banghap,
      earthBranchAdjustment,
      samhap,
      branchPeerInteraction,
      stemPeerInteraction,
      fireWaterExtreme,
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

  const daewoonSelfResult = computeDaewoonDistribution(
    normalizedDaewoon,
    stemChars,
    branchChars,
    original.detail.branchBase
  );
  const daewoonSelfPercentage = toPercentage(daewoonSelfResult.raw);

  const pillarInteraction = computeDaewoonPillarInteraction(
    normalizedDaewoon.stem,
    normalizedDaewoon.branch,
    stemChars,
    branchChars,
    original.detail.stemScores,
    original.detail.branchWeighted,
    original.originalPercentage
  );

  const daewoonPercentage = emptyVector();
  for (const el of ELEMENT_ORDER) {
    daewoonPercentage[el] = round2(
      daewoonSelfPercentage[el] * DAEWOON_SELF_RATE +
        pillarInteraction.percentage[el] * DAEWOON_PILLAR_INTERACTION_RATE
    );
  }

  const finalPercentage = blendOriginalAndDaewoonPercentage(
    original.originalPercentage,
    daewoonPercentage
  );
  const originalSum = vectorSum(original.originalRaw);
  const finalRaw = percentageToRaw(finalPercentage, originalSum);

  return {
    originalRaw: original.originalRaw,
    originalPercentage: original.originalPercentage,
    raw: finalRaw,
    percentage: finalPercentage,
    detail: {
      ...original.detail,
      daewoon: {
        ...daewoonSelfResult.detail,
        daewoonSelfPercentage,
        pillarInteraction,
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
