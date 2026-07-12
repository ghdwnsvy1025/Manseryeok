import { getDayPillarForDate, parseDateString } from "./dayPillar";

const MAX_SCAN_DAYS = 62;

function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseDateString(dateStr);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysBetween(fromDate: string, toDate: string): number {
  const a = parseDateString(fromDate);
  const b = parseDateString(toDate);
  const msA = new Date(a.year, a.month - 1, a.day).getTime();
  const msB = new Date(b.year, b.month - 1, b.day).getTime();
  return Math.round((msB - msA) / (24 * 60 * 60 * 1000));
}

/** 오늘 이후(포함하지 않음) 가장 가까운 같은 ganjiIndex 날짜 */
export function getNextSameGanjiDate(
  fromDate: string,
  ganjiIndex: number
): { date: string; ganjiKo: string; daysUntil: number } | null {
  for (let offset = 1; offset <= MAX_SCAN_DAYS; offset++) {
    const candidate = addDays(fromDate, offset);
    try {
      const pillar = getDayPillarForDate(candidate);
      if (pillar.ganjiIndex === ganjiIndex) {
        return {
          date: candidate,
          ganjiKo: pillar.ganjiKo,
          daysUntil: offset,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/** 아직 수집하지 않은 간지 중 가장 가까운 미래 일자 */
export function getNextUncollectedGanjiDate(
  fromDate: string,
  collectedIndices: Set<number>
): { date: string; ganjiKo: string; ganjiIndex: number; daysUntil: number } | null {
  for (let offset = 1; offset <= MAX_SCAN_DAYS; offset++) {
    const candidate = addDays(fromDate, offset);
    try {
      const pillar = getDayPillarForDate(candidate);
      if (!collectedIndices.has(pillar.ganjiIndex)) {
        return {
          date: candidate,
          ganjiKo: pillar.ganjiKo,
          ganjiIndex: pillar.ganjiIndex,
          daysUntil: offset,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export { daysBetween, addDays };
