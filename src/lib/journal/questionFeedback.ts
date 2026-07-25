/**
 * 오늘의 질문 피드백 — 적합도 + 작성 유도 학습용
 */

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
 * 적합도 3단계.
 * 2단계(맞아요/별로예요)는 "그저 그래요"를 표현할 수 없어서
 * 애매한 경우 응답을 아예 안 하거나 한쪽으로 쏠린다.
 */
export const QUESTION_FIT_LEVELS: Array<{
  level: FitLevel;
  label: string;
  eventType: QuestionFeedbackEventType;
  rating: number;
  /** 선택 후 안내 문구 */
  ack: string;
}> = [
  {
    level: "good",
    label: "잘 맞아요",
    eventType: "fit_good",
    rating: 5,
    ack: "잘 맞아요 — 다음 질문에 반영할게요.",
  },
  {
    level: "neutral",
    label: "그저 그래요",
    eventType: "fit_neutral",
    rating: 3,
    ack: "그저 그래요 — 방향을 조금 바꿔볼게요.",
  },
  {
    level: "bad",
    label: "안 맞아요",
    eventType: "fit_bad",
    rating: 1,
    ack: "안 맞아요 — 다음 질문에 참고할게요.",
  },
];

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
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(localKey(userHint, questionDate));
    if (!raw) return false;
    const log = JSON.parse(raw) as LocalFeedbackLog;
    return log.events.some((e) => isFitEventType(e.eventType));
  } catch {
    return false;
  }
}

/**
 * 기록이 쌓일수록 사주 가설 가중치 감소 (1 → 0.2)
 * — 마스터 프롬프트: 개인 데이터 비중 상승
 */
export function sajuHypothesisWeight(priorUniqueDays: number): number {
  if (priorUniqueDays <= 0) return 1;
  if (priorUniqueDays >= 60) return 0.2;
  return Math.round((1 - (priorUniqueDays / 60) * 0.8) * 1000) / 1000;
}
