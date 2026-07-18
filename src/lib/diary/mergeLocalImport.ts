import type { DiaryEntry } from "./types";

export type DiaryMergeConflict = {
  date: string;
  local: DiaryEntry;
  remote: DiaryEntry;
};

export type DiaryMergeChoice = "local" | "remote";

export type DiaryMergePlan = {
  toUpload: DiaryEntry[];
  conflicts: DiaryMergeConflict[];
};

/** 로컬 → 원격 가져오기 미리보기. 같은 날짜는 conflict로 분리 */
export function planLocalImport(
  localEntries: DiaryEntry[],
  remoteEntries: DiaryEntry[]
): DiaryMergePlan {
  const remoteByDate = new Map(remoteEntries.map((e) => [e.date, e]));
  const toUpload: DiaryEntry[] = [];
  const conflicts: DiaryMergeConflict[] = [];

  for (const local of localEntries) {
    const remote = remoteByDate.get(local.date);
    if (!remote) {
      toUpload.push(local);
      continue;
    }
    if (
      local.updatedAt === remote.updatedAt &&
      local.content === remote.content &&
      local.happinessRating === remote.happinessRating
    ) {
      continue;
    }
    conflicts.push({ date: local.date, local, remote });
  }

  return { toUpload, conflicts };
}

export function resolveConflicts(
  conflicts: DiaryMergeConflict[],
  choices: Record<string, DiaryMergeChoice>
): DiaryEntry[] {
  const resolved: DiaryEntry[] = [];
  for (const conflict of conflicts) {
    const choice = choices[conflict.date] ?? "remote";
    resolved.push(choice === "local" ? conflict.local : conflict.remote);
  }
  return resolved;
}
