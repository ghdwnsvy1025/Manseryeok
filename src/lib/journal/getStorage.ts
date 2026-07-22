import type { JournalStorage } from "./storage";
import { getIndexedDbJournalStorage } from "./indexedDbStorage";
import { getSupabaseJournalStorage } from "./supabaseStorage";
import { isSupabaseConfigured } from "@/lib/diary/supabaseStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let cached: JournalStorage | null = null;
let authListenerAttached = false;

function attachAuthListener(): void {
  if (authListenerAttached || typeof window === "undefined") return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  authListenerAttached = true;
  supabase.auth.onAuthStateChange(() => {
    cached = null;
  });
}

export async function getJournalStorage(): Promise<JournalStorage> {
  attachAuthListener();
  if (cached) return cached;

  if (isSupabaseConfigured()) {
    const remote = await getSupabaseJournalStorage();
    if (remote) {
      cached = remote;
      return remote;
    }
  }

  cached = getIndexedDbJournalStorage();
  return cached;
}

export function resetJournalStorageCache(): void {
  cached = null;
}
