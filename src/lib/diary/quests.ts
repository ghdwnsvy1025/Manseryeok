import { STATS_INSIGHT_MIN_ENTRIES } from "./onboarding";
import { getUniqueEntryDays } from "./stats";
import type { DiaryEntry } from "./types";

export type Quest = {
  id: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
};

export type QuestSeason = {
  title: string;
  quests: Quest[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
};

function uniqueGanjiCount(entries: DiaryEntry[]): number {
  return new Set(entries.map((e) => e.dayPillar.ganjiKo)).size;
}

/** 시즌 1: 첫 7일 여정 */
export function getSeason1Quests(entries: DiaryEntry[]): QuestSeason {
  const uniqueDays = getUniqueEntryDays(entries);
  const ganjiCount = uniqueGanjiCount(entries);
  const hasAnySave = entries.length > 0;

  const quests: Quest[] = [
    {
      id: "q1_first_save",
      label: "첫 기록 완료",
      current: hasAnySave ? 1 : 0,
      target: 1,
      completed: hasAnySave,
    },
    {
      id: "q2_three_days",
      label: "서로 다른 날 3일 기록",
      current: Math.min(uniqueDays, 3),
      target: 3,
      completed: uniqueDays >= 3,
    },
    {
      id: "q3_two_ganji",
      label: "서로 다른 간지 2종 수집",
      current: Math.min(ganjiCount, 2),
      target: 2,
      completed: ganjiCount >= 2,
    },
    {
      id: "q4_seven_days",
      label: "7일 여정 완료",
      current: Math.min(uniqueDays, STATS_INSIGHT_MIN_ENTRIES),
      target: STATS_INSIGHT_MIN_ENTRIES,
      completed: uniqueDays >= STATS_INSIGHT_MIN_ENTRIES,
    },
  ];

  const completedCount = quests.filter((q) => q.completed).length;

  return {
    title: "이번 주 여정",
    quests,
    completedCount,
    totalCount: quests.length,
    allComplete: completedCount === quests.length,
  };
}

export function getStreakDays(entries: DiaryEntry[]): number {
  if (entries.length === 0) return 0;
  const dates = Array.from(new Set(entries.map((e) => e.date))).sort();
  if (dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = todayStr;

  if (!dateSet.has(cursor)) {
    const last = dates[dates.length - 1];
    const lastDate = new Date(
      Number(last.slice(0, 4)),
      Number(last.slice(5, 7)) - 1,
      Number(last.slice(8, 10))
    );
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 1) return 0;
    cursor = last;
  }

  while (dateSet.has(cursor)) {
    streak++;
    const { year, month, day } = {
      year: Number(cursor.slice(0, 4)),
      month: Number(cursor.slice(5, 7)),
      day: Number(cursor.slice(8, 10)),
    };
    const d = new Date(year, month - 1, day);
    d.setDate(d.getDate() - 1);
    cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return streak;
}
