/**
 * 최근 A — 선택 6A: 최근 7일 활성 카테고리 finalScore 평균
 */
import type { CategoryCode, JournalEntry } from "./types";

function addDays(isoDate: string, delta: number): string {
  const d = new Date(`${isoDate}T12:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * asOfDate 포함 최근 `windowDays`일 구간의 카테고리별 평균 finalScore.
 * 해당 없음·미입력(final null) 제외. 날짜당 1건(이미 upsert된 대표 일기).
 */
export function computeRecentAByCategory(
  entries: JournalEntry[],
  asOfDate: string,
  enabledCodes: CategoryCode[],
  windowDays = 7
): Record<CategoryCode, number | null> {
  const start = addDays(asOfDate, -(windowDays - 1));
  const inWindow = entries.filter(
    (e) => e.entryDate >= start && e.entryDate <= asOfDate
  );

  const out = {} as Record<CategoryCode, number | null>;
  for (const code of enabledCodes) {
    const vals: number[] = [];
    for (const e of inWindow) {
      const s = e.scores.find((x) => x.categoryCode === code);
      if (!s || s.isNotApplicable || s.finalScore == null) continue;
      vals.push(s.finalScore);
    }
    out[code] =
      vals.length === 0
        ? null
        : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) /
          100;
  }
  return out;
}

/** 전체 활성 카테고리를 한 숫자로 합친 최근 A (콘텐츠용) */
export function computeRecentAOverall(
  byCategory: Record<string, number | null>
): number | null {
  const vals = Object.values(byCategory).filter(
    (v): v is number => typeof v === "number"
  );
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
}
