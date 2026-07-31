/**
 * 대운·세운(년주)·월운·일운 재료 — 있으면 LLM에 넣고, 없으면 생략.
 */
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  getPillarTenGods,
  resolveDiarySajuFortune,
} from "@/lib/diary/currentDaeun";
import type { SajuProfile } from "@/lib/diary/types";
import type { SajuSettings } from "@/lib/diary/sajuSettings";
import { getTenGod, type StemHanja } from "@/lib/saju/hiddenStems";

export type FortuneLuckSlot = {
  ganjiKo: string;
  stemTenGod: string | null;
  branchTenGod: string | null;
};

export type FortuneLuckMaterials = {
  daeun: FortuneLuckSlot | null;
  /** 해당 연도의 년주 ≈ 세운 근사 */
  sewoon: FortuneLuckSlot | null;
  /** 해당 월의 월주 ≈ 월운 근사 */
  wolun: FortuneLuckSlot | null;
  /** 오늘 일주 = 일운 */
  ilun: {
    ganjiKo: string;
    stemTenGod: string | null;
  } | null;
};

function toSettings(profile: SajuProfile): SajuSettings | null {
  if (!profile.birthDate || !profile.gender) return null;
  return {
    depth: "full",
    birthDate: profile.birthDate,
    birthHour: profile.birthHour,
    birthMinute: profile.birthMinute,
    gender: profile.gender,
  };
}

function slotFromPillar(
  dayStem: StemHanja | null,
  stemHanja: string,
  branchHanja: string,
  ganjiKo: string
): FortuneLuckSlot {
  if (!dayStem) {
    return { ganjiKo, stemTenGod: null, branchTenGod: null };
  }
  const g = getPillarTenGods(dayStem, stemHanja, branchHanja);
  return {
    ganjiKo,
    stemTenGod: g?.stemTenGod ?? null,
    branchTenGod: g?.branchTenGod ?? null,
  };
}

export function buildFortuneLuckMaterials(
  eventDate: string,
  sajuProfile: SajuProfile | null | undefined
): FortuneLuckMaterials {
  const settings = sajuProfile ? toSettings(sajuProfile) : null;
  const fortune = settings
    ? resolveDiarySajuFortune(
        settings,
        new Date(`${eventDate}T12:00:00+09:00`)
      )
    : null;
  const dayStem = (fortune?.dayStemHanja ??
    sajuProfile?.pillars.day?.stemHanja ??
    null) as StemHanja | null;

  const { dayPillar, monthPillar, yearPillar } = getPillarsForDate(eventDate);

  let ilunStem: string | null = null;
  if (dayStem) {
    try {
      ilunStem = getTenGod(dayStem, dayPillar.stem.hanja as StemHanja);
    } catch {
      ilunStem = null;
    }
  }

  return {
    daeun: fortune?.daeun
      ? {
          ganjiKo: fortune.daeun.ganjiKo,
          stemTenGod: fortune.daeun.stemTenGod,
          branchTenGod: fortune.daeun.branchTenGod,
        }
      : null,
    sewoon: slotFromPillar(
      dayStem,
      yearPillar.stem.hanja,
      yearPillar.branch.hanja,
      yearPillar.ganjiKo
    ),
    wolun: slotFromPillar(
      dayStem,
      monthPillar.stem.hanja,
      monthPillar.branch.hanja,
      monthPillar.ganjiKo
    ),
    ilun: {
      ganjiKo: dayPillar.ganjiKo,
      stemTenGod: ilunStem,
    },
  };
}
