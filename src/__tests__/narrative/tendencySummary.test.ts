import { describe, expect, test } from "@jest/globals";
import {
  buildTendencyRetrievalQuery,
  parseThreeLines,
} from "@/lib/narrative/tendencySummary";

describe("tendencySummary", () => {
  test("parseThreeLines keeps first three non-empty lines", () => {
    const raw = `첫 줄 성향입니다.
두 번째 줄입니다.
세 번째 줄입니다.
네 번째는 무시`;
    expect(parseThreeLines(raw)).toEqual([
      "첫 줄 성향입니다.",
      "두 번째 줄입니다.",
      "세 번째 줄입니다.",
    ]);
  });

  test("parseThreeLines strips bullets", () => {
    expect(
      parseThreeLines(`1. 하나
- 둘
• 셋`)
    ).toEqual(["하나", "둘", "셋"]);
  });

  test("parseThreeLines fails under three lines", () => {
    expect(parseThreeLines("한 줄만\n두 줄")).toBeNull();
  });

  test("buildTendencyRetrievalQuery includes hints", () => {
    const q = buildTendencyRetrievalQuery({
      ganjiKo: "갑자",
      heavenlyStem: "갑",
    });
    expect(q).toContain("갑자");
    expect(q).toContain("갑");
    expect(q).toContain("성향");
  });
});
