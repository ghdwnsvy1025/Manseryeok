/**
 * 운세·명언·오늘의 문장 피드백
 */

export const CONTENT_FEEDBACK_RATINGS = [
  "loved",
  "ok",
  "not_for_me",
] as const;

export type ContentFeedbackRating =
  (typeof CONTENT_FEEDBACK_RATINGS)[number];

export const CONTENT_FEEDBACK_LABELS: Record<ContentFeedbackRating, string> = {
  loved: "잘 맞아요",
  ok: "보통이에요",
  not_for_me: "안 맞아요",
};

/** 질문·명언용 — 적합성보다 도움 여부 */
export const CONTENT_FEEDBACK_HELP_LABELS: Record<
  ContentFeedbackRating,
  string
> = {
  loved: "도움이 됐어요",
  ok: "그저 그래요",
  not_for_me: "별로예요",
};

export type ContentFeedbackInput = {
  eventDate: string;
  contentType: string;
  contentId?: string | null;
  rating?: ContentFeedbackRating | null;
  saved?: boolean;
  shared?: boolean;
  reopened?: boolean;
};

export function isContentFeedbackRating(
  value: unknown
): value is ContentFeedbackRating {
  return (
    typeof value === "string" &&
    (CONTENT_FEEDBACK_RATINGS as readonly string[]).includes(value)
  );
}

export function validateContentFeedbackInput(
  input: ContentFeedbackInput
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
  if (
    input.rating != null &&
    !isContentFeedbackRating(input.rating)
  ) {
    return { ok: false, error: "rating이 올바르지 않습니다." };
  }
  return { ok: true };
}

function localKey(userHint: string, date: string): string {
  return `manseryeok:content-feedback:v1:${userHint}:${date}`;
}

export function appendLocalContentFeedback(
  input: ContentFeedbackInput,
  userHint = "anon"
): void {
  if (typeof window === "undefined") return;
  try {
    const key = localKey(userHint, input.eventDate);
    const raw = window.localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as { events: unknown[] }) : { events: [] };
    prev.events.push({ ...input, createdAt: new Date().toISOString() });
    window.localStorage.setItem(key, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

export async function submitContentFeedback(
  input: ContentFeedbackInput
): Promise<void> {
  appendLocalContentFeedback(input);
  try {
    await fetch("/api/content-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    /* ignore */
  }
}
