import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { STEMS, STEM_META } from "@/lib/saju/constants";
import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";
import type { SampleSizes } from "./types";

function stemHanjaFromKo(ko: string): (typeof STEMS)[number] | null {
  for (const stem of STEMS) {
    if (STEM_META[stem].ko === ko) return stem;
  }
  return null;
}

function entryTenGod(
  entry: DiaryEntry,
  natalDayStemHanja: string | null | undefined
): TenGod | null {
  if (!natalDayStemHanja) return null;
  const dayStem = natalDayStemHanja as (typeof STEMS)[number];
  if (!STEMS.includes(dayStem)) return null;
  const target =
    (entry.dayPillar.stem.hanja as (typeof STEMS)[number]) ||
    stemHanjaFromKo(entry.dayPillar.stem.ko);
  if (!target || !STEMS.includes(target)) return null;
  return getTenGod(dayStem, target);
}

export type SimilarDayBuckets = {
  sampleSizes: SampleSizes;
  primaryEntries: DiaryEntry[];
  primaryKind: "ganji" | "tenGod" | "stem" | "branch" | "none";
};

/**
 * 계층형 유사일 탐색: 간지 → 십신 → 천간 → 지지
 * 가장 구체적인 비어 있지 않은 버킷을 primary로 사용한다.
 */
export function findSimilarDays(input: {
  entries: DiaryEntry[];
  targetGanjiKo: string;
  targetStemKo: string;
  targetBranchKo: string;
  targetTenGod: TenGod | null;
  sajuProfile?: SajuProfile | null;
  excludeDate?: string;
}): SimilarDayBuckets {
  const natalStem = input.sajuProfile?.pillars.day?.stemHanja;
  const real = filterRealEntries(input.entries).filter(
    (e) => e.date !== input.excludeDate
  );

  const ganji = real.filter((e) => e.dayPillar.ganjiKo === input.targetGanjiKo);
  const tenGod = input.targetTenGod
    ? real.filter((e) => entryTenGod(e, natalStem) === input.targetTenGod)
    : [];
  const stem = real.filter(
    (e) =>
      e.dayPillar.stem.ko === input.targetStemKo ||
      e.heavenlyStem === input.targetStemKo
  );
  const branch = real.filter(
    (e) =>
      e.dayPillar.branch.ko === input.targetBranchKo ||
      e.earthlyBranch === input.targetBranchKo
  );

  const sampleSizes: SampleSizes = {
    ganji: ganji.length,
    tenGod: tenGod.length,
    stem: stem.length,
    branch: branch.length,
  };

  if (ganji.length > 0) {
    return { sampleSizes, primaryEntries: ganji, primaryKind: "ganji" };
  }
  if (tenGod.length > 0) {
    return { sampleSizes, primaryEntries: tenGod, primaryKind: "tenGod" };
  }
  if (stem.length > 0) {
    return { sampleSizes, primaryEntries: stem, primaryKind: "stem" };
  }
  if (branch.length > 0) {
    return { sampleSizes, primaryEntries: branch, primaryKind: "branch" };
  }
  return { sampleSizes, primaryEntries: [], primaryKind: "none" };
}

export function averageHappiness(entries: DiaryEntry[]): number | null {
  const vals = entries
    .map((e) => e.happinessRating)
    .filter((v): v is NonNullable<typeof v> => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function averageEnergy(entries: DiaryEntry[]): number | null {
  const vals = entries
    .map((e) => e.energyRating)
    .filter((v): v is NonNullable<typeof v> => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

export function topTags(entries: DiaryEntry[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const tag of e.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const emotion of e.emotions ?? []) {
      counts.set(emotion, (counts.get(emotion) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}
