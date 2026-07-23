/**
 * 콘텐츠용 D 값 결정 (§14)
 * 1) 검증된 Ridge 예측
 * 2) D-1 천간·지지·간지 단순 평균 합성
 * 3) 없음 → null (0으로 채우지 않음)
 */
import {
  recomputeD1Aggregates,
  resolveD1ForToday,
} from "./d1Aggregates";
import {
  computeRecentAByCategory,
  computeRecentAOverall,
} from "./recentA";
import type { CategoryCode, JournalEntry } from "./types";

export type ContentDSource = "ridge" | "d1" | "none";

export type CategoryContentD = {
  categoryCode: CategoryCode;
  value: number | null;
  source: ContentDSource;
};

export type ContentScoreBundle = {
  /** 카테고리별 D */
  dByCategory: Record<CategoryCode, CategoryContentD>;
  /** 카테고리별 최근 7일 A */
  recentAByCategory: Record<CategoryCode, number | null>;
  /** 콘텐츠용 결합 점수: (recentA + D)/2 등 */
  contentScoreByCategory: Record<
    CategoryCode,
    { value: number | null; mode: "a_and_d" | "d_only" | "a_only" | "none" }
  >;
  recentAOverall: number | null;
};

export type RidgePredictionMap = Partial<
  Record<CategoryCode, number | null>
>;

export function resolveCategoryD(opts: {
  categoryCode: CategoryCode;
  todayDate: string;
  entries: JournalEntry[];
  ridgePrediction?: number | null;
}): CategoryContentD {
  if (
    opts.ridgePrediction != null &&
    Number.isFinite(opts.ridgePrediction)
  ) {
    return {
      categoryCode: opts.categoryCode,
      value: Math.round(opts.ridgePrediction * 100) / 100,
      source: "ridge",
    };
  }

  const aggregates = recomputeD1Aggregates(opts.entries);
  const d1 = resolveD1ForToday(
    aggregates,
    opts.todayDate,
    opts.categoryCode
  );
  if (d1 != null) {
    return {
      categoryCode: opts.categoryCode,
      value: d1,
      source: "d1",
    };
  }

  return {
    categoryCode: opts.categoryCode,
    value: null,
    source: "none",
  };
}

/** (최근 A + D) / 2 — 한쪽만 있으면 그쪽만 (§15) */
export function combineRecentAAndD(
  recentA: number | null,
  d: number | null
): { value: number | null; mode: "a_and_d" | "d_only" | "a_only" | "none" } {
  if (recentA != null && d != null) {
    return {
      value: Math.round(((recentA + d) / 2) * 100) / 100,
      mode: "a_and_d",
    };
  }
  if (d != null) return { value: d, mode: "d_only" };
  if (recentA != null) return { value: recentA, mode: "a_only" };
  return { value: null, mode: "none" };
}

export function buildContentScoreBundle(opts: {
  entries: JournalEntry[];
  todayDate: string;
  enabledCodes: CategoryCode[];
  ridgeByCategory?: RidgePredictionMap;
}): ContentScoreBundle {
  const recentAByCategory = computeRecentAByCategory(
    opts.entries,
    opts.todayDate,
    opts.enabledCodes,
    7
  );

  const dByCategory = {} as Record<CategoryCode, CategoryContentD>;
  const contentScoreByCategory = {} as ContentScoreBundle["contentScoreByCategory"];

  for (const code of opts.enabledCodes) {
    const d = resolveCategoryD({
      categoryCode: code,
      todayDate: opts.todayDate,
      entries: opts.entries,
      ridgePrediction: opts.ridgeByCategory?.[code],
    });
    dByCategory[code] = d;
    contentScoreByCategory[code] = combineRecentAAndD(
      recentAByCategory[code] ?? null,
      d.value
    );
  }

  return {
    dByCategory,
    recentAByCategory,
    contentScoreByCategory,
    recentAOverall: computeRecentAOverall(recentAByCategory),
  };
}

/** 최근 7일 추이: 전반 3일 vs 후반 4일 평균 차이 */
export function computeRecentATrend(
  entries: JournalEntry[],
  asOfDate: string,
  enabledCodes: CategoryCode[]
): { delta: number | null; direction: "up" | "down" | "flat" | "unknown" } {
  const early = computeRecentAByCategory(
    entries,
    shiftDate(asOfDate, -4),
    enabledCodes,
    3
  );
  const late = computeRecentAByCategory(
    entries,
    asOfDate,
    enabledCodes,
    4
  );
  const a = computeRecentAOverall(early);
  const b = computeRecentAOverall(late);
  if (a == null || b == null) {
    return { delta: null, direction: "unknown" };
  }
  const delta = Math.round((b - a) * 100) / 100;
  if (Math.abs(delta) < 0.15) return { delta, direction: "flat" };
  return { delta, direction: delta > 0 ? "up" : "down" };
}

function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
