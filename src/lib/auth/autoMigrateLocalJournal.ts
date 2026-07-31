/**
 * 로컬 IndexedDB 일기 → 현재 auth 계정으로 자동 이관 (선택 UI 없음).
 * 날짜가 원격에 없으면 업로드, 충돌이면 로컬(이 기기) 우선.
 */
import { listAllLocalJournalEntries } from "@/lib/journal/indexedDbStorage";
import {
  getJournalStorage,
  resetJournalStorageCache,
} from "@/lib/journal/getStorage";
import {
  journalEntryToSaveInput,
  planLocalJournalImport,
  resolveJournalConflicts,
} from "@/lib/journal/mergeLocalJournalImport";
import {
  loadPrimarySajuProfile,
  syncLocalSajuProfileToAccount,
} from "@/lib/diary/profileStorage";

const MIGRATED_FLAG = "manseryeok_local_journal_migrated_v1";

function migrationKey(userId: string): string {
  return `${MIGRATED_FLAG}:${userId}`;
}

export async function autoMigrateLocalJournalToAccount(): Promise<{
  uploaded: number;
  skipped: boolean;
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { uploaded: 0, skipped: true };
  }

  try {
    resetJournalStorageCache();
    await syncLocalSajuProfileToAccount();
    const primary = await loadPrimarySajuProfile();
    if (!primary?.id || !primary.userId) {
      return { uploaded: 0, skipped: true };
    }

    try {
      if (localStorage.getItem(migrationKey(primary.userId)) === "1") {
        return { uploaded: 0, skipped: true };
      }
    } catch {
      /* continue */
    }

    const localEntries = await listAllLocalJournalEntries();
    if (localEntries.length === 0) {
      try {
        localStorage.setItem(migrationKey(primary.userId), "1");
      } catch {
        /* ignore */
      }
      return { uploaded: 0, skipped: true };
    }

    const remoteStorage = await getJournalStorage();
    const remoteEntries = await remoteStorage.list();
    const plan = planLocalJournalImport(localEntries, remoteEntries);
    const choices: Record<string, "local" | "remote"> = {};
    for (const c of plan.conflicts) {
      choices[c.date] = "local";
    }
    const payload = [
      ...plan.toUpload,
      ...resolveJournalConflicts(plan.conflicts, choices),
    ];

    for (const entry of payload) {
      const input = journalEntryToSaveInput(entry, primary.id);
      if (remoteStorage.saveWithMeta) {
        await remoteStorage.saveWithMeta(input);
      } else {
        await remoteStorage.save(input);
      }
    }

    try {
      localStorage.setItem(migrationKey(primary.userId), "1");
    } catch {
      /* ignore */
    }

    resetJournalStorageCache();
    return { uploaded: payload.length, skipped: false };
  } catch (err) {
    return {
      uploaded: 0,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
