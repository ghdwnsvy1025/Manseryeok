import { describe, expect, test } from "@jest/globals";
import {
  sajuHypothesisWeight,
  validateQuestionFeedbackInput,
} from "@/lib/journal/questionFeedback";

describe("question feedback", () => {
  test("validates event types and date", () => {
    expect(
      validateQuestionFeedbackInput({
        questionDate: "2026-07-25",
        eventType: "fit_good",
      }).ok
    ).toBe(true);
    expect(
      validateQuestionFeedbackInput({
        questionDate: "bad",
        eventType: "fit_good",
      }).ok
    ).toBe(false);
    expect(
      validateQuestionFeedbackInput({
        questionDate: "2026-07-25",
        eventType: "nope" as "shown",
      }).ok
    ).toBe(false);
  });

  test("saju weight decays with more prior days", () => {
    expect(sajuHypothesisWeight(0)).toBe(1);
    expect(sajuHypothesisWeight(30)).toBe(0.6);
    expect(sajuHypothesisWeight(60)).toBe(0.2);
    expect(sajuHypothesisWeight(100)).toBe(0.2);
    expect(sajuHypothesisWeight(10)).toBeLessThan(sajuHypothesisWeight(0));
  });
});
