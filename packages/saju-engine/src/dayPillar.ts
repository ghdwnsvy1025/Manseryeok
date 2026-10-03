// ============================================================
// 일주(日柱) 계산
// 기준: Julian Day Number 기반 60갑자 순환
// 검증 기준: JDN 2458511 (2019-01-27) = 甲子 (index 0)
// ============================================================

import { STEMS, BRANCHES, STEM_META, BRANCH_META } from "./constants";
import { gregorianToJdn, mod } from "./jdn";
import type { Pillar, DayChangeRule } from "./types";

export interface DayPillarResult {
  pillar: Pillar;
  ganjiIndex: number;
  stemIndex: number;
  branchIndex: number;
  jdn: number;
  effectiveDate: string; // YYYY-MM-DD (KST)
}

/**
 * 야자시(夜子時) 적용 시 다음 날 일주를 사용하므로 실효 날짜 계산
 * @param kstDate - 출생 KST 날짜 YYYY-MM-DD
 * @param kstHour - 출생 KST 시 (0-23)
 * @param rule - "midnight" | "ziHour"
 */
export function getEffectiveDateForDayPillar(
  year: number,
  month: number,
  day: number,
  kstHour: number,
  rule: DayChangeRule
): { year: number; month: number; day: number } {
  if (rule === "ziHour" && kstHour >= 23) {
    // 다음 날 날짜로 이동
    const d = new Date(year, month - 1, day + 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  return { year, month, day };
}

/**
 * 일주 계산
 * @param year, month, day - KST 출생 날짜
 * @param kstHour - KST 시 (야자시 판단용)
 * @param rule - 일주 변경 기준
 */
export function getDayPillar(
  year: number,
  month: number,
  day: number,
  kstHour: number,
  rule: DayChangeRule
): DayPillarResult {
  const effective = getEffectiveDateForDayPillar(year, month, day, kstHour, rule);
  const jdn = gregorianToJdn(effective.year, effective.month, effective.day);

  // 기준: JDN 2458511 (2019-01-27) = 甲子 (index 0)
  // mod(2458511 - 11, 60) = mod(2458500, 60) = 0 ✓
  const ganjiIndex = mod(jdn - 11, 60);
  const stemIndex = ganjiIndex % 10;
  const branchIndex = ganjiIndex % 12;

  const stemHanja = STEMS[stemIndex];
  const branchHanja = BRANCHES[branchIndex];
  const stemMeta = STEM_META[stemHanja];
  const branchMeta = BRANCH_META[branchHanja];

  const pad = (n: number) => String(n).padStart(2, "0");
  const effectiveDate = `${effective.year}-${pad(effective.month)}-${pad(effective.day)}`;

  return {
    ganjiIndex,
    stemIndex,
    branchIndex,
    jdn,
    effectiveDate,
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
