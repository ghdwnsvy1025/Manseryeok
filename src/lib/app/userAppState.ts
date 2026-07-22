import { todayDateString } from "@/lib/diary/dayPillar";
import { filterRealEntries } from "@/lib/diary/dataOrigin";
import { STATS_INSIGHT_MIN_ENTRIES } from "@/lib/diary/onboarding";
import { getUniqueEntryDays } from "@/lib/diary/stats";
import type { DiaryEntry, ExperienceMode, SajuProfile } from "@/lib/diary/types";

export type UserAppStateKind =
  | "new_user"
  | "profile_without_diary"
  | "returning_not_logged_today"
  | "logged_today";

export type UserAppState = {
  kind: UserAppStateKind;
  experienceMode: ExperienceMode | null;
  onboardingCompleted: boolean;
  hasSajuProfile: boolean;
  hasAnyDiary: boolean;
  hasTodayEntry: boolean;
  totalEntryDays: number;
  canShowStatsInsight: boolean;
  todayDate: string;
  todayEntry: DiaryEntry | null;
  sajuProfile: SajuProfile | null;
  entries: DiaryEntry[];
};

export type UserAppStateInput = {
  experienceMode: ExperienceMode | null;
  onboardingCompletedAt: string | null;
  sajuProfile: SajuProfile | null;
  entries: DiaryEntry[];
  todayDate?: string;
};

export function computeUserAppState(input: UserAppStateInput): UserAppState {
  const todayDate = input.todayDate ?? todayDateString();
  const entries = filterRealEntries(input.entries).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const todayEntry = entries.find((e) => e.date === todayDate) ?? null;
  const totalEntryDays = getUniqueEntryDays(entries);
  const hasSajuProfile = Boolean(input.sajuProfile);
  const hasAnyDiary = totalEntryDays > 0;
  const hasTodayEntry = Boolean(todayEntry);
  const onboardingCompleted = Boolean(input.onboardingCompletedAt);

  let kind: UserAppStateKind;
  if (!onboardingCompleted) {
    kind = "new_user";
  } else if (!hasAnyDiary) {
    kind = "profile_without_diary";
  } else if (!hasTodayEntry) {
    kind = "returning_not_logged_today";
  } else {
    kind = "logged_today";
  }

  return {
    kind,
    experienceMode: input.experienceMode,
    onboardingCompleted,
    hasSajuProfile,
    hasAnyDiary,
    hasTodayEntry,
    totalEntryDays,
    canShowStatsInsight: totalEntryDays >= STATS_INSIGHT_MIN_ENTRIES,
    todayDate,
    todayEntry,
    sajuProfile: input.sajuProfile,
    entries,
  };
}
