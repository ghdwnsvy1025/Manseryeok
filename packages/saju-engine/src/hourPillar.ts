// ============================================================
// 시주(時柱) 계산
// 기준: 출생 시각의 시지(時支) + 일간(日干)
// ============================================================

import { STEMS, BRANCHES, STEM_META, BRANCH_META } from "./constants";
import { mod } from "./jdn";
import type { Pillar } from "./types";

export interface HourPillarResult {
  pillar: Pillar;
  hourBranchOrder: number; // 子=0, 丑=1, ..., 亥=11
}

/**
 * 출생 시각(KST 시, 분)으로 시지 순서 반환
 * 子시: 23:00 ~ 00:59 (= 0)
 * 丑시: 01:00 ~ 02:59 (= 1)
 * ...
 * 亥시: 21:00 ~ 22:59 (= 11)
 */
export function getHourBranchOrder(hour: number, minute: number): number {
  const totalMinutes = hour * 60 + minute;
  if (totalMinutes >= 23 * 60 || totalMinutes < 1 * 60) return 0;  // 子
  if (totalMinutes < 3  * 60) return 1;  // 丑
  if (totalMinutes < 5  * 60) return 2;  // 寅
  if (totalMinutes < 7  * 60) return 3;  // 卯
  if (totalMinutes < 9  * 60) return 4;  // 辰
  if (totalMinutes < 11 * 60) return 5;  // 巳
  if (totalMinutes < 13 * 60) return 6;  // 午
  if (totalMinutes < 15 * 60) return 7;  // 未
  if (totalMinutes < 17 * 60) return 8;  // 申
  if (totalMinutes < 19 * 60) return 9;  // 酉
  if (totalMinutes < 21 * 60) return 10; // 戌
  return 11; // 亥 (21:00 ~ 22:59)
}

/**
 * 시주 계산
 * @param dayStemIndex - 일간 인덱스 (0=甲 … 9=癸)
 * @param hour - KST 시 (0-23)
 * @param minute - KST 분 (0-59)
 */
export function getHourPillar(
  dayStemIndex: number,
  hour: number,
  minute: number
): HourPillarResult {
  const hourBranchOrder = getHourBranchOrder(hour, minute);

  // 시간 계산: 일간의 甲子시(子시 시간) 인덱스
  // 甲己일 → 甲子(0), 乙庚일 → 丙子(2), 丙辛일 → 戊子(4), 丁壬일 → 庚子(6), 戊癸일 → 壬子(8)
  const hourStemIndex = mod((dayStemIndex % 5) * 2 + hourBranchOrder, 10);
  const hourBranchIndex = hourBranchOrder;

  const stemHanja = STEMS[hourStemIndex];
  const branchHanja = BRANCHES[hourBranchIndex];
  const stemMeta = STEM_META[stemHanja];
  const branchMeta = BRANCH_META[branchHanja];

  return {
    hourBranchOrder,
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
