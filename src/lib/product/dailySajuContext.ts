import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { DiaryDayPillar, SajuProfile } from "@/lib/diary/types";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import { STEMS } from "@/lib/saju/constants";
import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";

/** 날짜의 B 데이터 — A 기록과 연결되는 사주 컨텍스트 */
export type DailySajuContext = {
  date: string;
  dayPillar: DiaryDayPillar;
  stemKo: string;
  stemHanja: string;
  branchKo: string;
  branchHanja: string;
  ganji: string;
  ganjiKo: string;
  ganjiIndex: number;
  monthPillarKo: string;
  yearPillarKo: string;
  /** 사용자 일간 기준 십신 (프로필 없으면 null) */
  tenGod: TenGod | null;
  relationLabels: string[];
};

export function buildDailySajuContext(
  date: string,
  sajuProfile?: SajuProfile | null
): DailySajuContext {
  const { dayPillar, monthPillarKo, yearPillarKo } = getPillarsForDate(date);
  const natal = sajuProfile?.pillars.day;
  let tenGod: TenGod | null = null;
  const relationLabels: string[] = [];

  if (natal?.stemHanja && STEMS.includes(natal.stemHanja as (typeof STEMS)[number])) {
    const todayStem = dayPillar.stem.hanja as (typeof STEMS)[number];
    if (STEMS.includes(todayStem)) {
      tenGod = getTenGod(natal.stemHanja as (typeof STEMS)[number], todayStem);
    }
    if (natal.branchHanja) {
      const relations = detectDayRelations({
        natalStemHanja: natal.stemHanja,
        natalBranchHanja: natal.branchHanja,
        todayStemHanja: dayPillar.stem.hanja,
        todayBranchHanja: dayPillar.branch.hanja,
      });
      for (const r of relations) {
        relationLabels.push(r.label);
      }
    }
  }

  return {
    date,
    dayPillar,
    stemKo: dayPillar.stem.ko,
    stemHanja: dayPillar.stem.hanja,
    branchKo: dayPillar.branch.ko,
    branchHanja: dayPillar.branch.hanja,
    ganji: dayPillar.ganji,
    ganjiKo: dayPillar.ganjiKo,
    ganjiIndex: dayPillar.ganjiIndex,
    monthPillarKo,
    yearPillarKo,
    tenGod,
    relationLabels,
  };
}

/** 모드별 B 연결 안내 문구 */
export function formatBLinkCopy(
  ctx: DailySajuContext,
  plainLanguage: boolean
): string {
  if (plainLanguage) {
    return `이 기록은 오늘의 흐름 정보(${ctx.ganjiKo}일)와 자동으로 연결됩니다.`;
  }
  const ten = ctx.tenGod ? ` · 십신 ${ctx.tenGod}` : "";
  return `이 기록은 ${ctx.ganjiKo}일(천간 ${ctx.stemKo} · 지지 ${ctx.branchKo}${ten})과 연결됩니다.`;
}
