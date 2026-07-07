import type { DiaryStorage } from "./storage";
import { getIndexedDbStorage } from "./indexedDbStorage";
import { getSupabaseDiaryStorage, isSupabaseConfigured } from "./supabaseStorage";

let cachedStorage: DiaryStorage | null = null;

export async function getDiaryStorage(): Promise<DiaryStorage> {
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
