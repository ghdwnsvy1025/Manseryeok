import { BRANCH_META, STEM_META } from "@/lib/saju/constants";
import { calculateSaju } from "@/lib/saju/calculator";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import {
  hasDiarySajuProfile,
  type SajuSettings,
} from "@/lib/diary/sajuSettings";

export type FortunePillarTenGods = {
  stemTenGod: TenGod;
  branchTenGod: TenGod;
};

export type CurrentDaeunPillar = {
  ganji: string;
  ganjiKo: string;
  stemHanja: string;
  branchHanja: string;
  stemTenGod: TenGod;
  branchTenGod: TenGod;
};

export type DiarySajuFortune = {
  dayStemHanja: StemHanja;
  daeun: CurrentDaeunPillar | null;
};

function branchTenGod(dayStem: StemHanja, branchHanja: string): TenGod {
  const hidden = getHiddenStemsByBranch(branchHanja);
  const main = hidden.find((s) => s.role === "main") ?? hidden[hidden.length - 1];
  return getTenGod(dayStem, main.stem);
}

export function getPillarTenGods(
  dayStemHanja: string,
  stemHanja: string,
  branchHanja: string
): FortunePillarTenGods | null {
  try {
    const dayStem = dayStemHanja as StemHanja;
    return {
      stemTenGod: getTenGod(dayStem, stemHanja as StemHanja),
      branchTenGod: branchTenGod(dayStem, branchHanja),
    };
  } catch {
    return null;
  }
}

/** 프로필 사주 기준 일간 + 현재 시점 대운 */
export function resolveDiarySajuFortune(
  settings: SajuSettings,
  asOf: Date = new Date()
): DiarySajuFortune | null {
  if (!hasDiarySajuProfile(settings) || !settings.birthDate || !settings.gender) {
    return null;
  }

  const [year, month, day] = settings.birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;

  try {
    const result = calculateSaju({
      year,
      month,
      day,
      hour: settings.birthHour,
      minute: settings.birthMinute,
      gender: settings.gender,
      options: {
        calendarType: "solar",
        timezone: "Asia/Seoul",
        dayChangeRule: "midnight",
        timeCorrection: "none",
      },
    });

    const dayStemHanja = result.pillars.day.stem.hanja as StemHanja;
    const now = asOf.getTime();
    const cycle = result.daeun.cycles.find((c) => {
      if (!c.estimatedStartDate || !c.estimatedEndDate) return false;
      const start = new Date(c.estimatedStartDate).getTime();
      const end = new Date(c.estimatedEndDate).getTime();
      return now >= start && now < end;
    });

    if (!cycle) {
      return { dayStemHanja, daeun: null };
    }

    const stemHanja = cycle.ganji[0];
    const branchHanja = cycle.ganji[1];
    const stemMeta = STEM_META[stemHanja];
    const branchMeta = BRANCH_META[branchHanja];
    if (!stemMeta || !branchMeta) {
      return { dayStemHanja, daeun: null };
    }

    return {
      dayStemHanja,
      daeun: {
        ganji: cycle.ganji,
        ganjiKo: stemMeta.ko + branchMeta.ko,
        stemHanja,
        branchHanja,
        stemTenGod: getTenGod(dayStemHanja, stemHanja as StemHanja),
        branchTenGod: branchTenGod(dayStemHanja, branchHanja),
      },
    };
  } catch {
    return null;
  }
}
