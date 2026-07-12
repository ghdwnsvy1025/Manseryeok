import { GANJI_60, STEM_META, BRANCH_META } from "@/lib/saju/constants";
import type { DiaryEntry } from "./types";

export type GanjiCollectionStatus = "locked" | "discovered" | "pattern";

export type GanjiCollectionEntry = {
  ganjiKo: string;
  ganjiIndex: number;
  status: GanjiCollectionStatus;
  entryCount: number;
  firstDate: string | null;
  lastDate: string | null;
  avgWellbeing: number;
  dates: string[];
};

export type CollectionSummary = {
  ganjiCollected: number;
  ganjiTotal: number;
  stemCollected: number;
  stemTotal: number;
  branchCollected: number;
  branchTotal: number;
};

function averageWellbeing(entries: DiaryEntry[]): number {
  const withAnalysis = entries.filter((e) => e.analysis !== null);
  if (withAnalysis.length === 0) return 0;
  const sum = withAnalysis.reduce((s, e) => s + e.analysis!.daily_wellbeing_score, 0);
  return Math.round(sum / withAnalysis.length);
}

export function buildGanjiCollection(entries: DiaryEntry[]): GanjiCollectionEntry[] {
  const byGanji = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = entry.dayPillar.ganjiKo;
    const list = byGanji.get(key) ?? [];
    list.push(entry);
    byGanji.set(key, list);
  }

  return GANJI_60.map((ganji, ganjiIndex) => {
    const stemKo = STEM_META[ganji[0]].ko;
    const branchKo = BRANCH_META[ganji[1]].ko;
    const ganjiKo = stemKo + branchKo;
    const matched = byGanji.get(ganjiKo) ?? [];
    const sorted = [...matched].sort((a, b) => a.date.localeCompare(b.date));

    let status: GanjiCollectionStatus = "locked";
    if (sorted.length >= 2) status = "pattern";
    else if (sorted.length === 1) status = "discovered";

    return {
      ganjiKo,
      ganjiIndex,
      status,
      entryCount: sorted.length,
      firstDate: sorted[0]?.date ?? null,
      lastDate: sorted[sorted.length - 1]?.date ?? null,
      avgWellbeing: averageWellbeing(sorted),
      dates: sorted.map((e) => e.date),
    };
  });
}

export function getCollectionSummary(entries: DiaryEntry[]): CollectionSummary {
  const collection = buildGanjiCollection(entries);
  const stems = new Set<string>();
  const branches = new Set<string>();
  let ganjiCollected = 0;

  for (const entry of entries) {
    stems.add(entry.dayPillar.stem.ko);
    branches.add(entry.dayPillar.branch.ko);
  }

  for (const item of collection) {
    if (item.status !== "locked") ganjiCollected++;
  }

  return {
    ganjiCollected,
    ganjiTotal: 60,
    stemCollected: stems.size,
    stemTotal: 10,
    branchCollected: branches.size,
    branchTotal: 12,
  };
}

export function getCollectedGanjiIndices(entries: DiaryEntry[]): Set<number> {
  const indices = new Set<number>();
  for (const entry of entries) {
    indices.add(entry.dayPillar.ganjiIndex);
  }
  return indices;
}
