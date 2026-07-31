/**
 * 홈 「이번 주 화제」 본문 기반 위로·조언 캐시
 */
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";

const CACHE_KEY = "manseryeok:week-topic-support:v1";

export type WeekTopicSupportCacheEntry = {
  date: string;
  fingerprint: string;
  /** topicId → 한 문장 */
  lines: Record<string, string>;
  openAi: OpenAiCallStatus | null;
  savedAt: string;
};

export function loadWeekTopicSupportCache(
  date: string,
  fingerprint: string
): WeekTopicSupportCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeekTopicSupportCacheEntry;
    if (
      parsed?.date === date &&
      parsed?.fingerprint === fingerprint &&
      parsed?.lines &&
      typeof parsed.lines === "object"
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveWeekTopicSupportCache(
  date: string,
  fingerprint: string,
  lines: Record<string, string>,
  openAi: OpenAiCallStatus | null
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: WeekTopicSupportCacheEntry = {
      date,
      fingerprint,
      lines,
      openAi,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore quota */
  }
}
