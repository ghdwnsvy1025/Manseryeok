import {
  calculateElementDistribution,
  ELEMENT_ORDER,
  type ElementVector,
  getSamhapMatches,
} from "@/lib/saju/elementDistribution";
import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";
import { detectBranchRelations, detectStemRelations } from "@/lib/saju/interpretation/relations";
import {
  assertValidPillarChars,
  dayMasterFromStems,
  koToBranchHanja,
  koToStemHanja,
} from "./pillars";
import {
  resolveLuckOnlyRates,
  resolveNativeWithLuckRates,
  selectedLuckKeys,
  LUCK_ONLY_INTERACTION_RATE,
  LUCK_ONLY_SELF_RATE,
} from "./luckRates";
import {
  buildFeatureCatalog,
  isElementDistributionApproximate,
  FEATURE_CATALOG_VERSION,
} from "./featureAllowlist";
import {
  CALCULATION_VERSION,
  FEATURE_SCHEMA_VERSION,
  THEORY_VERSION,
} from "./versions";
import type {
  AstrologyCalcInput,
  AstrologyCalculationResult,
  AstrologyFeatureVector,
  RelationFeatureCounts,
  TenGodFeatureMap,
} from "./types";
import { STEM_META } from "@/lib/saju/constants";

const TEN_GODS: TenGod[] = [
  "비견",
  "겁재",
  "식신",
  "상관",
  "편재",
  "정재",
  "편관",
  "정관",
  "편인",
  "정인",
];

function emptyTenGodMap(): TenGodFeatureMap {
  return Object.fromEntries(TEN_GODS.map((g) => [g, 0])) as TenGodFeatureMap;
}

function emptyVector(): ElementVector {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizePercentage(v: ElementVector): ElementVector {
  const sum = ELEMENT_ORDER.reduce((s, e) => s + v[e], 0);
  if (sum <= 0) return emptyVector();
  const out = emptyVector();
  for (const e of ELEMENT_ORDER) {
    out[e] = round2((v[e] / sum) * 100);
  }
  // fix rounding drift on 수
  const drift =
    100 -
    ELEMENT_ORDER.reduce((s, e) => s + (e === "수" ? 0 : out[e]), 0);
  out.수 = round2(drift);
  return out;
}

function blendPercentages(
  parts: Array<{ weight: number; pct: ElementVector }>
): ElementVector {
  const raw = emptyVector();
  let wSum = 0;
  for (const p of parts) {
    if (p.weight <= 0) continue;
    wSum += p.weight;
    for (const e of ELEMENT_ORDER) {
      raw[e] += p.pct[e] * p.weight;
    }
  }
  if (wSum <= 0) return emptyVector();
  const scaled = emptyVector();
  for (const e of ELEMENT_ORDER) {
    scaled[e] = raw[e] / wSum;
  }
  return normalizePercentage(scaled);
}

function yinYangFromStems(stems: string): { yin: number; yang: number } {
  let yin = 0;
  let yang = 0;
  for (const ko of stems) {
    const hanja = koToStemHanja(ko);
    if (!hanja) continue;
    if (STEM_META[hanja]?.yinYang === "yin") yin += 1;
    else yang += 1;
  }
  const t = yin + yang || 1;
  return { yin: yin / t, yang: yang / t };
}

function computeTenGodFeatures(
  dayMasterKo: string,
  stems: string,
  luckStems: string[]
): TenGodFeatureMap {
  const dayHanja = koToStemHanja(dayMasterKo);
  const map = emptyTenGodMap();
  if (!dayHanja) return map;

  const dayIdx = stems.length === 4 ? 1 : 0;
  for (let i = 0; i < stems.length; i++) {
    if (i === dayIdx) continue;
    const h = koToStemHanja(stems[i]!);
    if (!h) continue;
    map[getTenGod(dayHanja as never, h as never)] += 1;
  }
  for (const ko of luckStems) {
    const h = koToStemHanja(ko);
    if (!h) continue;
    map[getTenGod(dayHanja as never, h as never)] += 1;
  }
  return map;
}

function computeRelationFeatures(
  branches: string,
  luckBranches: string[],
  stems: string,
  luckStems: string[]
): RelationFeatureCounts {
  const counts: RelationFeatureCounts = {
    yukhap: 0,
    chung: 0,
    hyeong: 0,
    pa: 0,
    hae: 0,
    cheonGanHap: 0,
    banghapGroups: 0,
    samhapGroups: 0,
  };

  const allBranches = [...branches.split(""), ...luckBranches]
    .map((ko) => koToBranchHanja(ko))
    .filter((h): h is string => Boolean(h));

  for (let i = 0; i < allBranches.length; i++) {
    for (let j = i + 1; j < allBranches.length; j++) {
      const rels = detectBranchRelations(allBranches[i]!, allBranches[j]!);
      for (const r of rels) {
        if (r.kind === "yukhap") counts.yukhap += 1;
        if (r.kind === "chung") counts.chung += 1;
        if (r.kind === "hyeong") counts.hyeong += 1;
        if (r.kind === "pa") counts.pa += 1;
        if (r.kind === "hae") counts.hae += 1;
      }
    }
  }

  const allStems = [...stems.split(""), ...luckStems]
    .map((ko) => koToStemHanja(ko))
    .filter((h): h is string => Boolean(h));
  for (let i = 0; i < allStems.length; i++) {
    for (let j = i + 1; j < allStems.length; j++) {
      const rels = detectStemRelations(allStems[i]!, allStems[j]!);
      counts.cheonGanHap += rels.length;
    }
  }

  const branchKos = branches.split("");
  // B-6 방합 그룹 (성립 개수만 카운트)
  const banghapDefs = [
    ["해", "자", "축"],
    ["인", "묘", "진"],
    ["사", "오", "미"],
    ["신", "유", "술"],
  ];
  for (const group of banghapDefs) {
    const hit = group.filter((b) => branchKos.includes(b)).length;
    if (hit >= 2) counts.banghapGroups += 1;
  }
  counts.samhapGroups = getSamhapMatches(branchKos).length;
  return counts;
}

/**
 * 결정론적 사주 특징 계산.
 * 오행 분포는 기존 elementDistribution(자료 B 구현)을 사용하고,
 * 반영률 메타는 LUCK_BASE_WEIGHTS(B-13/14)로 별도 기록한다.
 */
export function computeAstrologyFeatures(
  input: AstrologyCalcInput
): AstrologyCalculationResult {
  assertValidPillarChars(input.stems, input.branches);

  const selected = selectedLuckKeys(input);
  const luckMixRates =
    input.calculationMode === "luck_only"
      ? resolveLuckOnlyRates(selected)
      : resolveNativeWithLuckRates(selected);

  const dist = calculateElementDistribution({
    stems: input.stems,
    branches: input.branches,
    daewoon: input.daewoon,
    yearly: input.yearly,
    monthly: input.monthly,
    daily: input.daily,
    calculationMode: input.calculationMode,
  });

  // luck_only + 다수 운: 자료 B self/interaction 비율을 percentage에 재적용할 수 있으면
  // 엔진 결과를 유지하되, rates 메타는 명세 값을 기록한다.
  let percentage = dist.percentage;
  if (
    input.calculationMode === "luck_only" &&
    selected.length >= 2 &&
    dist.detail.luckOnly?.percentage
  ) {
    // 현재 엔진 luck_only는 self 조합 근사. 메타에 명세 self/interaction 비율 기록.
    percentage = dist.percentage;
  }

  const dayMasterKo = dayMasterFromStems(input.stems);
  const luckStems = [
    input.daewoon?.stem,
    input.yearly?.stem,
    input.monthly?.stem,
    input.daily?.stem,
  ].filter((s): s is string => Boolean(s));
  const luckBranches = [
    input.daewoon?.branch,
    input.yearly?.branch,
    input.monthly?.branch,
    input.daily?.branch,
  ].filter((s): s is string => Boolean(s));

  const tenGodFeatures = computeTenGodFeatures(
    dayMasterKo,
    input.stems,
    luckStems
  );
  const relationFeatures = computeRelationFeatures(
    input.branches,
    luckBranches,
    input.stems,
    luckStems
  );
  const yy = yinYangFromStems(input.stems);
  const elementApprox = isElementDistributionApproximate(input);
  const elementDistributionStatus = elementApprox
    ? ("approximate" as const)
    : ("verified" as const);
  const approximateSections: string[] = [];
  if (elementApprox) {
    approximateSections.push("B-13-monthly-daily-toHigher");
    if (input.calculationMode === "luck_only") {
      approximateSections.push("B-14-ordered-pair-interaction");
    }
  }

  return {
    calculationMode: input.calculationMode,
    percentage,
    originalPercentage: dist.originalPercentage,
    luckMixRates,
    yinRatio: yy.yin,
    yangRatio: yy.yang,
    dayMasterKo,
    tenGodFeatures,
    relationFeatures,
    rawCalculationPayload: {
      detail: dist.detail,
      raw: dist.raw,
      luckOnlySelfRate: LUCK_ONLY_SELF_RATE,
      luckOnlyInteractionRate: LUCK_ONLY_INTERACTION_RATE,
      elementDistributionStatus,
      featureCatalogVersion: FEATURE_CATALOG_VERSION,
      featureCatalog: buildFeatureCatalog({
        elementDistributionApproximate: elementApprox,
      }),
      input: {
        stems: input.stems,
        branches: input.branches,
        selected,
        localDate: input.localDate ?? null,
        timezone: input.timezone ?? null,
      },
    },
    calculationVersion: CALCULATION_VERSION,
    theoryVersion: THEORY_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    sourceRuleIds: [
      "B-1-stem-element",
      "B-3-hidden-stems",
      "B-13-native-with-luck",
      "B-14-luck-only",
      "B-15-mode-map",
      luckMixRates.sourceRuleId,
    ],
    elementDistributionStatus,
    parity: {
      luckMixRates: "verified",
      elementPercentage: elementDistributionStatus,
      tenGods: "verified",
      relations: "verified",
      approximateSections,
    },
  };
}

export function toFeatureVector(
  result: AstrologyCalculationResult
): AstrologyFeatureVector {
  const tg = result.tenGodFeatures;
  const rel = result.relationFeatures;
  const rates = result.luckMixRates;
  const pct = result.percentage;

  return {
    wood: pct.목,
    fire: pct.화,
    earth: pct.토,
    metal: pct.금,
    water: pct.수,
    yinRatio: result.yinRatio,
    yangRatio: result.yangRatio,
    axisPeer: tg.비견 + tg.겁재,
    axisOutput: tg.식신 + tg.상관,
    axisWealth: tg.편재 + tg.정재,
    axisAuthority: tg.편관 + tg.정관,
    axisResource: tg.편인 + tg.정인,
    tenGod_비견: tg.비견,
    tenGod_겁재: tg.겁재,
    tenGod_식신: tg.식신,
    tenGod_상관: tg.상관,
    tenGod_편재: tg.편재,
    tenGod_정재: tg.정재,
    tenGod_편관: tg.편관,
    tenGod_정관: tg.정관,
    tenGod_편인: tg.편인,
    tenGod_정인: tg.정인,
    rel_yukhap: rel.yukhap,
    rel_chung: rel.chung,
    rel_hyeong: rel.hyeong,
    rel_pa: rel.pa,
    rel_hae: rel.hae,
    rel_cheonGanHap: rel.cheonGanHap,
    luck_daewoon_rate: rates.daewoon,
    luck_yearly_rate: rates.yearly,
    luck_monthly_rate: rates.monthly,
    luck_daily_rate: rates.daily,
    original_rate: rates.original,
  };
}

export { blendPercentages, normalizePercentage };
