// ============================================================
// 월주(月柱) 계산
// 기준: 12개 절입(節入) 시각 (절기 기준, 음력 월 아님)
// ============================================================

import {
  STEMS,
  BRANCHES,
  STEM_META,
  BRANCH_META,
  MONTH_SOLAR_TERM_LONGITUDES,
  MONTH_BRANCH_INDICES,
} from "./constants";
import { SOLAR_TERM_INFO, getSolarTermJDE, getSolarTermKSTIso } from "./solarTerms";
import { mod } from "./jdn";
import type { Pillar } from "./types";

export interface MonthPillarResult {
  pillar: Pillar;
  monthNumber: number; // 1=寅, 2=卯, ..., 12=丑
  startJDE: number;
  endJDE: number;
  startTermKSTIso: string;
  endTermKSTIso: string;
  startTermName: string;
}

/**
 * 월주 계산
 * @param birthJDE   - 출생 JDE (UT 기준)
 * @param sajuYear   - 사주 연도 (입춘 기준으로 결정된 값)
 * @param yearStemIndex - 년간 인덱스 (0=甲 … 9=癸)
 */
export function getMonthPillar(
  birthJDE: number,
  sajuYear: number,
  yearStemIndex: number
): MonthPillarResult {
  // 사주 연도의 12개 절입 경계 JDE 로드
  // 순서: [입춘(315°), 경칩(345°), 청명(15°), ..., 대설(255°), 소한(285°_next), 입춘(315°_next)]
  const boundaries: number[] = [];
  const longitudes = MONTH_SOLAR_TERM_LONGITUDES; // [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285]

  for (let i = 0; i < 11; i++) {
    boundaries.push(getSolarTermJDE(sajuYear, longitudes[i]));
  }
  // 소한은 사주연도+1 그레고리력 기준 (1월에 해당)
  boundaries.push(getSolarTermJDE(sajuYear + 1, 285));
  // 다음 입춘 (경계 끝)
  boundaries.push(getSolarTermJDE(sajuYear + 1, 315));

  // 해당하는 월 구간 탐색
  let monthNumber = -1;
  for (let i = 0; i < 12; i++) {
    if (birthJDE >= boundaries[i] && birthJDE < boundaries[i + 1]) {
      monthNumber = i + 1; // 1=寅, 2=卯, ..., 12=丑
      break;
    }
  }

  if (monthNumber === -1) {
    throw new Error(
      `출생일이 절기 경계 범위를 벗어났습니다. 사주연도: ${sajuYear}년. ` +
        `해당 연도의 절기 데이터가 없거나 입력값을 확인하세요.`
    );
  }

  // 월간 계산: 년간 인덱스 기반
  // 寅월(1) 月干 = ((yearStemIdx % 5) * 2 + 2) % 10
  const firstMonthStemIndex = ((yearStemIndex % 5) * 2 + 2) % 10;
  const monthStemIndex = (firstMonthStemIndex + (monthNumber - 1)) % 10;

  // 월지 인덱스: MONTH_BRANCH_INDICES[monthNumber - 1]
  const monthBranchIndex = MONTH_BRANCH_INDICES[monthNumber - 1];

  const stemHanja = STEMS[monthStemIndex];
  const branchHanja = BRANCHES[monthBranchIndex];
  const stemMeta = STEM_META[stemHanja];
  const branchMeta = BRANCH_META[branchHanja];

  // 해당 절기 이름
  const startLon = longitudes[monthNumber <= 11 ? monthNumber - 1 : 11];
  const startTermInfo = SOLAR_TERM_INFO[startLon];

  return {
    monthNumber,
    startJDE: boundaries[monthNumber - 1],
    endJDE: boundaries[monthNumber],
    startTermKSTIso: getSolarTermKSTIso(
      monthNumber <= 11 ? sajuYear : sajuYear + 1,
      startLon
    ),
    endTermKSTIso: getSolarTermKSTIso(
      monthNumber <= 11 ? sajuYear + 1 : sajuYear + 1,
      longitudes[Math.min(monthNumber, 11)]
    ),
    startTermName: startTermInfo ? `${startTermInfo.ko}(${startTermInfo.hanja})` : "알 수 없음",
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
