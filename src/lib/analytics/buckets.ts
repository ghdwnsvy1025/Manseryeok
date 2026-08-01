/** PostHog용 안전한 구간화 — 원문/정확한 길이는 보내지 않음 */

export function textLengthBucket(
  text: string | null | undefined
): "0" | "1_49" | "50_149" | "150_plus" {
  const n = (text ?? "").trim().length;
  if (n <= 0) return "0";
  if (n < 50) return "1_49";
  if (n < 150) return "50_149";
  return "150_plus";
}

export function completionTimeBucket(
  startedAtMs: number | null | undefined,
  endedAtMs: number = Date.now()
): "<1m" | "1_3m" | "3m_plus" {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return "3m_plus";
  const sec = (endedAtMs - startedAtMs) / 1000;
  if (sec < 60) return "<1m";
  if (sec < 180) return "1_3m";
  return "3m_plus";
}

export function saveDurationBucket(
  startedAtMs: number | null | undefined,
  endedAtMs: number = Date.now()
): "<30s" | "30_119s" | "120s_plus" {
  if (startedAtMs == null || !Number.isFinite(startedAtMs)) return "120s_plus";
  const sec = (endedAtMs - startedAtMs) / 1000;
  if (sec < 30) return "<30s";
  if (sec < 120) return "30_119s";
  return "120s_plus";
}

export function saveNumberBucket(
  priorSuccessfulSaves: number
): "first" | "second" | "third_plus" {
  if (priorSuccessfulSaves <= 0) return "first";
  if (priorSuccessfulSaves === 1) return "second";
  return "third_plus";
}

export function networkState(): "online" | "offline" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  if (typeof navigator.onLine !== "boolean") return "unknown";
  return navigator.onLine ? "online" : "offline";
}

/** 질문 본문 없이 날짜 기반 안정 id */
export function questionIdForDate(date: string): string {
  return `q_${date.replace(/-/g, "_")}`;
}
