/**
 * 원국 종합풀이용 계산 재료 (해석 문장 없음)
 */
import { createHash } from "node:crypto";
import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuProfile } from "@/lib/diary/types";
import type { SajuResult, Pillar, SajuInput } from "@/lib/saju/types";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import { BRANCH_META, STEM_META, type Element } from "@/lib/saju/constants";

/** 서버 안전 — profileStorage(브라우저 클라) 의존 없이 입력 구성 */
function sajuInputFromProfile(profile: SajuProfile): SajuInput {
  const [year, month, day] = profile.birthDate.split("-").map(Number);
  const hasTime =
    !profile.birthTimeUnknown &&
    profile.birthHour !== undefined &&
    profile.birthMinute !== undefined;

  return {
    year,
    month,
    day,
    hour: hasTime ? profile.birthHour : undefined,
    minute: hasTime ? profile.birthMinute : undefined,
    gender: profile.gender,
    options: {
      calendarType: "solar",
      isLeapMonth: false,
      timezone: profile.timezone || "Asia/Seoul",
      dayChangeRule: profile.dayChangeRule,
      timeCorrection: profile.timeCorrection,
      location:
        profile.locationName || profile.longitude !== undefined
          ? {
              name: profile.locationName,
              longitude: profile.longitude,
              latitude: profile.latitude,
            }
          : {
              name: "대한민국, 서울",
              longitude: 126.98,
              latitude: 37.57,
            },
    },
  };
}

export const NATAL_READING_MATERIALS_VERSION = "natal-materials-v1.0.0";

export type NatalPillarMaterial = {
  slot: "year" | "month" | "day" | "hour";
  slotKo: string;
  ganji: string;
  ganjiKo: string;
  stemHanja: string;
  stemKo: string;
  branchHanja: string;
  branchKo: string;
  stemElement: Element | null;
  branchElement: Element | null;
  stemTenGod: TenGod | null;
  branchTenGod: TenGod | null;
  hidden: Array<{
    stem: string;
    role: string;
    tenGod: TenGod | null;
  }>;
};

export type NatalDaeunCycleMaterial = {
  order: number;
  ganji: string;
  ganjiKo: string;
  stemTenGod: TenGod | null;
  branchTenGod: TenGod | null;
  start: string | null;
  end: string | null;
  isCurrent: boolean;
};

export type NatalReadingMaterials = {
  version: string;
  birth: {
    birthDate: string;
    birthHour: number | null;
    birthMinute: number | null;
    gender: string | null;
    timezone: string;
    locationName: string | null;
  };
  dayMaster: {
    hanja: string;
    ko: string;
    element: Element | null;
    yinYang: string | null;
  };
  pillars: {
    year: NatalPillarMaterial;
    month: NatalPillarMaterial;
    day: NatalPillarMaterial;
    hour: NatalPillarMaterial | null;
  };
  elementCounts: Partial<Record<Element, number>>;
  daeun: {
    direction: string;
    startAgeYears: number;
    cycles: NatalDaeunCycleMaterial[];
    current: NatalDaeunCycleMaterial | null;
    previous: NatalDaeunCycleMaterial | null;
    next: NatalDaeunCycleMaterial | null;
  };
};

function pillarMaterial(
  slot: NatalPillarMaterial["slot"],
  slotKo: string,
  pillar: Pillar,
  dayStem: StemHanja
): NatalPillarMaterial {
  const hidden = getHiddenStemsByBranch(pillar.branch.hanja);
  const main = hidden.find((s) => s.role === "main") ?? hidden[hidden.length - 1];
  let stemTenGod: TenGod | null = null;
  let branchTenGod: TenGod | null = null;
  try {
    stemTenGod = getTenGod(dayStem, pillar.stem.hanja as StemHanja);
  } catch {
    stemTenGod = null;
  }
  try {
    if (main) branchTenGod = getTenGod(dayStem, main.stem);
  } catch {
    branchTenGod = null;
  }
  return {
    slot,
    slotKo,
    ganji: pillar.ganji,
    ganjiKo: pillar.ganjiKo,
    stemHanja: pillar.stem.hanja,
    stemKo: pillar.stem.ko,
    branchHanja: pillar.branch.hanja,
    branchKo: pillar.branch.ko,
    stemElement: STEM_META[pillar.stem.hanja]?.element ?? null,
    branchElement: BRANCH_META[pillar.branch.hanja]?.element ?? null,
    stemTenGod,
    branchTenGod,
    hidden: hidden.map((h) => {
      let tenGod: TenGod | null = null;
      try {
        tenGod = getTenGod(dayStem, h.stem);
      } catch {
        tenGod = null;
      }
      return { stem: h.stem, role: h.role, tenGod };
    }),
  };
}

function countElements(result: SajuResult): Partial<Record<Element, number>> {
  const counts: Partial<Record<Element, number>> = {};
  const add = (el: Element | undefined) => {
    if (!el) return;
    counts[el] = (counts[el] ?? 0) + 1;
  };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = result.pillars[key];
    if (!p) continue;
    add(STEM_META[p.stem.hanja]?.element);
    add(BRANCH_META[p.branch.hanja]?.element);
  }
  return counts;
}

function buildFromResult(
  result: SajuResult,
  birthMeta: NatalReadingMaterials["birth"]
): NatalReadingMaterials {
  const dayPillar = result.pillars.day;
  const dayStem = dayPillar.stem.hanja as StemHanja;
  const now = Date.now();

  const cycles: NatalDaeunCycleMaterial[] = result.daeun.cycles.map((c) => {
    const stemH = c.ganji[0];
    const branchH = c.ganji[1];
    let stemTenGod: TenGod | null = null;
    let branchTenGod: TenGod | null = null;
    try {
      stemTenGod = getTenGod(dayStem, stemH as StemHanja);
    } catch {
      /* */
    }
    try {
      const hidden = getHiddenStemsByBranch(branchH);
      const main = hidden.find((s) => s.role === "main") ?? hidden[hidden.length - 1];
      if (main) branchTenGod = getTenGod(dayStem, main.stem);
    } catch {
      /* */
    }
    const start = c.estimatedStartDate;
    const end = c.estimatedEndDate;
    const isCurrent = Boolean(
      start &&
        end &&
        now >= new Date(start).getTime() &&
        now < new Date(end).getTime()
    );
    return {
      order: c.order,
      ganji: c.ganji,
      ganjiKo:
        (STEM_META[stemH]?.ko || "") + (BRANCH_META[branchH]?.ko || ""),
      stemTenGod,
      branchTenGod,
      start,
      end,
      isCurrent,
    };
  });

  const currentIdx = cycles.findIndex((c) => c.isCurrent);
  const current = currentIdx >= 0 ? cycles[currentIdx]! : null;
  const previous =
    currentIdx > 0 ? cycles[currentIdx - 1]! : currentIdx === -1 ? null : null;
  const next =
    currentIdx >= 0 && currentIdx < cycles.length - 1
      ? cycles[currentIdx + 1]!
      : null;

  return {
    version: NATAL_READING_MATERIALS_VERSION,
    birth: birthMeta,
    dayMaster: {
      hanja: dayStem,
      ko: dayPillar.stem.ko,
      element: STEM_META[dayStem]?.element ?? null,
      yinYang: STEM_META[dayStem]?.yinYang ?? null,
    },
    pillars: {
      year: pillarMaterial("year", "연주", result.pillars.year, dayStem),
      month: pillarMaterial("month", "월주", result.pillars.month, dayStem),
      day: pillarMaterial("day", "일주", result.pillars.day, dayStem),
      hour: result.pillars.hour
        ? pillarMaterial("hour", "시주", result.pillars.hour, dayStem)
        : null,
    },
    elementCounts: countElements(result),
    daeun: {
      direction: result.daeun.directionText,
      startAgeYears: result.daeun.startAge.years,
      cycles: cycles.slice(0, 8),
      current,
      previous,
      next,
    },
  };
}

export function buildNatalReadingMaterialsFromResult(
  result: SajuResult
): NatalReadingMaterials {
  const orig = result.input.original;
  return buildFromResult(result, {
    birthDate: result.input.normalizedSolarDate,
    birthHour: orig.hour ?? null,
    birthMinute: orig.minute ?? null,
    gender: orig.gender ?? null,
    timezone: result.input.timezone,
    locationName: orig.options.location?.name ?? null,
  });
}

export function buildNatalReadingMaterialsFromProfile(
  profile: SajuProfile
): NatalReadingMaterials {
  const result = calculateSaju(sajuInputFromProfile(profile));
  return buildFromResult(result, {
    birthDate: profile.birthDate,
    birthHour: profile.birthTimeUnknown ? null : profile.birthHour ?? null,
    birthMinute: profile.birthTimeUnknown ? null : profile.birthMinute ?? null,
    gender: profile.gender ?? null,
    timezone: profile.timezone || "Asia/Seoul",
    locationName: profile.locationName ?? null,
  });
}

export function buildNatalReadingMaterialsFromInput(
  input: SajuInput
): NatalReadingMaterials {
  const result = calculateSaju(input);
  return buildNatalReadingMaterialsFromResult(result);
}

/** 캐시 키 — 생년월일시·성별·계산버전 */
export function natalReadingInputHash(profile: {
  birthDate: string;
  birthHour?: number | null;
  birthMinute?: number | null;
  birthTimeUnknown?: boolean;
  gender?: string | null;
  calculationVersion?: string;
}): string {
  const hour = profile.birthTimeUnknown ? "x" : String(profile.birthHour ?? "x");
  const minute = profile.birthTimeUnknown
    ? "x"
    : String(profile.birthMinute ?? "x");
  const raw = [
    profile.birthDate,
    hour,
    minute,
    profile.gender ?? "",
    profile.calculationVersion ?? "0.1.0",
    NATAL_READING_MATERIALS_VERSION,
  ].join("|");
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
