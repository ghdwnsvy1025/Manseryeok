import type { DiaryEntry, DiaryDataOrigin, HappinessSource } from "./types";
import type { DiaryStorage } from "./storage";

const DEMO_CLEANUP_FLAG = "manseryeok_demo_cleanup_v1";

export function isDemoEntry(entry: Pick<DiaryEntry, "id" | "dataOrigin">): boolean {
  if (entry.dataOrigin === "demo") return true;
  return typeof entry.id === "string" && entry.id.startsWith("demo-");
}

export function filterRealEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return entries.filter((entry) => !isDemoEntry(entry));
}

export function resolveDataOrigin(
  entry: Partial<DiaryEntry>
): DiaryDataOrigin {
  if (entry.dataOrigin === "user" || entry.dataOrigin === "import" || entry.dataOrigin === "demo") {
    return entry.dataOrigin;
  }
  if (typeof entry.id === "string" && entry.id.startsWith("demo-")) {
    return "demo";
  }
  return "user";
}

export function resolveHappinessSource(
  entry: Partial<DiaryEntry>,
  hadExplicitRating: boolean
): HappinessSource {
  if (
    entry.happinessSource === "selected" ||
    entry.happinessSource === "backfilled" ||
    entry.happinessSource === "default"
  ) {
    return entry.happinessSource;
  }
  if (hadExplicitRating) return "selected";
  if (entry.analysis?.daily_wellbeing_score != null) return "backfilled";
  return "default";
}

/** 기존 자동 생성 demo-* 기록을 한 번만 삭제. 일반 기록은 유지 */
export async function cleanupDemoEntriesOnce(
  storage: DiaryStorage
): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (localStorage.getItem(DEMO_CLEANUP_FLAG) === "1") return 0;

  const all = await storage.list();
  const demos = all.filter(isDemoEntry);
  for (const entry of demos) {
    await storage.delete(entry.id);
  }
  localStorage.setItem(DEMO_CLEANUP_FLAG, "1");
  // 예전 자동 시드 플래그도 정리
  localStorage.removeItem("manseryeok_demo_diary_2m_v1");
  return demos.length;
}
