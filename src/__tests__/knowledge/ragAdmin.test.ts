import { afterEach, describe, expect, test } from "@jest/globals";
import { getAdminEmails, isAdminEmail } from "@/lib/auth/admin";
import {
  assertNoSensitiveNarrativeFields,
  buildRetrievalQuery,
  containsForbiddenNarrative,
  isNarrativeRequest,
  sanitizeNarrativeWording,
} from "@/lib/narrative/schema";
import { chunkText, cosineSimilarity } from "@/lib/rag";

describe("admin emails (fail-closed)", () => {
  const original = process.env.ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  test("ADMIN_EMAILS가 비어 있으면 전원 거부", () => {
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("admin@example.com")).toBe(false);
  });

  test("쉼표·대소문자·공백을 정규화한다", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com , other@test.com ";
    expect(getAdminEmails()).toEqual([
      "admin@example.com",
      "other@test.com",
    ]);
    expect(isAdminEmail("ADMIN@example.com")).toBe(true);
    expect(isAdminEmail("stranger@example.com")).toBe(false);
  });
});

describe("narrative privacy", () => {
  test("원문·생년월일·원국 필드를 거부한다", () => {
    expect(assertNoSensitiveNarrativeFields({ content: "일기" })).toMatch(
      /content/
    );
    expect(
      assertNoSensitiveNarrativeFields({ birthDate: "1990-01-01" })
    ).toMatch(/birthDate/);
    expect(
      assertNoSensitiveNarrativeFields({
        surface: "today_beginner",
        facts: { pillars: { day: "갑자" } },
      })
    ).toMatch(/pillars/);
  });

  test("구조화 사실만 있으면 통과한다", () => {
    expect(
      assertNoSensitiveNarrativeFields({
        surface: "today_beginner",
        facts: { ganjiKo: "갑자", tenGod: "비견" },
      })
    ).toBeNull();
  });

  test("유효한 surface만 NarrativeRequest로 인정한다", () => {
    expect(
      isNarrativeRequest({
        surface: "forecast",
        facts: { ganjiKo: "을축" },
      })
    ).toBe(true);
    expect(isNarrativeRequest({ surface: "hack", facts: {} })).toBe(false);
  });

  test("검색 쿼리는 구조화 라벨만 포함한다", () => {
    const q = buildRetrievalQuery({
      tenGod: "식신",
      heavenlyStem: "갑",
      earthlyBranch: "자",
      ganjiKo: "갑자",
      relationLabels: ["충"],
    });
    expect(q).toContain("십신 식신");
    expect(q).toContain("일진 갑자");
    expect(q).not.toMatch(/1990/);
  });

  test("금지 표현이 있으면 wording을 폐기한다", () => {
    expect(containsForbiddenNarrative("병원에 가세요")).toBe(true);
    expect(
      sanitizeNarrativeWording({ summary: "오늘은 집중하기 좋은 흐름입니다." })
    ).toEqual({ summary: "오늘은 집중하기 좋은 흐름입니다." });
    expect(
      sanitizeNarrativeWording({ summary: "우울증이 올 수 있습니다." })
    ).toBeNull();
  });
});

describe("rag chunkText", () => {
  test("충분히 긴 텍스트를 겹치는 청크로 나눈다", () => {
    const text = "가".repeat(500);
    const chunks = chunkText(text, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length >= 20)).toBe(true);
  });

  test("짧은 조각은 버린다", () => {
    expect(chunkText("짧음", 400, 80)).toEqual([]);
  });

  test("코사인 유사도는 동일 벡터에서 1에 가깝다", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
