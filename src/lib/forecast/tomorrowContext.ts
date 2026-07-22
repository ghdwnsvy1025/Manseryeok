import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { SajuProfile } from "@/lib/diary/types";
import { STEMS, STEM_META } from "@/lib/saju/constants";
import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import type { TraditionalFacts } from "./types";

export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function stemHanjaFromKo(ko: string): (typeof STEMS)[number] | null {
  for (const stem of STEMS) {
    if (STEM_META[stem].ko === ko) return stem;
  }
  return null;
}

export function buildTomorrowSajuContext(input: {
  todayDate: string;
  sajuProfile?: SajuProfile | null;
}): TraditionalFacts {
  const targetDate = addDaysToDateString(input.todayDate, 1);
  const pillars = getPillarsForDate(targetDate);
  const day = pillars.dayPillar;
  const natal = input.sajuProfile?.pillars.day;

  let tenGod: TenGod | null = null;
  if (natal?.stemHanja) {
    const dayStem = natal.stemHanja as (typeof STEMS)[number];
    const tomorrowStem =
      (day.stem.hanja as (typeof STEMS)[number]) ||
      stemHanjaFromKo(day.stem.ko);
    if (STEMS.includes(dayStem) && tomorrowStem && STEMS.includes(tomorrowStem)) {
      tenGod = getTenGod(dayStem, tomorrowStem);
    }
  }

  const relations =
    natal?.stemHanja && natal?.branchHanja
      ? detectDayRelations({
          natalStemHanja: natal.stemHanja,
          natalBranchHanja: natal.branchHanja,
          todayStemHanja: day.stem.hanja,
          todayBranchHanja: day.branch.hanja,
        }).map((r) => ({
          kind: r.kind,
          label: r.label,
          description: r.description,
        }))
      : [];

  return {
    targetDate,
    ganji: day.ganji,
    ganjiKo: day.ganjiKo,
    heavenlyStem: day.stem.ko,
    heavenlyStemHanja: day.stem.hanja,
    earthlyBranch: day.branch.ko,
    earthlyBranchHanja: day.branch.hanja,
    tenGod,
    relations,
    natalDayGanjiKo: natal?.ganjiKo ?? null,
  };
}
