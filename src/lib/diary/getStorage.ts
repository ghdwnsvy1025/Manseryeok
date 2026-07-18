import type { DiaryStorage } from "./storage";
import { getIndexedDbStorage } from "./indexedDbStorage";
import { getSupabaseDiaryStorage, isSupabaseConfigured } from "./supabaseStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

let cachedStorage: DiaryStorage | null = null;
let authListenerAttached = false;

function attachAuthListener(): void {
  if (authListenerAttached || typeof window === "undefined") return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  authListenerAttached = true;
  supabase.auth.onAuthStateChange(() => {
    cachedStorage = null;
  });
}

export async function getDiaryStorage(): Promise<DiaryStorage> {
  attachAuthListener();
  if (cachedStorage) return cachedStorage;

  if (isSupabaseConfigured()) {
    const supabaseStorage = await getSupabaseDiaryStorage();
    if (supabaseStorage) {
      cachedStorage = supabaseStorage;
      return supabaseStorage;
    }
  }

  cachedStorage = getIndexedDbStorage();
  return cachedStorage;
}

export function resetDiaryStorageCache(): void {
  cachedStorage = null;
}
