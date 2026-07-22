import type { DiaryEntry } from "@/lib/diary/types";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { addDaysToDateString } from "./tomorrowContext";

export type RecentStateSummary = {
  text: string;
  moodAvg: number | null;
  energyAvg: number | null;
  conditionAvg: number | null;
  frequentTags: string[];
  entryCount: number;
};

function avg(
  values: Array<number | null | undefined>
): number | null {
  const nums = values.filter((v): v is number => typeof v === "number");
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function summarizeRecentState(input: {
  entries: DiaryEntry[];
  todayDate: string;
  days?: number;
}): RecentStateSummary {
  const windowDays = input.days ?? 7;
  const start = addDaysToDateString(input.todayDate, -(windowDays - 1));
  const recent = filterRealEntries(input.entries).filter(
    (e) => e.date >= start && e.date <= input.todayDate
  );

  const moodAvg = avg(recent.map((e) => e.happinessRating));
  const energyAvg = avg(recent.map((e) => e.energyRating));
  const conditionAvg = avg(recent.map((e) => e.conditionRating));

  const tagCounts = new Map<string, number>();
  for (const e of recent) {
    for (const t of [...(e.tags ?? []), ...(e.emotions ?? [])]) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const frequentTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const parts: string[] = [];
  if (recent.length === 0) {
    parts.push(`최근 ${windowDays}일 기록이 아직 없습니다.`);
  } else {
    parts.push(`최근 ${windowDays}일 기록 ${recent.length}회.`);
    if (moodAvg != null) parts.push(`평균 기분 ${moodAvg}점.`);
    if (energyAvg != null) parts.push(`평균 에너지 ${energyAvg}점.`);
    if (conditionAvg != null) parts.push(`평균 컨디션 ${conditionAvg}점.`);
    if (frequentTags.length > 0) {
      parts.push(`자주 등장한 태그: ${frequentTags.slice(0, 3).join(", ")}.`);
    }
  }

  return {
    text: parts.join(" "),
    moodAvg,
    energyAvg,
    conditionAvg,
    frequentTags,
    entryCount: recent.length,
  };
}
