import { describe, expect, test } from "@jest/globals";
import { validateBetaFeedbackInput } from "@/lib/feedback/betaFeedback";

describe("validateBetaFeedbackInput", () => {
  test("accepts valid payload", () => {
    const r = validateBetaFeedbackInput({
      category: "bug",
      message: "저장 버튼이 안 눌려요",
      path: "/journal",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.category).toBe("bug");
      expect(r.path).toBe("/journal");
    }
  });

  test("rejects empty message and bad path", () => {
    expect(
      validateBetaFeedbackInput({ category: "idea", message: "   " }).ok
    ).toBe(false);
    const r = validateBetaFeedbackInput({
      category: "other",
      message: "ok",
      path: "//evil",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/");
  });
});
