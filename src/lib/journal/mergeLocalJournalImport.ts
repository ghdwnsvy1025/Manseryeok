import type { JournalEntry } from "./types";
import type { JournalSaveInput } from "./storage";
import type { JournalScore } from "./scoreScale";

export type JournalMergeConflict = {
  date: string;
  local: JournalEntry;
  remote: JournalEntry;
};

export type JournalMergeChoice = "local" | "remote";

export type JournalMergePlan = {
  toUpload: JournalEntry[];
  conflicts: JournalMergeConflict[];
};

/** 로컬 → 원격 일기 가져오기 미리보기. 같은 날짜는 conflict로 분리 */
export function planLocalJournalImport(
  localEntries: JournalEntry[],
  remoteEntries: JournalEntry[]
): JournalMergePlan {
  const remoteByDate = new Map(remoteEntries.map((e) => [e.entryDate, e]));
  const toUpload: JournalEntry[] = [];
  const conflicts: JournalMergeConflict[] = [];

  for (const local of localEntries) {
    const remote = remoteByDate.get(local.entryDate);
    if (!remote) {
      toUpload.push(local);
      continue;
    }
    if (
      local.updatedAt === remote.updatedAt &&
      local.content === remote.content &&
      local.happinessScore === remote.happinessScore &&
      local.overallSatisfaction === remote.overallSatisfaction
    ) {
      continue;
    }
    conflicts.push({ date: local.entryDate, local, remote });
  }

  return { toUpload, conflicts };
}

export function resolveJournalConflicts(
  conflicts: JournalMergeConflict[],
  choices: Record<string, JournalMergeChoice>
): JournalEntry[] {
  const resolved: JournalEntry[] = [];
  for (const conflict of conflicts) {
    const choice = choices[conflict.date] ?? "remote";
    resolved.push(choice === "local" ? conflict.local : conflict.remote);
  }
  return resolved;
}

export function journalEntryToSaveInput(
  entry: JournalEntry,
  sajuProfileId: string
): JournalSaveInput {
  return {
    entryDate: entry.entryDate,
    sajuProfileId,
    userTimezone: entry.userTimezone,
    content: entry.content,
    overallSatisfaction: entry.overallSatisfaction as JournalScore | 0 | null,
    happinessScore: entry.happinessScore,
    moodLabel: entry.moodLabel,
    moodLabels: entry.moodLabels,
    mainEventText: entry.mainEventText,
    scores: entry.scores.map((s) => ({
      categoryCode: s.categoryCode,
      userScore: s.userScore,
      rawScore: s.rawScore ?? s.userScore,
      aiScore: s.aiScore,
      finalScore: s.finalScore,
      isNotApplicable: s.isNotApplicable,
    })),
    tagCodes: entry.tags.map((t) => t.tagCode),
    coreStates: entry.coreStates,
    domainScores: entry.domainScores,
    checkinVersion: entry.checkinVersion,
    relaxEnabledCount: true,
    xpGranted: entry.xpGranted,
    xpAwarded: entry.xpAwarded,
  };
}
