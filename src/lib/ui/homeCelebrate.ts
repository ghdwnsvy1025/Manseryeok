/**
 * 일기 저장 → 홈 이동 시 축하 이펙트용 플래그.
 * sessionStorage에 쓰고, 홈에서 표시한 뒤 지운다.
 * (Strict Mode 이중 마운트에서 consume-즉시삭제가 이펙트를 삼키지 않도록 peek 방식)
 */
export const HOME_CELEBRATE_KEY = "manseryeok:home-celebrate:v1";

export type HomeCelebratePayload = {
  source: "journal";
  wasFirstSaveOfDay: boolean;
  gainedXp: number;
  leveledUp: boolean;
  level: number;
  /** epoch ms */
  at: number;
};

export function setHomeCelebrate(
  payload: Omit<HomeCelebratePayload, "at" | "source"> & {
    source?: HomeCelebratePayload["source"];
  }
): void {
  if (typeof window === "undefined") return;
  try {
    const full: HomeCelebratePayload = {
      source: payload.source ?? "journal",
      wasFirstSaveOfDay: payload.wasFirstSaveOfDay,
      gainedXp: payload.gainedXp,
      leveledUp: payload.leveledUp,
      level: payload.level,
      at: Date.now(),
    };
    window.sessionStorage.setItem(HOME_CELEBRATE_KEY, JSON.stringify(full));
  } catch {
    /* ignore */
  }
}

function readPayload(maxAgeMs: number): HomeCelebratePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HOME_CELEBRATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeCelebratePayload;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > maxAgeMs) {
      window.sessionStorage.removeItem(HOME_CELEBRATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 읽기만 (Strict Mode 재마운트에도 동일 페이로드 유지) */
export function peekHomeCelebrate(
  maxAgeMs = 60_000
): HomeCelebratePayload | null {
  return readPayload(maxAgeMs);
}

export function clearHomeCelebrate(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(HOME_CELEBRATE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated peek + clear 조합 사용. 호환용 */
export function consumeHomeCelebrate(
  maxAgeMs = 60_000
): HomeCelebratePayload | null {
  const parsed = readPayload(maxAgeMs);
  if (!parsed) return null;
  clearHomeCelebrate();
  return parsed;
}

export function celebrateHeadline(p: HomeCelebratePayload): string {
  if (p.leveledUp) return `레벨 ${p.level} 달성!`;
  if (p.wasFirstSaveOfDay) return "오늘 기록 완료!";
  return "기록이 업데이트됐어요!";
}

export function celebrateSubline(p: HomeCelebratePayload): string | null {
  if (p.wasFirstSaveOfDay && p.gainedXp > 0) {
    return `+${p.gainedXp} XP · 오늘도 잘 남겼어요`;
  }
  if (p.leveledUp) return "성장이 쌓이고 있어요";
  if (p.wasFirstSaveOfDay) return "빵빠레! 오늘의 한 줄이 채워졌어요";
  return "최신 내용으로 반영됐어요";
}
