/**
 * 홈 「지난 30일 화제」 합쳐 조언 캐시 (템플릿+빠른 polish)
 */
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";

const CACHE_KEY = "manseryeok:week-topic-support:v4";

export type WeekTopicSupportCacheEntry = {
  date: string;
  fingerprint: string;
  /** topicId → 한 문장 */
  lines: Record<string, string>;
  /** 상위 화제를 묶은 합쳐 조언 */
  combinedAdvice: string | null;
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
      return {
        ...parsed,
        combinedAdvice:
          typeof parsed.combinedAdvice === "string"
            ? parsed.combinedAdvice
            : null,
      };
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
  openAi: OpenAiCallStatus | null,
  combinedAdvice?: string | null
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: WeekTopicSupportCacheEntry = {
      date,
      fingerprint,
      lines,
      combinedAdvice: combinedAdvice ?? null,
      openAi,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore quota */
  }
}
