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
  const profileId = primary?.id ?? "local";

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

  cached = getIndexedDbJournalStorage(profileId);
  return cached;
}

export function resetJournalStorageCache(): void {
  cached = null;
  cachedProfileId = null;
}
