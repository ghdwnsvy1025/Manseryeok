/**
 * 오늘의 질문 피드백 — 적합도 + 작성 유도 학습용
 */
import { sajuHypothesisWeightFromDays } from "@/lib/journal/insight/recordReflectGate";

export const QUESTION_FEEDBACK_EVENT_TYPES = [
  "shown",
  "fit_good",
  "fit_neutral",
  "fit_bad",
  "led_to_write",
  "skipped",
  "dismissed",
] as const;

export type QuestionFeedbackEventType =
  (typeof QUESTION_FEEDBACK_EVENT_TYPES)[number];

export type FitLevel = "good" | "neutral" | "bad";

/**
 * 적합도 옵션(학습·API용). UI는 굿/배드 2개만 노출한다.
 */
export const QUESTION_FIT_LEVELS: Array<{
  level: FitLevel;
  label: string;
  /** 짧은 버튼 라벨 */
  shortLabel: string;
  eventType: QuestionFeedbackEventType;
  rating: number;
  /** 선택 후 안내 문구 */
  ack: string;
}> = [
  {
    level: "good",
    label: "도움이 됐어요",
    shortLabel: "굿",
    eventType: "fit_good",
    rating: 5,
    ack: "도움이 됐다니 다행이에요 — 다음 질문에 반영할게요.",
  },
  {
    level: "neutral",
    label: "그저 그래요",
    shortLabel: "보통",
    eventType: "fit_neutral",
    rating: 3,
    ack: "그저 그래요 — 방향을 조금 바꿔볼게요.",
  },
  {
    level: "bad",
    label: "별로예요",
    shortLabel: "배드",
    eventType: "fit_bad",
    rating: 1,
    ack: "별로였군요 — 다음 질문에 참고할게요.",
  },
];

/** 질문 옆 인라인 — 굿 / 배드만 */
export const QUESTION_FIT_THUMBS = QUESTION_FIT_LEVELS.filter(
  (l) => l.level === "good" || l.level === "bad"
);

export function isFitEventType(value: string): boolean {
  return QUESTION_FIT_LEVELS.some((l) => l.eventType === value);
}

export type QuestionFeedbackInput = {
  questionDate: string;
  eventType: QuestionFeedbackEventType;
  questionText?: string | null;
  questionId?: string | null;
  rating?: number | null;
  payload?: Record<string, unknown>;
};

export function isQuestionFeedbackEventType(
  value: unknown
): value is QuestionFeedbackEventType {
  return (
    typeof value === "string" &&
    (QUESTION_FEEDBACK_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function validateQuestionFeedbackInput(
  input: QuestionFeedbackInput
): { ok: true } | { ok: false; error: string } {
  if (
    typeof input.questionDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.questionDate)
  ) {
    return { ok: false, error: "questionDate가 필요합니다." };
  }
  if (!isQuestionFeedbackEventType(input.eventType)) {
    return { ok: false, error: "알 수 없는 eventType입니다." };
  }
  if (
    input.rating != null &&
    (!Number.isInteger(input.rating) ||
      input.rating < 1 ||
      input.rating > 5)
  ) {
    return { ok: false, error: "rating은 1~5만 허용됩니다." };
  }
  return { ok: true };
}

function localKey(userHint: string, date: string): string {
  return `manseryeok:question-feedback:v1:${userHint}:${date}`;
}

export type LocalFeedbackLog = {
  questionDate: string;
  events: Array<{
    eventType: QuestionFeedbackEventType;
    questionText?: string | null;
    rating?: number | null;
    payload?: Record<string, unknown>;
    createdAt: string;
  }>;
};

/** 비로그인·오프라인 폴백 */
export function appendLocalQuestionFeedback(
  input: QuestionFeedbackInput,
  userHint = "anon"
): void {
  if (typeof window === "undefined") return;
  try {
    const key = localKey(userHint, input.questionDate);
    const raw = window.localStorage.getItem(key);
    const prev: LocalFeedbackLog = raw
      ? (JSON.parse(raw) as LocalFeedbackLog)
      : { questionDate: input.questionDate, events: [] };
    prev.events.push({
      eventType: input.eventType,
      questionText: input.questionText ?? null,
      rating: input.rating ?? null,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString(),
    });
    window.localStorage.setItem(key, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

export function hasLocalFitFeedback(
  questionDate: string,
  userHint = "anon"
): boolean {
  return peekLocalFitLevel(questionDate, userHint) != null;
}

/** 로컬에 남긴 마지막 굿/배드(중립 포함) */
export function peekLocalFitLevel(
  questionDate: string,
  userHint = "anon"
): FitLevel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(localKey(userHint, questionDate));
    if (!raw) return null;
    const log = JSON.parse(raw) as LocalFeedbackLog;
    for (let i = log.events.length - 1; i >= 0; i -= 1) {
      const t = log.events[i]?.eventType;
      if (t === "fit_good") return "good";
      if (t === "fit_neutral") return "neutral";
      if (t === "fit_bad") return "bad";
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 기록이 쌓일수록 사주 가설 가중치 감소
 * — 일수 게이트(recordReflectGate)와 동일 구간
 */
export function sajuHypothesisWeight(priorUniqueDays: number): number {
  return sajuHypothesisWeightFromDays(priorUniqueDays);
}
