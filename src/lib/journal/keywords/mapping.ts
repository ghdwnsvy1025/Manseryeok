/**
 * 레거시 → canonical 키워드 매핑 (버전 관리)
 * — 단순 문자열 치환이 아니라 가중치·버전을 가진 매핑 테이블.
 * — 기존 데이터는 당시 키워드+버전을 보존하고, 신규 데이터부터 canonical 사용.
 * — 관리자 화면에서 현재 버전을 확인할 수 있다 (getActiveKeywordMapping).
 */
import {
  isCanonicalKeywordCode,
  type CanonicalKeywordCode,
} from "./canonical";

export type KeywordMappingSourceType = "legacy_keyword";

export type KeywordMappingEntry = {
  sourceType: KeywordMappingSourceType;
  /** 레거시 KeywordCode 또는 plainLabel */
  sourceValue: string;
  targetKeyword: CanonicalKeywordCode;
  weight: number;
};

export type KeywordMapping = {
  mappingType: "legacy_keyword_to_canonical";
  mappingVersion: string;
  activeFrom: string;
  activeTo: string | null;
  entries: KeywordMappingEntry[];
};

/**
 * v1.0.0 매핑.
 * 레거시 KeywordCode(catalog.ts) 기준. 다중 매핑은 weight로 분배.
 */
const MAPPING_V1: KeywordMapping = {
  mappingType: "legacy_keyword_to_canonical",
  mappingVersion: "keyword-map-v1.0.0",
  activeFrom: "2026-07-25",
  activeTo: null,
  entries: [
    // 1:1
    { sourceType: "legacy_keyword", sourceValue: "recovery", targetKeyword: "recovery", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "rest", targetKeyword: "recovery", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "expression", targetKeyword: "emotion_expression", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "stability", targetKeyword: "stability", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "change", targetKeyword: "change_acceptance", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "focus", targetKeyword: "focus", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "recognition", targetKeyword: "achievement", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "responsibility", targetKeyword: "responsibility_regulation", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "freedom", targetKeyword: "self_direction", weight: 1 },
    { sourceType: "legacy_keyword", sourceValue: "decision", targetKeyword: "decision_organize", weight: 1 },
    // 1:N
    { sourceType: "legacy_keyword", sourceValue: "health", targetKeyword: "recovery", weight: 0.5 },
    { sourceType: "legacy_keyword", sourceValue: "health", targetKeyword: "vitality", weight: 0.5 },
    { sourceType: "legacy_keyword", sourceValue: "relation", targetKeyword: "relation_connect", weight: 0.6 },
    { sourceType: "legacy_keyword", sourceValue: "relation", targetKeyword: "relation_boundary", weight: 0.4 },
    { sourceType: "legacy_keyword", sourceValue: "conflict", targetKeyword: "relation_boundary", weight: 0.6 },
    { sourceType: "legacy_keyword", sourceValue: "conflict", targetKeyword: "emotion_expression", weight: 0.4 },
    { sourceType: "legacy_keyword", sourceValue: "work", targetKeyword: "focus", weight: 0.34 },
    { sourceType: "legacy_keyword", sourceValue: "work", targetKeyword: "execution", weight: 0.33 },
    { sourceType: "legacy_keyword", sourceValue: "work", targetKeyword: "achievement", weight: 0.33 },
    { sourceType: "legacy_keyword", sourceValue: "money", targetKeyword: "finance_manage", weight: 0.6 },
    { sourceType: "legacy_keyword", sourceValue: "money", targetKeyword: "decision_organize", weight: 0.4 },
    { sourceType: "legacy_keyword", sourceValue: "growth", targetKeyword: "change_acceptance", weight: 0.5 },
    { sourceType: "legacy_keyword", sourceValue: "growth", targetKeyword: "reflection_meaning", weight: 0.5 },
  ],
};

/** 이전 버전 보존 (감사·재현용). 현재는 v1만 존재. */
export const KEYWORD_MAPPING_VERSIONS: KeywordMapping[] = [MAPPING_V1];

export function getActiveKeywordMapping(): KeywordMapping {
  const active = KEYWORD_MAPPING_VERSIONS.filter((m) => m.activeTo == null);
  return active[active.length - 1] ?? MAPPING_V1;
}

export function getKeywordMappingByVersion(
  version: string
): KeywordMapping | undefined {
  return KEYWORD_MAPPING_VERSIONS.find((m) => m.mappingVersion === version);
}

/** 매핑 스키마 검증 — 알 수 없는 target / 음수 weight 차단 */
export function validateKeywordMapping(
  mapping: KeywordMapping
): { ok: true } | { ok: false; error: string } {
  if (!mapping.mappingVersion) {
    return { ok: false, error: "mappingVersion 누락" };
  }
  for (const e of mapping.entries) {
    if (!isCanonicalKeywordCode(e.targetKeyword)) {
      return { ok: false, error: `알 수 없는 target: ${e.targetKeyword}` };
    }
    if (!(e.weight > 0)) {
      return { ok: false, error: `weight는 양수여야 함: ${e.sourceValue}` };
    }
  }
  return { ok: true };
}

/**
 * 레거시 키워드(코드/라벨) → canonical 코드 목록 (weight 내림차순).
 */
export function mapLegacyKeyword(
  legacyValue: string,
  version?: string
): Array<{ code: CanonicalKeywordCode; weight: number }> {
  const mapping = version
    ? getKeywordMappingByVersion(version) ?? getActiveKeywordMapping()
    : getActiveKeywordMapping();
  return mapping.entries
    .filter((e) => e.sourceValue === legacyValue)
    .map((e) => ({ code: e.targetKeyword, weight: e.weight }))
    .sort((a, b) => b.weight - a.weight);
}
