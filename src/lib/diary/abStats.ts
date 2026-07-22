import { filterRealEntries } from "./dataOrigin";
import type { DiaryEntry, SajuProfile } from "./types";
import { STEMS, STEM_META, BRANCHES, BRANCH_META } from "@/lib/saju/constants";
import { getTenGod, type TenGod } from "@/lib/saju/hiddenStems";

export type AbReactionStats = {
  key: string;
  label: string;
  entryCount: number;
  uniqueDays: number;
  avgHappiness: number | null;
  avgEnergy: number | null;
  avgFocus: number | null;
  avgCondition: number | null;
  topEmotions: string[];
  topTags: string[];
  insufficient: boolean;
};

const INSUFFICIENT_THRESHOLD = 2;

function avg(
  values: Array<number | null | undefined>
): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function topCounts(items: string[], limit = 3): string[] {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item) continue;
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function uniqueDays(entries: DiaryEntry[]): number {
  return new Set(entries.map((e) => e.date)).size;
}

function toReaction(key: string, label: string, entries: DiaryEntry[]): AbReactionStats {
  const days = uniqueDays(entries);
  return {
    key,
    label,
    entryCount: entries.length,
    uniqueDays: days,
    avgHappiness: avg(entries.map((e) => e.happinessRating)),
    avgEnergy: avg(entries.map((e) => e.energyRating)),
    avgFocus: avg(entries.map((e) => e.focusRating)),
    avgCondition: avg(entries.map((e) => e.conditionRating)),
    topEmotions: topCounts(entries.flatMap((e) => e.emotions ?? [])),
    topTags: topCounts(entries.flatMap((e) => e.tags ?? [])),
    insufficient: days < INSUFFICIENT_THRESHOLD,
  };
}

function entryTenGod(
  entry: DiaryEntry,
  natalDayStemHanja: string | null | undefined
): TenGod | null {
  if (entry.tenGod) return entry.tenGod as TenGod;
  if (!natalDayStemHanja) return null;
  const dayStem = natalDayStemHanja as (typeof STEMS)[number];
  if (!STEMS.includes(dayStem)) return null;
  const target = entry.dayPillar.stem.hanja as (typeof STEMS)[number];
  if (!STEMS.includes(target)) return null;
  return getTenGod(dayStem, target);
}

export function aggregateByStem(entries: DiaryEntry[]): AbReactionStats[] {
  const real = filterRealEntries(entries);
  return STEMS.map((hanja) => {
    const ko = STEM_META[hanja].ko;
    const matched = real.filter(
      (e) => e.dayPillar.stem.ko === ko || e.heavenlyStem === ko
    );
    return toReaction(ko, `${ko}(${hanja})`, matched);
  });
}

export function aggregateByBranch(entries: DiaryEntry[]): AbReactionStats[] {
  const real = filterRealEntries(entries);
  return BRANCHES.map((hanja) => {
    const ko = BRANCH_META[hanja].ko;
    const matched = real.filter(
      (e) => e.dayPillar.branch.ko === ko || e.earthlyBranch === ko
    );
    return toReaction(ko, `${ko}(${hanja})`, matched);
  });
}

export function aggregateByGanji(
  entries: DiaryEntry[],
  ganjiKo: string
): AbReactionStats {
  const real = filterRealEntries(entries).filter(
    (e) => e.dayPillar.ganjiKo === ganjiKo
  );
  return toReaction(ganjiKo, `${ganjiKo}일`, real);
}

export const TEN_GOD_KEYS: TenGod[] = [
  "비견",
  "겁재",
  "식신",
  "상관",
  "정재",
  "편재",
  "정관",
  "편관",
  "정인",
  "편인",
];

export function aggregateByTenGod(
  entries: DiaryEntry[],
  sajuProfile: SajuProfile | null | undefined
): AbReactionStats[] {
  const natal = sajuProfile?.pillars.day?.stemHanja;
  const real = filterRealEntries(entries);
  return TEN_GOD_KEYS.map((god) => {
    const matched = natal
      ? real.filter((e) => entryTenGod(e, natal) === god)
      : [];
    return toReaction(god, god, matched);
  });
}

export function summarizeGanjiReactionLine(stats: AbReactionStats): string {
  if (stats.uniqueDays === 0) {
    return `아직 ${stats.label} 기록이 없어요. 결론보다 다음 같은 날의 반응을 관찰해보세요.`;
  }
  if (stats.insufficient) {
    return `아직 ${stats.label} 기록이 ${stats.uniqueDays}일뿐이에요. 결론을 내리기보다 다음 반응을 함께 관찰해보세요.`;
  }
  const parts: string[] = [`기록 ${stats.uniqueDays}일`];
  if (stats.avgHappiness != null) parts.push(`행복 ${stats.avgHappiness}`);
  if (stats.avgEnergy != null) parts.push(`에너지 ${stats.avgEnergy}`);
  if (stats.topTags[0]) parts.push(`태그 ${stats.topTags.slice(0, 2).join(", ")}`);
  return parts.join(" · ");
}
