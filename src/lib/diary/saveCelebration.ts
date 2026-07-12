import { getCollectionSummary } from "./collection";
import type { DiaryEntry } from "./types";

export type SaveCelebration =
  | { type: "first_ever"; ganjiKo: string; wellbeing: number | null }
  | { type: "new_ganji"; ganjiKo: string; totalCollected: number; wellbeing: number | null }
  | { type: "new_stem"; stemKo: string; ganjiKo: string; wellbeing: number | null }
  | { type: "new_branch"; branchKo: string; ganjiKo: string; wellbeing: number | null }
  | { type: "ganji_repeat"; ganjiKo: string; count: number; wellbeing: number | null };

function hadGanji(entries: DiaryEntry[], ganjiKo: string, excludeDate?: string): boolean {
  return entries.some(
    (e) => e.dayPillar.ganjiKo === ganjiKo && e.date !== excludeDate
  );
}

function hadStem(entries: DiaryEntry[], stemKo: string, excludeDate?: string): boolean {
  return entries.some(
    (e) => e.dayPillar.stem.ko === stemKo && e.date !== excludeDate
  );
}

function hadBranch(entries: DiaryEntry[], branchKo: string, excludeDate?: string): boolean {
  return entries.some(
    (e) => e.dayPillar.branch.ko === branchKo && e.date !== excludeDate
  );
}

export function computeSaveCelebration(
  entriesBeforeSave: DiaryEntry[],
  savedEntry: DiaryEntry
): SaveCelebration | null {
  const wellbeing = savedEntry.analysis?.daily_wellbeing_score ?? null;
  const { ganjiKo, stem, branch } = savedEntry.dayPillar;
  const excludeDate = savedEntry.date;

  const others = entriesBeforeSave.filter((e) => e.id !== savedEntry.id);

  if (others.length === 0) {
    return { type: "first_ever", ganjiKo, wellbeing };
  }

  const isNewGanji = !hadGanji(others, ganjiKo, excludeDate);
  const isNewStem = !hadStem(others, stem.ko, excludeDate);
  const isNewBranch = !hadBranch(others, branch.ko, excludeDate);

  if (isNewGanji) {
    const allWithNew = [...others.filter((e) => e.date !== excludeDate), savedEntry];
    const summary = getCollectionSummary(allWithNew);
    return {
      type: "new_ganji",
      ganjiKo,
      totalCollected: summary.ganjiCollected,
      wellbeing,
    };
  }

  if (isNewStem) {
    return { type: "new_stem", stemKo: stem.ko, ganjiKo, wellbeing };
  }

  if (isNewBranch) {
    return { type: "new_branch", branchKo: branch.ko, ganjiKo, wellbeing };
  }

  const sameGanjiCount =
    others.filter((e) => e.dayPillar.ganjiKo === ganjiKo).length + 1;

  if (sameGanjiCount >= 2) {
    return { type: "ganji_repeat", ganjiKo, count: sameGanjiCount, wellbeing };
  }

  return null;
}
