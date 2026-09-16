/**
 * 원국 요약 — 가설을 뽑기 위한 최소 정보만 추린다.
 *
 * 십신 개수는 천간(년·월·시)과 지지의 지장간을 함께 센다.
 * 일간 자신은 세지 않는다(자기 자신은 비교 대상이 아니다).
 */
import { STEM_META, BRANCH_META, type Element } from "@/lib/saju/constants";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import type { SajuProfilePillars } from "@/lib/diary/types";
import { findYongsin } from "@/lib/saju/yongsin";
import {
  GOD_FAMILY_OF,
  type GodFamily,
  type NatalSummary,
} from "./types";

const ALL_GODS: TenGod[] = [
  "비견", "겁재", "식신", "상관", "편재",
  "정재", "편관", "정관", "편인", "정인",
];

const ALL_FAMILIES: GodFamily[] = ["peer", "output", "wealth", "officer", "resource"];
const ALL_ELEMENTS: Element[] = ["wood", "fire", "earth", "metal", "water"];

/** 지장간 역할별 가중치 — 정기가 그 지지의 주인이다 */
const HIDDEN_WEIGHT = {
  main: 1,
  middle: 0.5,
  residual: 0.3,
} as const;

function emptyGodCounts(): Record<TenGod, number> {
  return Object.fromEntries(ALL_GODS.map((g) => [g, 0])) as Record<TenGod, number>;
}

function emptyElementCounts(): Record<Element, number> {
  return Object.fromEntries(ALL_ELEMENTS.map((e) => [e, 0])) as Record<Element, number>;
}

function isStemHanja(value: string): value is StemHanja {
  return Boolean(STEM_META[value]);
}

export function buildNatalSummary(pillars: SajuProfilePillars): NatalSummary {
  const dayMaster = pillars.day.stemHanja;

  if (!isStemHanja(dayMaster)) {
    throw new Error(`원국의 일간이 올바르지 않습니다: ${dayMaster}`);
  }

  const godCounts = emptyGodCounts();
  const elementCounts = emptyElementCounts();

  const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour]
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  for (const pillar of allPillars) {
    // ── 천간 ──
    const stem = pillar.stemHanja;
    if (isStemHanja(stem)) {
      elementCounts[STEM_META[stem].element] += 1;
      // 일간 자신은 십신 대상에서 제외
      if (pillar !== pillars.day) {
        godCounts[getTenGod(dayMaster, stem)] += 1;
      }
    }

    // ── 지지: 오행은 지지 자체, 십신은 지장간 ──
    const branch = pillar.branchHanja;
    const branchMeta = BRANCH_META[branch];
    if (branchMeta) {
      elementCounts[branchMeta.element] += 1;
    }

    let hidden: ReturnType<typeof getHiddenStemsByBranch>;
    try {
      hidden = getHiddenStemsByBranch(branch);
    } catch {
      continue;
    }

    for (const h of hidden) {
      if (!isStemHanja(h.stem)) continue;
      godCounts[getTenGod(dayMaster, h.stem)] += HIDDEN_WEIGHT[h.role];
    }
  }

  // ── 가족별 합산 ──
  const familyCounts = Object.fromEntries(
    ALL_FAMILIES.map((f) => [f, 0])
  ) as Record<GodFamily, number>;

  for (const god of ALL_GODS) {
    familyCounts[GOD_FAMILY_OF[god]] += godCounts[god];
  }

  // ── 오행 비율 ──
  const elementTotal = ALL_ELEMENTS.reduce((sum, e) => sum + elementCounts[e], 0) || 1;
  const elementRatio = Object.fromEntries(
    ALL_ELEMENTS.map((e) => [e, elementCounts[e] / elementTotal])
  ) as Record<Element, number>;

  const sortedByRatio = [...ALL_ELEMENTS].sort(
    (a, b) => elementRatio[a] - elementRatio[b]
  );

  const weakestElement = sortedByRatio[0]!;
  const strongestElement = sortedByRatio[sortedByRatio.length - 1]!;

  // 부동소수라 정확히 같은 값이 안 나올 수 있어 여유를 둔다
  const EPSILON = 1e-6;
  const countAt = (target: number): number =>
    ALL_ELEMENTS.filter((e) => Math.abs(elementRatio[e] - target) < EPSILON).length;

  // 용신 — 사주 원국 화면과 같은 오행 분포에서 나온다.
  // 실패해도 나머지 요약은 그대로 쓴다.
  let yongsin: NatalSummary["yongsin"] = null;
  try {
    const found = findYongsin({
      year: pillars.year,
      month: pillars.month,
      day: pillars.day,
      hour: pillars.hour ?? null,
    });
    if (found) {
      yongsin = {
        elementKo: found.element,
        dominantKo: found.dominant,
        dominantPercent: found.dominantPercent,
        ganjiHanja: found.ganji.map((g) => g.hanja),
        fromTZone: found.source === "tzone",
      };
    }
  } catch {
    yongsin = null;
  }

  return {
    dayMaster,
    dayMasterKo: STEM_META[dayMaster].ko,
    dayMasterElement: STEM_META[dayMaster].element,
    godCounts: roundCounts(godCounts),
    familyCounts: roundCounts(familyCounts),
    elementRatio,
    weakestElement,
    strongestElement,
    yongsin,
    weakestIsTied: countAt(elementRatio[weakestElement]) > 1,
    strongestIsTied: countAt(elementRatio[strongestElement]) > 1,
  };
}

function roundCounts<K extends string>(counts: Record<K, number>): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(counts) as K[]) {
    out[key] = Math.round(counts[key] * 10) / 10;
  }
  return out;
}
