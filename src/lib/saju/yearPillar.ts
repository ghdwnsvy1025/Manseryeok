// ============================================================
// 년주(年柱) 계산
// 기준: 입춘(立春) 시각 (태양황경 315°)
// ============================================================

import { STEMS, BRANCHES, STEM_META, BRANCH_META } from "./constants";
import { getSolarTermJDE, getSolarTermKSTIso } from "./solarTerms";
import { mod } from "./jdn";
import type { Pillar } from "./types";

export interface YearPillarResult {
  pillar: Pillar;
  sajuYear: number;
  lichunJDE: number;
  lichunKSTIso: string;
}

/**
 * 년주 계산
 * @param birthJDE - 출생 시각 (JDE, UT 기준)
 * @param gregorianYear - 출생 그레고리력 연도
 */
export function getYearPillar(
  birthJDE: number,
  gregorianYear: number
): YearPillarResult {
  // 해당 연도의 입춘 JDE 계산
  const lichunJDE = getSolarTermJDE(gregorianYear, 315);
  const lichunKSTIso = getSolarTermKSTIso(gregorianYear, 315);

  // 입춘 기준으로 사주 연도 결정
  const sajuYear = birthJDE < lichunJDE ? gregorianYear - 1 : gregorianYear;

  // 년간 / 년지 인덱스
  const yearStemIndex = mod(sajuYear - 4, 10);
  const yearBranchIndex = mod(sajuYear - 4, 12);

  const stemHanja = STEMS[yearStemIndex];
  const branchHanja = BRANCHES[yearBranchIndex];
  const stemMeta = STEM_META[stemHanja];
  const branchMeta = BRANCH_META[branchHanja];

  return {
    sajuYear,
    lichunJDE,
    lichunKSTIso,
    pillar: {
      stem: {
        hanja: stemHanja,
        ko: stemMeta.ko,
        yinYang: stemMeta.yinYang,
        element: stemMeta.element,
      },
      branch: {
        hanja: branchHanja,
        ko: branchMeta.ko,
        zodiacKo: branchMeta.zodiacKo,
        yinYang: branchMeta.yinYang,
        element: branchMeta.element,
      },
      ganji: stemHanja + branchHanja,
      ganjiKo: stemMeta.ko + branchMeta.ko,
    },
  };
}
