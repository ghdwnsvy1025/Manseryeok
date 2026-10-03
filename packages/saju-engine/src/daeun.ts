import {
  BRANCHES,
  BRANCH_META,
  GANJI_60,
  MONTH_SOLAR_TERM_LONGITUDES,
  STEMS,
  STEM_META,
} from "./constants";
import { mod } from "./jdn";
import { getSolarTermKSTIso, SOLAR_TERM_INFO } from "./solarTerms";

/** 대운 1주기(약 10년)에 대응하는 년운(세운) 한 해 */
export type SewoonYear = {
  year: number;
  ganji: string;
  ganjiKo: string;
};

export type Gender = "male" | "female";
export type LuckDirection = "forward" | "backward";
export type DaeunDirectionBasis = "yearStem";
export type DaeunTermMode = "majorJieOnly";
export type DaeunAgeCalculationMode = "exactTraditional360";
export type DaeunRoundingMode = "none" | "roundYear" | "floorYear" | "ceilYear";

export type SolarTerm = {
  nameKo: string;
  nameHanja: string;
  datetime: string;
};

export type DaeunOptions = {
  directionBasis: DaeunDirectionBasis;
  termMode: DaeunTermMode;
  ageCalculationMode: DaeunAgeCalculationMode;
  roundingMode: DaeunRoundingMode;
  numberOfCycles: number;
};

export type CalculateDaeunInput = {
  birthDateTime: string;
  gender: Gender;
  pillars: {
    year: {
      stem: { hanja: string };
      branch: { hanja: string };
      ganji: string;
    };
    month: {
      stem: { hanja: string };
      branch: { hanja: string };
      ganji: string;
    };
    day: unknown;
    hour: unknown;
  };
  solarTerms: SolarTerm[];
  options?: Partial<DaeunOptions>;
};

export type DaeunStartAge = {
  decimalYears: number;
  years: number;
  months: number;
  days: number;
  totalTraditionalDays: number;
};

export type DaeunCycle = {
  order: number;
  ganji: string;
  startAgeDecimal: number;
  endAgeDecimal: number;
  startAgeText: string;
  endAgeText: string;
  displayStartAge: number | null;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
};

export type DaeunResult = {
  direction: LuckDirection;
  directionText: "순행" | "역행";
  startAge: DaeunStartAge;
  targetSolarTerm: {
    nameKo: string;
    nameHanja: string;
    datetime: string;
  };
  firstStartDate: string | null;
  cycles: DaeunCycle[];
  debug: {
    gender: Gender;
    yearStem: string;
    yearStemYinYang: "yang" | "yin";
    monthPillarGanji: string;
    directionBasis: DaeunDirectionBasis;
    termMode: DaeunTermMode;
    ageCalculationMode: DaeunAgeCalculationMode;
    roundingMode: DaeunRoundingMode;
    birthDateTime: string;
    targetTermDateTime: string;
    diffSeconds: number;
    diffDays: number;
    ruleSummary: string;
    warnings: string[];
  };
};

export const YANG_STEMS = ["甲", "丙", "戊", "庚", "壬"] as const;
export const YIN_STEMS = ["乙", "丁", "己", "辛", "癸"] as const;

export const MAJOR_JIE_TERMS = [
  "立春",
  "驚蟄",
  "清明",
  "立夏",
  "芒種",
  "小暑",
  "立秋",
  "白露",
  "寒露",
  "立冬",
  "大雪",
  "小寒",
] as const;

const DEFAULT_DAEUN_OPTIONS: DaeunOptions = {
  directionBasis: "yearStem",
  termMode: "majorJieOnly",
  ageCalculationMode: "exactTraditional360",
  roundingMode: "none",
  numberOfCycles: 10,
};

function normalizeSolarTermHanja(nameHanja: string): string {
  return nameHanja === "淸明" ? "清明" : nameHanja;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function getDaeunDirection(yearStem: string, gender: Gender): LuckDirection {
  const isYangYear = YANG_STEMS.includes(yearStem as (typeof YANG_STEMS)[number]);
  const isYinYear = YIN_STEMS.includes(yearStem as (typeof YIN_STEMS)[number]);

  if (!isYangYear && !isYinYear) {
    throw new Error(`Invalid year stem: ${yearStem}`);
  }

  if (gender === "male" && isYangYear) return "forward";
  if (gender === "female" && isYinYear) return "forward";

  return "backward";
}

export function filterMajorJieTerms(solarTerms: SolarTerm[]): SolarTerm[] {
  return solarTerms
    .filter((term) => MAJOR_JIE_TERMS.includes(normalizeSolarTermHanja(term.nameHanja) as (typeof MAJOR_JIE_TERMS)[number]))
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

export function findTargetTermForDaeun(
  birthDateTime: Date,
  direction: LuckDirection,
  solarTerms: SolarTerm[]
): SolarTerm {
  const terms = filterMajorJieTerms(solarTerms);

  if (terms.length === 0) {
    throw new Error("대운 계산에 필요한 12절 절기 데이터가 부족합니다.");
  }

  if (direction === "forward") {
    const next = terms.find((term) => new Date(term.datetime).getTime() > birthDateTime.getTime());

    if (!next) {
      throw new Error(
        "대운 계산에 필요한 다음 절기 데이터를 찾을 수 없습니다. 출생 연도 전후의 12절 절입 시각 데이터를 추가해주세요."
      );
    }

    return next;
  }

  const previousTerms = terms.filter((term) => new Date(term.datetime).getTime() < birthDateTime.getTime());
  const previous = previousTerms[previousTerms.length - 1];

  if (!previous) {
    throw new Error(
      "대운 계산에 필요한 이전 절기 데이터를 찾을 수 없습니다. 출생 연도 전후의 12절 절입 시각 데이터를 추가해주세요."
    );
  }

  return previous;
}

export function calculateDaeunStartAge(
  birthDateTime: Date,
  targetTermDateTime: Date
): DaeunStartAge {
  const diffMs = Math.abs(targetTermDateTime.getTime() - birthDateTime.getTime());
  const diffSeconds = diffMs / 1000;
  const threeDaysInSeconds = 3 * 24 * 60 * 60;

  const decimalYears = diffSeconds / threeDaysInSeconds;
  const totalTraditionalDays = decimalYears * 360;

  const years = Math.floor(totalTraditionalDays / 360);
  const remainingAfterYears = totalTraditionalDays % 360;
  const months = Math.floor(remainingAfterYears / 30);
  const days = Math.round(remainingAfterYears % 30);

  return {
    decimalYears,
    years,
    months,
    days,
    totalTraditionalDays,
  };
}

export function calculateApproxDaeunStartDate(
  birthDateTime: Date,
  startAge: DaeunStartAge
): Date {
  const result = new Date(birthDateTime);
  result.setDate(result.getDate() + Math.round(startAge.totalTraditionalDays));
  return result;
}

export function getGanjiIndex(ganji: string): number {
  const index = GANJI_60.indexOf(ganji as (typeof GANJI_60)[number]);

  if (index === -1) {
    throw new Error(`Invalid ganji: ${ganji}`);
  }

  return index;
}

export function getDaeunGanjiList(
  monthPillarGanji: string,
  direction: LuckDirection,
  count: number
): string[] {
  const monthIndex = getGanjiIndex(monthPillarGanji);
  const result: string[] = [];

  for (let i = 1; i <= count; i++) {
    const index = direction === "forward" ? mod(monthIndex + i, 60) : mod(monthIndex - i, 60);
    result.push(GANJI_60[index]);
  }

  return result;
}

export function formatStartAgeText(decimalYears: number): string {
  const totalTraditionalDays = decimalYears * 360;
  const years = Math.floor(totalTraditionalDays / 360);
  const remainingAfterYears = totalTraditionalDays % 360;
  const months = Math.floor(remainingAfterYears / 30);
  const days = Math.round(remainingAfterYears % 30);

  return `${years}년 ${months}개월 ${days}일`;
}

export function applyDisplayAgeRounding(
  ageDecimal: number,
  roundingMode: DaeunRoundingMode
): number | null {
  if (roundingMode === "none") return null;
  if (roundingMode === "roundYear") return Math.round(ageDecimal);
  if (roundingMode === "floorYear") return Math.floor(ageDecimal);
  if (roundingMode === "ceilYear") return Math.ceil(ageDecimal);

  return null;
}

export function addYearsApprox(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

export function buildDaeunCycles(params: {
  daeunGanjiList: string[];
  startAge: DaeunStartAge;
  firstStartDate: Date | null;
  roundingMode: DaeunRoundingMode;
}): DaeunCycle[] {
  const { daeunGanjiList, startAge, firstStartDate, roundingMode } = params;

  return daeunGanjiList.map((ganji, index) => {
    const startAgeDecimal = startAge.decimalYears + index * 10;
    const endAgeDecimal = startAgeDecimal + 10;

    const estimatedStartDate = firstStartDate
      ? addYearsApprox(firstStartDate, index * 10).toISOString()
      : null;

    const estimatedEndDate = firstStartDate
      ? addYearsApprox(firstStartDate, (index + 1) * 10).toISOString()
      : null;

    return {
      order: index + 1,
      ganji,
      startAgeDecimal,
      endAgeDecimal,
      startAgeText: formatStartAgeText(startAgeDecimal),
      endAgeText: formatStartAgeText(endAgeDecimal),
      displayStartAge: applyDisplayAgeRounding(startAgeDecimal, roundingMode),
      estimatedStartDate,
      estimatedEndDate,
    };
  });
}

/** 그레고리력 연도에 대응하는 년주 간지 (입춘 보정 없이 연도 표기용) */
export function getYearGanjiByGregorianYear(year: number): Pick<SewoonYear, "ganji" | "ganjiKo"> {
  const stem = STEMS[mod(year - 4, 10)];
  const branch = BRANCHES[mod(year - 4, 12)];
  return {
    ganji: stem + branch,
    ganjiKo: STEM_META[stem].ko + BRANCH_META[branch].ko,
  };
}

/**
 * 대운 주기에 해당하는 년운 10해.
 * 시작 연도부터 오름차순(오래된 해 → 최근 해).
 * UI에서는 오른쪽→왼쪽으로 증가하도록 뒤집어 표시한다.
 */
export function getSewoonYearsForDaeunCycle(cycle: DaeunCycle): SewoonYear[] {
  if (!cycle.estimatedStartDate) return [];
  const startYear = Number(cycle.estimatedStartDate.slice(0, 4));
  if (!Number.isFinite(startYear)) return [];

  return Array.from({ length: 10 }, (_, i) => {
    const year = startYear + i;
    const { ganji, ganjiKo } = getYearGanjiByGregorianYear(year);
    return { year, ganji, ganjiKo };
  });
}

export function buildMajorJieSolarTermsForDaeun(year: number): SolarTerm[] {
  const terms: SolarTerm[] = [];

  for (const targetYear of [year - 1, year, year + 1]) {
    for (const longitude of MONTH_SOLAR_TERM_LONGITUDES) {
      const info = SOLAR_TERM_INFO[longitude];
      if (!info) continue;

      terms.push({
        nameKo: info.ko,
        nameHanja: normalizeSolarTermHanja(info.hanja),
        datetime: getSolarTermKSTIso(targetYear, longitude),
      });
    }
  }

  return filterMajorJieTerms(terms);
}

export function calculateDaeun(input: CalculateDaeunInput): DaeunResult {
  const options: DaeunOptions = {
    ...DEFAULT_DAEUN_OPTIONS,
    ...input.options,
  };

  const birthDateTime = new Date(input.birthDateTime);

  if (!isValidDate(birthDateTime)) {
    throw new Error("Invalid birthDateTime.");
  }

  if (!input.gender) {
    throw new Error("Gender is required for daeun direction calculation.");
  }

  if (!input.solarTerms || input.solarTerms.length === 0) {
    throw new Error("대운 계산에 필요한 절기 데이터가 부족합니다.");
  }

  const yearStem = input.pillars.year.stem.hanja;
  const monthPillarGanji = input.pillars.month.ganji;
  const direction = getDaeunDirection(yearStem, input.gender);
  const targetTerm = findTargetTermForDaeun(birthDateTime, direction, input.solarTerms);
  const targetTermDateTime = new Date(targetTerm.datetime);

  if (!isValidDate(targetTermDateTime)) {
    throw new Error(`Invalid target solar term datetime: ${targetTerm.datetime}`);
  }

  const startAge = calculateDaeunStartAge(birthDateTime, targetTermDateTime);
  const firstStartDate = calculateApproxDaeunStartDate(birthDateTime, startAge);
  const daeunGanjiList = getDaeunGanjiList(monthPillarGanji, direction, options.numberOfCycles);
  const cycles = buildDaeunCycles({
    daeunGanjiList,
    startAge,
    firstStartDate,
    roundingMode: options.roundingMode,
  });

  const isYangYear = YANG_STEMS.includes(yearStem as (typeof YANG_STEMS)[number]);
  const diffMs = Math.abs(targetTermDateTime.getTime() - birthDateTime.getTime());
  const diffSeconds = diffMs / 1000;
  const diffDays = diffSeconds / 86400;

  return {
    direction,
    directionText: direction === "forward" ? "순행" : "역행",
    startAge,
    targetSolarTerm: {
      nameKo: targetTerm.nameKo,
      nameHanja: normalizeSolarTermHanja(targetTerm.nameHanja),
      datetime: targetTerm.datetime,
    },
    firstStartDate: firstStartDate.toISOString(),
    cycles,
    debug: {
      gender: input.gender,
      yearStem,
      yearStemYinYang: isYangYear ? "yang" : "yin",
      monthPillarGanji,
      directionBasis: options.directionBasis,
      termMode: options.termMode,
      ageCalculationMode: options.ageCalculationMode,
      roundingMode: options.roundingMode,
      birthDateTime: input.birthDateTime,
      targetTermDateTime: targetTerm.datetime,
      diffSeconds,
      diffDays,
      ruleSummary:
        direction === "forward"
          ? "양남음녀 순행 기준: 출생 후 다음 12절 절입 시각까지의 시간 차이를 3일=1년으로 환산"
          : "음남양녀 역행 기준: 출생 전 이전 12절 절입 시각까지의 시간 차이를 3일=1년으로 환산",
      warnings: [
        "대운 시작일 표기 방식은 만세력 서비스와 유파에 따라 차이가 있을 수 있습니다.",
        "내부 계산은 exactTraditional360 기준이며, 반올림은 표시용으로만 적용합니다.",
      ],
    },
  };
}
