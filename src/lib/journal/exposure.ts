/**
 * 콘텐츠 노출 이벤트 — 질문/운세/문장 오염 관리용
 */

export const EXPOSURE_EVENT_TYPES = [
  "question_impression",
  "question_opened",
  "fortune_summary_impression",
  "fortune_detail_opened",
  "fortune_domain_opened",
  "checkin_started",
  "checkin_completed",
  "diary_started",
  "diary_completed",
  "sentence_impression",
  "quote_impression",
  "delivered",
] as const;

export type ExposureEventType = (typeof EXPOSURE_EVENT_TYPES)[number];

export type ContentExposureInput = {
  eventDate: string;
  contentType: string;
  contentId?: string | null;
  eventType: ExposureEventType;
  metadata?: Record<string, unknown>;
};

export function isExposureEventType(value: unknown): value is ExposureEventType {
  return (
    typeof value === "string" &&
    (EXPOSURE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function validateExposureInput(
  input: ContentExposureInput
): { ok: true } | { ok: false; error: string } {
  if (
    typeof input.eventDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.eventDate)
  ) {
    return { ok: false, error: "eventDate가 필요합니다." };
  }
  if (!input.contentType || typeof input.contentType !== "string") {
    return { ok: false, error: "contentType이 필요합니다." };
  }
  if (!isExposureEventType(input.eventType)) {
    return { ok: false, error: "알 수 없는 eventType입니다." };
  }
  return { ok: true };
}

function localKey(userHint: string, date: string): string {
  return `manseryeok:content-exposure:v1:${userHint}:${date}`;
}

/** 비로그인·오프라인 폴백 */
export function appendLocalExposure(
  input: ContentExposureInput,
  userHint = "anon"
): void {
  if (typeof window === "undefined") return;
  try {
    const key = localKey(userHint, input.eventDate);
    const raw = window.localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as { events: unknown[] }) : { events: [] };
    prev.events.push({
      ...input,
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(key, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

/** 클라에서 서버로 전송 (실패해도 UX 유지) */
export async function trackContentExposure(
  input: ContentExposureInput
): Promise<void> {
  appendLocalExposure(input);
  try {
    await fetch("/api/content-exposure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* ignore */
  }
}
