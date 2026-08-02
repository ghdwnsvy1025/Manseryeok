/**
 * 당일 운세 localStorage 캐시에서 evidence만 꺼낸다.
 * 헤더 레벨 팝업 등 운세 패널 밖에서도 같은 근거를 보여주기 위함.
 */
import type { FortuneEvidence } from "@/lib/journal/fortune/evidence";
import { isGuestMode } from "@/lib/auth/guestMode";

type FortuneCachePayload = {
  version?: string;
  overall?: unknown;
  evidence?: FortuneEvidence | null;
};

function parsePayload(raw: string | null): FortuneCachePayload | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as FortuneCachePayload;
    if (data.version !== "v2" || !data.overall) return null;
    return data;
  } catch {
    return null;
  }
}

/** 날짜 기준 캐시 스캔 (프로필 키 레이스 허용) */
export function peekFortuneEvidenceForDate(
  date: string
): FortuneEvidence | null {
  if (typeof window === "undefined") return null;
  const workspace: "guest" | "account" = isGuestMode() ? "guest" : "account";
  const prefix = `manseryeok:today-fortune-v2.5:${date}:`;
  const preferred: string[] = [];
  const fallback: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      if (key.includes(`:${workspace}:`)) preferred.push(key);
      else fallback.push(key);
    }
  } catch {
    return null;
  }
  for (const key of [...preferred, ...fallback]) {
    const hit = parsePayload(window.localStorage.getItem(key));
    if (hit?.evidence) return hit.evidence;
  }
  return null;
}

export function journalSharePercent(evidence: FortuneEvidence): number {
  return Math.round(
    evidence.weights.recent * 100 + evidence.weights.keyword * 100
  );
}

export function natalSharePercent(evidence: FortuneEvidence): number {
  return Math.round(evidence.weights.natal * 100);
}
