import { describe, expect, test } from "@jest/globals";
import {
  CANONICAL_KEYWORDS,
  CANONICAL_KEYWORD_COUNT,
  canonicalCodeByLabel,
} from "@/lib/journal/keywords/canonical";
import {
  getActiveKeywordMapping,
  mapLegacyKeyword,
  validateKeywordMapping,
  KEYWORD_MAPPING_VERSIONS,
} from "@/lib/journal/keywords/mapping";
import { rankCanonicalKeywords } from "@/lib/journal/keywords/rankCanonical";

describe("canonical 16-keyword taxonomy", () => {
  test("exactly 16 canonical keywords with expected labels", () => {
    expect(CANONICAL_KEYWORD_COUNT).toBe(16);
    expect(CANONICAL_KEYWORDS.map((k) => k.plainLabel)).toEqual([
      "회복",
      "활력",
      "안정",
      "감정인식",
      "감정표현",
      "관계연결",
      "관계경계",
      "집중",
      "실행",
      "성취",
      "책임조절",
      "자기주도",
      "변화수용",
      "결정·정리",
      "재정관리",
      "성찰·의미",
    ]);
  });

  test("active mapping validates and is versioned", () => {
    const mapping = getActiveKeywordMapping();
    expect(mapping.mappingVersion).toBe("keyword-map-v1.0.0");
    expect(validateKeywordMapping(mapping).ok).toBe(true);
    expect(KEYWORD_MAPPING_VERSIONS.length).toBeGreaterThanOrEqual(1);
  });

  test("legacy → canonical mapping (multi-target)", () => {
    expect(mapLegacyKeyword("rest").map((m) => m.code)).toEqual(["recovery"]);
    expect(mapLegacyKeyword("health").map((m) => m.code).sort()).toEqual(
      ["recovery", "vitality"].sort()
    );
    expect(mapLegacyKeyword("conflict").map((m) => m.code)).toEqual([
      "relation_boundary",
      "emotion_expression",
    ]);
    expect(mapLegacyKeyword("work").map((m) => m.code).sort()).toEqual(
      ["achievement", "execution", "focus"].sort()
    );
    expect(mapLegacyKeyword("money").map((m) => m.code)).toEqual([
      "finance_manage",
      "decision_organize",
    ]);
    expect(mapLegacyKeyword("growth").map((m) => m.code).sort()).toEqual(
      ["change_acceptance", "reflection_meaning"].sort()
    );
  });
});

describe("canonical keyword golden tests", () => {
  test("회복 필요 → 회복 / 책임조절 / 활력", () => {
    const { top } = rankCanonicalKeywords({
      moods: ["지침"],
      lowCategories: ["recovery_sleep", "energy"],
      tags: ["work_pressure"],
    });
    expect(top.map((t) => t.plainLabel)).toEqual(["회복", "책임조절", "활력"]);
  });

  test("관계 갈등 → 관계경계 / 감정표현 / 안정", () => {
    const { top } = rankCanonicalKeywords({
      moods: ["분노", "답답함"],
      lowCategories: ["relationship"],
      tags: ["conflict"],
    });
    expect(top.map((t) => t.plainLabel)).toEqual([
      "관계경계",
      "감정표현",
      "안정",
    ]);
  });

  test("변화와 설렘 → 변화수용 / 실행 / 안정", () => {
    const { top } = rankCanonicalKeywords({
      moods: ["설렘", "불안"],
      highCategories: ["change_opportunity"],
      tags: ["new_start"],
    });
    expect(top.map((t) => t.plainLabel)).toEqual([
      "변화수용",
      "실행",
      "안정",
    ]);
  });

  test("뿌듯함 → 성취 신호가 올라간다", () => {
    const { top } = rankCanonicalKeywords({
      moods: ["뿌듯함"],
      highCategories: ["work_study"],
    });
    expect(top[0]?.plainLabel).toBe("성취");
  });

  test("우울함·후회스러움은 회복·성찰 쪽으로", () => {
    const { top } = rankCanonicalKeywords({
      moods: ["우울함", "후회스러움"],
    });
    const labels = top.map((t) => t.plainLabel);
    expect(labels).toEqual(expect.arrayContaining(["회복", "성찰·의미"]));
  });

  test("deterministic: same input yields same ranking", () => {
    const input = {
      moods: ["지침"],
      lowCategories: ["recovery_sleep"],
      tags: ["work_pressure"],
    };
    const a = rankCanonicalKeywords(input).top.map((t) => t.code);
    const b = rankCanonicalKeywords(input).top.map((t) => t.code);
    expect(a).toEqual(b);
  });

  test("canonical label lookup roundtrip", () => {
    expect(canonicalCodeByLabel("회복")).toBe("recovery");
    expect(canonicalCodeByLabel("관계경계")).toBe("relation_boundary");
  });
});
