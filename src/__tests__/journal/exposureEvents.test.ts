import { describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPOSURE_EVENT_TYPES,
  isExposureEventType,
  validateExposureInput,
  type ExposureEventType,
} from "@/lib/journal/exposure";
import {
  CONTENT_FEEDBACK_RATINGS,
  validateContentFeedbackInput,
} from "@/lib/journal/contentFeedback";

const ROOT = process.cwd();

/** 이벤트를 실제로 쏘는 파일들. 새 발화 지점이 생기면 여기 추가. */
const EMITTER_FILES = [
  "src/components/home/TodayFortunePanel.tsx",
  "src/components/journal/JournalSaveCompleteModal.tsx",
  "src/components/journal/TodayQuestionCard.tsx",
  "src/components/journal/CheckInEditor.tsx",
  "src/app/api/journal/today-quote/route.ts",
];

const emitterSource = EMITTER_FILES.map((f) =>
  readFileSync(join(ROOT, f), "utf8")
).join("\n");

/**
 * 발화 지점은 `eventType: "x"`, 서버 insert의 `event_type: "x"`,
 * 그리고 삼항식(`isVerified ? "quote_impression" : "sentence_impression"`)
 * 세 가지 형태로 나타나므로 따옴표 리터럴 존재로 판정한다.
 */
function isEmitted(eventType: ExposureEventType): boolean {
  return emitterSource.includes(`"${eventType}"`);
}

describe("content exposure event catalog", () => {
  test("validation accepts every declared type and rejects unknown ones", () => {
    for (const eventType of EXPOSURE_EVENT_TYPES) {
      expect(isExposureEventType(eventType)).toBe(true);
      expect(
        validateExposureInput({
          eventDate: "2026-07-25",
          contentType: "daily_question",
          eventType,
        }).ok
      ).toBe(true);
    }
    expect(isExposureEventType("question_opened")).toBe(false);
    expect(isExposureEventType("nonsense")).toBe(false);
  });

  test("bad dates and missing content types are rejected", () => {
    expect(
      validateExposureInput({
        eventDate: "2026-7-25",
        contentType: "daily_question",
        eventType: "question_impression",
      }).ok
    ).toBe(false);
    expect(
      validateExposureInput({
        eventDate: "2026-07-25",
        contentType: "",
        eventType: "question_impression",
      }).ok
    ).toBe(false);
  });

  // 이 스위트의 핵심: 선언된 이벤트는 전부 어딘가에서 실제로 발화되어야 한다.
  // 유령 이벤트가 있으면 "기록이 0건"인지 "기능이 없는" 건지 구분할 수 없다.
  test("every declared exposure event has a real emission site", () => {
    const phantom = EXPOSURE_EVENT_TYPES.filter((t) => !isEmitted(t));
    expect(phantom).toEqual([]);
  });

  test.each([
    ["question_impression", "src/components/journal/TodayQuestionCard.tsx"],
    ["checkin_started", "src/components/home/TodayFortunePanel.tsx"],
    ["checkin_completed", "src/components/journal/CheckInEditor.tsx"],
    ["diary_started", "src/components/journal/CheckInEditor.tsx"],
    ["diary_completed", "src/components/journal/CheckInEditor.tsx"],
    ["delivered", "src/app/api/journal/today-quote/route.ts"],
    ["quote_impression", "src/components/journal/JournalSaveCompleteModal.tsx"],
    [
      "sentence_impression",
      "src/components/journal/JournalSaveCompleteModal.tsx",
    ],
  ])("%s is emitted from %s", (eventType, file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src).toContain(`"${eventType}"`);
  });

  // 회귀 방지: 전달(delivered)과 노출(impression)을 둘 다 impression으로 찍으면
  // 같은 명언 하나가 노출 2회로 집계된다.
  test("the quote delivery route logs delivered, not a second impression", () => {
    const route = readFileSync(
      join(ROOT, "src/app/api/journal/today-quote/route.ts"),
      "utf8"
    );
    expect(route).toContain('event_type: "delivered"');
    expect(route).not.toContain('"quote_impression"');
    expect(route).not.toContain('"sentence_impression"');

    // 진짜 impression은 모달(사용자가 실제로 본 시점)이 담당한다
    const modal = readFileSync(
      join(ROOT, "src/components/journal/JournalSaveCompleteModal.tsx"),
      "utf8"
    );
    expect(modal).toContain("quote_impression");
    expect(modal).toContain("sentence_impression");
  });
});

describe("content feedback", () => {
  test("every rating validates", () => {
    for (const rating of CONTENT_FEEDBACK_RATINGS) {
      expect(
        validateContentFeedbackInput({
          eventDate: "2026-07-25",
          contentType: "verified_quote",
          rating,
        }).ok
      ).toBe(true);
    }
  });

  test("unknown ratings are rejected", () => {
    expect(
      validateContentFeedbackInput({
        eventDate: "2026-07-25",
        contentType: "verified_quote",
        rating: "amazing" as never,
      }).ok
    ).toBe(false);
  });

  test("saved and shared reach the server from the save modal", () => {
    const modal = readFileSync(
      join(ROOT, "src/components/journal/JournalSaveCompleteModal.tsx"),
      "utf8"
    );
    expect(modal).toContain("saved: true");
    expect(modal).toContain("shared: true");
  });
});
