import type { JournalStorage } from "./storage";
import { getIndexedDbJournalStorage } from "./indexedDbStorage";
import { getSupabaseJournalStorage } from "./supabaseStorage";
import { isSupabaseConfigured } from "@/lib/diary/supabaseStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";

let cached: JournalStorage | null = null;
let cachedProfileId: string | null = null;
let authListenerAttached = false;

function attachAuthListener(): void {
  if (authListenerAttached || typeof window === "undefined") return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  authListenerAttached = true;
  supabase.auth.onAuthStateChange(() => {
    cached = null;
    cachedProfileId = null;
  });
}

export async function getJournalStorage(): Promise<JournalStorage> {
  attachAuthListener();

  // 캐시가 있으면 원격 프로필 조회를 기다리지 않는다.
  if (cached && cachedProfileId) {
    void loadPrimarySajuProfile()
      .then((primary) => {
        const profileId = primary?.id ?? "local";
        if (profileId !== cachedProfileId) {
          cached = null;
          cachedProfileId = null;
        }
      })
      .catch(() => {
        /* keep cache */
      });
    return cached;
  }

  const primary = await loadPrimarySajuProfile();
  let profileId = primary?.id ?? "local";

  if (cached && cachedProfileId === profileId) return cached;

  cached = null;
  cachedProfileId = profileId;

  if (isSupabaseConfigured()) {
    const remote = await getSupabaseJournalStorage();
    if (remote) {
      cached = remote;
      return remote;
    }
  }

  let local = getIndexedDbJournalStorage(profileId);
  // 프로필이 바뀌어 빈 저장소인데, 예전 프로필 id에 일기가 남아 있으면 복구
  try {
    const listed = await local.list();
    if (listed.length === 0) {
      const { listAllLocalJournalEntries } = await import(
        "@/lib/journal/indexedDbStorage"
      );
      const all = await listAllLocalJournalEntries();
      if (all.length > 0) {
        const recoveredId = all[0]?.sajuProfileId || "local";
        if (recoveredId !== profileId) {
          profileId = recoveredId;
          local = getIndexedDbJournalStorage(profileId);
          try {
            const { clearLastSavedCheckIn } = await import(
              "@/lib/journal/lastSavedCheckIn"
            );
            clearLastSavedCheckIn();
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* keep primary-scoped storage */
  }

  cached = local;
  cachedProfileId = profileId;
  return cached;
}

export function resetJournalStorageCache(): void {
  cached = null;
  cachedProfileId = null;
}
