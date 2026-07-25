/**
 * 클라에서 질문 피드백 전송 (+ 로컬 폴백 + 키워드 편향 학습)
 */
import {
  appendLocalQuestionFeedback,
  type QuestionFeedbackInput,
  type LocalFeedbackLog,
} from "./questionFeedback";
import { recordLocalFeedbackBias } from "./keywords/learning";

function localFeedbackKey(userHint: string, date: string): string {
  return `manseryeok:question-feedback:v1:${userHint}:${date}`;
}

function keywordsFromTodayShown(questionDate: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(
      localFeedbackKey("anon", questionDate)
    );
    if (!raw) return [];
    const log = JSON.parse(raw) as LocalFeedbackLog;
    for (let i = log.events.length - 1; i >= 0; i -= 1) {
      const e = log.events[i];
      if (
        e.eventType !== "shown" &&
        e.eventType !== "fit_good" &&
        e.eventType !== "fit_bad"
      ) {
        continue;
      }
      const kw = e.payload?.keywords;
      if (Array.isArray(kw) && kw.length > 0) return kw.map(String);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export async function reportQuestionFeedback(
  input: QuestionFeedbackInput
): Promise<{ ok: boolean; stored?: string }> {
  const payload = { ...(input.payload ?? {}) };
  let keywords = Array.isArray(payload.keywords)
    ? payload.keywords.map(String)
    : [];
  if (keywords.length === 0 && input.eventType === "led_to_write") {
    keywords = keywordsFromTodayShown(input.questionDate);
    if (keywords.length > 0) payload.keywords = keywords;
  }

  const nextInput: QuestionFeedbackInput = { ...input, payload };
  appendLocalQuestionFeedback(nextInput);

  if (keywords.length > 0) {
    recordLocalFeedbackBias({
      eventType: nextInput.eventType,
      keywords,
    });
  }

  try {
    const res = await fetch("/api/journal/question-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextInput),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      stored?: string;
      error?: string;
    };
    if (!res.ok) return { ok: false };
    return { ok: true, stored: data.stored };
  } catch {
    return { ok: true, stored: "client_local" };
  }
}
