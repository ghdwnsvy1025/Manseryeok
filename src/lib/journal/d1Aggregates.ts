/**
 * D-1: 최종 A × 천간·지지·간지 단순 평균
 * 3A: 원본 일일 기록에서 항상 재계산 (테이블 누적 없음)
 * 한 건부터 무조건 표시 (숨기지 않음)
 */
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { getCategoryByCode } from "./categoryCatalog";
import type { CategoryCode, JournalEntry } from "./types";

export type AstroType = "heavenlyStem" | "earthlyBranch" | "ganzhi";

export type AstroCategoryAggregate = {
  astroType: AstroType;
  astroCode: string;
  /** 표시용 예: 갑(甲) */
  label: string;
  categoryCode: CategoryCode;
  categoryName: string;
  validCount: number;
  sum: number;
  average: number;
};

function dayKeys(entryDate: string): {
  stem: string;
  branch: string;
  ganzhi: string;
  stemLabel: string;
  branchLabel: string;
  ganzhiLabel: string;
} {
  const { dayPillar } = getPillarsForDate(entryDate);
  return {
    stem: dayPillar.stem.ko,
    branch: dayPillar.branch.ko,
    ganzhi: dayPillar.ganjiKo,
    stemLabel: `${dayPillar.stem.ko}(${dayPillar.stem.hanja})`,
    branchLabel: `${dayPillar.branch.ko}(${dayPillar.branch.hanja})`,
    ganzhiLabel: dayPillar.ganjiKo,
  };
}

type Acc = {
  sum: number;
  count: number;
  label: string;
  astroType: AstroType;
  astroCode: string;
  categoryCode: CategoryCode;
};

/**
 * 일기 목록 → D-1 집계.
 * 같은 날짜는 list에 1건만 있다고 가정(upsert). 여러 건이면 날짜별 최신 updatedAt만 사용.
 */
export function recomputeD1Aggregates(
  entries: JournalEntry[]
): AstroCategoryAggregate[] {
  const byDate = new Map<string, JournalEntry>();
  for (const e of entries) {
    const prev = byDate.get(e.entryDate);
    if (!prev || e.updatedAt >= prev.updatedAt) {
      byDate.set(e.entryDate, e);
    }
  }

  /** key = `${astroType}|${astroCode}|${categoryCode}` */
  const acc = new Map<string, Acc>();

  for (const entry of Array.from(byDate.values())) {
    const keys = dayKeys(entry.entryDate);
    for (const score of entry.scores) {
      if (score.isNotApplicable || score.finalScore == null) continue;
      const code = score.categoryCode;
      const v = score.finalScore;

      const triples: Array<[AstroType, string, string]> = [
        ["heavenlyStem", keys.stem, keys.stemLabel],
        ["earthlyBranch", keys.branch, keys.branchLabel],
        ["ganzhi", keys.ganzhi, keys.ganzhiLabel],
      ];

      for (const [astroType, astroCode, label] of triples) {
        const mapKey = `${astroType}|${astroCode}|${code}`;
        const prev = acc.get(mapKey);
        if (prev) {
          prev.sum += v;
          prev.count += 1;
        } else {
          acc.set(mapKey, {
            astroType,
            astroCode,
            categoryCode: code,
            sum: v,
            count: 1,
            label,
          });
        }
      }
    }
  }

  const out: AstroCategoryAggregate[] = [];
  for (const row of Array.from(acc.values())) {
    out.push({
      astroType: row.astroType,
      astroCode: row.astroCode,
      label: row.label,
      categoryCode: row.categoryCode,
      categoryName: getCategoryByCode(row.categoryCode)?.name ?? row.categoryCode,
      validCount: row.count,
      sum: row.sum,
      average: Math.round((row.sum / row.count) * 100) / 100,
    });
  }

  return out.sort((a, b) => {
    if (a.astroType !== b.astroType) return a.astroType.localeCompare(b.astroType);
    if (a.astroCode !== b.astroCode) return a.astroCode.localeCompare(b.astroCode);
    return a.categoryCode.localeCompare(b.categoryCode);
  });
}

/** 오늘 천간·지지·간지 D 값을 카테고리별로 합성 (콘텐츠용 2순위) */
export function resolveD1ForToday(
  aggregates: AstroCategoryAggregate[],
  todayDate: string,
  categoryCode: CategoryCode
): number | null {
  const keys = dayKeys(todayDate);
  const vals: number[] = [];
  for (const a of aggregates) {
    if (a.categoryCode !== categoryCode) continue;
    if (
      (a.astroType === "heavenlyStem" && a.astroCode === keys.stem) ||
      (a.astroType === "earthlyBranch" && a.astroCode === keys.branch) ||
      (a.astroType === "ganzhi" && a.astroCode === keys.ganzhi)
    ) {
      vals.push(a.average);
    }
  }
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 100) / 100;
}

export function bestWorstCategories(
  entries: JournalEntry[],
  fromDate: string,
  toDate: string,
  enabledCodes: CategoryCode[]
): {
  best: { code: CategoryCode; average: number } | null;
  worst: { code: CategoryCode; average: number } | null;
} {
  const inRange = entries.filter(
    (e) => e.entryDate >= fromDate && e.entryDate <= toDate
  );
  const avgs: Array<{ code: CategoryCode; average: number }> = [];
  for (const code of enabledCodes) {
    const vals: number[] = [];
    for (const e of inRange) {
      const s = e.scores.find((x) => x.categoryCode === code);
      if (!s || s.isNotApplicable || s.finalScore == null) continue;
      vals.push(s.finalScore);
    }
    if (vals.length === 0) continue;
    avgs.push({
      code,
      average:
        Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    });
  }
  if (avgs.length === 0) return { best: null, worst: null };
  const sorted = [...avgs].sort((a, b) => b.average - a.average);
  return { best: sorted[0]!, worst: sorted[sorted.length - 1]! };
}
