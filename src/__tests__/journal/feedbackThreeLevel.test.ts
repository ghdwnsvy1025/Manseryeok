import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  QUESTION_FEEDBACK_EVENT_TYPES,
  QUESTION_FIT_LEVELS,
  isQuestionFeedbackEventType,
  isFitEventType,
  validateQuestionFeedbackInput,
} from "@/lib/journal/questionFeedback";
import {
  applyFeedbackToKeywordBiases,
  aggregateKeywordBiasesFromEvents,
  LEARNABLE_FEEDBACK_EVENT_TYPES,
} from "@/lib/journal/keywords/learning";

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), "utf8");
}

describe("three-level question fit feedback", () => {
  test("exactly three fit levels with distinct ratings", () => {
    expect(QUESTION_FIT_LEVELS).toHaveLength(3);
    expect(QUESTION_FIT_LEVELS.map((l) => l.level)).toEqual([
      "good",
      "neutral",
      "bad",
    ]);
    expect(QUESTION_FIT_LEVELS.map((l) => l.label)).toEqual([
      "도움이 됐어요",
      "그저 그래요",
      "별로예요",
    ]);
    const ratings = QUESTION_FIT_LEVELS.map((l) => l.rating);
    expect(new Set(ratings).size).toBe(3);
    // rating은 1~5 제약을 지켜야 저장된다
    for (const r of ratings) {
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(5);
    }
    // 좋음 > 중립 > 나쁨 순서
    expect(ratings[0]!).toBeGreaterThan(ratings[1]!);
    expect(ratings[1]!).toBeGreaterThan(ratings[2]!);
  });

  test("every fit level is a valid event type", () => {
    for (const level of QUESTION_FIT_LEVELS) {
      expect(isQuestionFeedbackEventType(level.eventType)).toBe(true);
      expect(isFitEventType(level.eventType)).toBe(true);
      expect(
        validateQuestionFeedbackInput({
          questionDate: "2026-07-25",
          eventType: level.eventType,
          rating: level.rating,
        }).ok
      ).toBe(true);
    }
  });

  test("neutral nudges away from the keyword without punishing it like a bad fit", () => {
    const good = applyFeedbackToKeywordBiases({
      biases: {},
      eventType: "fit_good",
      keywords: ["relation"],
    });
    const neutral = applyFeedbackToKeywordBiases({
      biases: {},
      eventType: "fit_neutral",
      keywords: ["relation"],
    });
    const bad = applyFeedbackToKeywordBiases({
      biases: {},
      eventType: "fit_bad",
      keywords: ["relation"],
    });

    expect(good.relation!).toBeGreaterThan(0);
    expect(neutral.relation!).toBeLessThan(0);
    expect(neutral.relation!).toBeGreaterThan(bad.relation!);
  });

  test("aggregation handles the neutral event", () => {
    const biases = aggregateKeywordBiasesFromEvents([
      { eventType: "fit_neutral", keywords: ["work"] },
      { eventType: "fit_neutral", keywords: ["work"] },
    ]);
    expect(biases.work!).toBeLessThan(0);
  });
});

describe("feedback events are actually emitted", () => {
  const card = read("src/components/journal/TodayQuestionCard.tsx");
  const questionRoute = read("src/app/api/journal/today-question/route.ts");
  const editor = read("src/components/journal/CheckInEditor.tsx");

  test("the question card emits shown, all three fit levels, skipped and dismissed", () => {
    expect(card).toContain('eventType: "shown"');
    expect(card).toContain('eventType: "skipped"');
    expect(card).toContain('eventType: "dismissed"');
    // 세 단계는 QUESTION_FIT_LEVELS를 통해 발화된다
    expect(card).toContain("QUESTION_FIT_LEVELS");
    expect(card).toContain("option.eventType");
  });

  test("writing an entry emits led_to_write", () => {
    expect(editor).toContain('"led_to_write"');
  });

  // 회귀 방지: 이벤트 타입을 추가하고 학습 가중치를 빠뜨리면
  // 이벤트는 쌓이는데 아무것도 학습되지 않는 상태가 된다.
  test("every non-shown event type has a learning weight", () => {
    const learnable = QUESTION_FEEDBACK_EVENT_TYPES.filter(
      (t) => t !== "shown"
    );
    expect([...LEARNABLE_FEEDBACK_EVENT_TYPES].sort()).toEqual(
      [...learnable].sort()
    );

    for (const eventType of learnable) {
      const out = applyFeedbackToKeywordBiases({
        biases: {},
        eventType,
        keywords: ["relation"],
      });
      expect(out.relation).toBeDefined();
      expect(out.relation).not.toBe(0);
    }
  });

  test("the question route reads exactly the learnable event types", () => {
    expect(questionRoute).toContain("LEARNABLE_FEEDBACK_EVENT_TYPES");
  });

  // 회귀 방지: 코드가 보내는 event_type을 DB check 제약이 거부하면
  // 피드백이 조용히 사라진다.
  test("the database constraint allows every event type the app can emit", () => {
    const base = read("supabase/migrations/014_checkin_v2.sql");
    const patch = read(
      "supabase/migrations/023_question_feedback_fit_neutral.sql"
    );
    const allowed = `${base}\n${patch}`;
    for (const t of QUESTION_FEEDBACK_EVENT_TYPES) {
      expect(patch).toContain(`'${t}'`);
      expect(allowed).toContain(`'${t}'`);
    }
  });
});
