import { describe, expect, test } from "@jest/globals";
import { formatOpenAiUserHint } from "@/lib/journal/openaiStatus";

describe("formatOpenAiUserHint", () => {
  test("used → AI 맞춤 안내", () => {
    expect(formatOpenAiUserHint({ kind: "used" })).toContain("AI");
  });

  test("skipped / failed → 기본 문장", () => {
    expect(formatOpenAiUserHint({ kind: "skipped" })).toContain("기본");
    expect(formatOpenAiUserHint({ kind: "failed", reason: "timeout" })).toContain(
      "기본"
    );
  });

  test("cached skip → 다시 보여 드림", () => {
    expect(
      formatOpenAiUserHint({ kind: "skipped", detail: "cached" })
    ).toMatch(/다시|맞춰/);
  });

  test("scores surface wording", () => {
    expect(formatOpenAiUserHint({ kind: "used" }, "scores")).toContain("점수");
    expect(formatOpenAiUserHint({ kind: "skipped" }, "scores")).toContain(
      "입력값"
    );
  });
});
