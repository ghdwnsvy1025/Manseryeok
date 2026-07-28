/**
 * 홈 「최근 나의 상태」 하루 캐시.
 * OpenAI 호출은 fingerprint가 바뀔 때만 (기록으로 통계가 변할 때).
 */
import type { HomeEStats } from "@/lib/journal/homeStats";
import type { RecentStatusPayload } from "@/lib/journal/recentStatus";
import type { OpenAiCallStatus } from "@/lib/journal/openaiStatus";

const CACHE_KEY = "manseryeok:recent-status:v1";

export type RecentStatusCacheEntry = {
  date: string;
  fingerprint: string;
  status: RecentStatusPayload;
  openAi: OpenAiCallStatus | null;
  savedAt: string;
};

function avgKey(row: { code: string; average: number } | null | undefined): string {
  if (!row) return "-";
  return `${row.code}:${row.average.toFixed(1)}`;
}

/** 같은 날이라도 기록이 바뀌면 새로 생성 */
export function recentStatusFingerprint(stats: HomeEStats): string {
  return [
    stats.avg7?.toFixed(1) ?? "-",
    stats.avg30?.toFixed(1) ?? "-",
    avgKey(stats.coreBest),
    avgKey(stats.coreWorst),
    avgKey(stats.domainBest),
    avgKey(stats.domainWorst),
    String(stats.uniqueDays),
  ].join("|");
}

export function loadRecentStatusCache(
  date: string,
  fingerprint: string
): RecentStatusCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecentStatusCacheEntry;
    if (
      parsed?.date === date &&
      parsed?.fingerprint === fingerprint &&
      parsed?.status &&
      (parsed.status.headline || parsed.status.message)
    ) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveRecentStatusCache(
  date: string,
  fingerprint: string,
  status: RecentStatusPayload,
  openAi: OpenAiCallStatus | null
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: RecentStatusCacheEntry = {
      date,
      fingerprint,
      status,
      openAi,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore quota */
  }
}
