import { isSajuFeatureSnapshotEnabled } from "@/lib/app/featureFlags";
import { loadPrimarySajuProfile } from "@/lib/diary/profileStorage";
import { MemoryAstrologyStorage } from "./memoryStorage";
import { ensureAstrologySnapshot } from "./snapshot";

/** 브라우저 세션용 메모리 캐시 (Supabase 원격은 009 적용 후 연결) */
let browserStorage: MemoryAstrologyStorage | null = null;

function getBrowserAstrologyStorage(): MemoryAstrologyStorage {
  if (!browserStorage) browserStorage = new MemoryAstrologyStorage();
  return browserStorage;
}

/**
 * 일기 저장 성공 후 비동기 호출. 실패해도 throw하지 않음.
 */
export function scheduleAstrologySnapshotAfterJournalSave(opts: {
  localDate: string;
  userId?: string | null;
  timezone?: string;
}): void {
  if (!isSajuFeatureSnapshotEnabled()) return;

  void (async () => {
    try {
      const profile = await loadPrimarySajuProfile();
      await ensureAstrologySnapshot({
        storage: getBrowserAstrologyStorage(),
        userId: opts.userId ?? profile?.userId ?? null,
        localDate: opts.localDate,
        timezone: opts.timezone ?? profile?.timezone ?? "Asia/Seoul",
        calculationMode: "native_with_luck",
        sajuProfile: profile,
      });
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[astrology] snapshot ensure failed", err);
      }
    }
  })();
}
