/**
 * 표준 16 키워드 체계 (canonical taxonomy)
 * — 레거시 KeywordCode(관계/일·성과/…)는 keywords/catalog.ts에 그대로 두고,
 *   신규 데이터는 이 canonical 체계를 사용한다.
 * — 사용자 노출 문구는 plainLabel만. 사주 용어 금지.
 */

export const CANONICAL_KEYWORD_VERSION = "canonical-keywords-v1.0.0";

export type CanonicalKeywordCode =
  | "recovery" // 회복
  | "vitality" // 활력
  | "stability" // 안정
  | "emotion_awareness" // 감정인식
  | "emotion_expression" // 감정표현
  | "relation_connect" // 관계연결
  | "relation_boundary" // 관계경계
  | "focus" // 집중
  | "execution" // 실행
  | "achievement" // 성취
  | "responsibility_regulation" // 책임조절
  | "self_direction" // 자기주도
  | "change_acceptance" // 변화수용
  | "decision_organize" // 결정·정리
  | "finance_manage" // 재정관리
  | "reflection_meaning"; // 성찰·의미

export type CanonicalKeywordDefinition = {
  code: CanonicalKeywordCode;
  plainLabel: string;
};

export const CANONICAL_KEYWORDS: CanonicalKeywordDefinition[] = [
  { code: "recovery", plainLabel: "회복" },
  { code: "vitality", plainLabel: "활력" },
  { code: "stability", plainLabel: "안정" },
  { code: "emotion_awareness", plainLabel: "감정인식" },
  { code: "emotion_expression", plainLabel: "감정표현" },
  { code: "relation_connect", plainLabel: "관계연결" },
  { code: "relation_boundary", plainLabel: "관계경계" },
  { code: "focus", plainLabel: "집중" },
  { code: "execution", plainLabel: "실행" },
  { code: "achievement", plainLabel: "성취" },
  { code: "responsibility_regulation", plainLabel: "책임조절" },
  { code: "self_direction", plainLabel: "자기주도" },
  { code: "change_acceptance", plainLabel: "변화수용" },
  { code: "decision_organize", plainLabel: "결정·정리" },
  { code: "finance_manage", plainLabel: "재정관리" },
  { code: "reflection_meaning", plainLabel: "성찰·의미" },
];

export const CANONICAL_KEYWORD_COUNT = CANONICAL_KEYWORDS.length;

const LABEL_BY_CODE = new Map(
  CANONICAL_KEYWORDS.map((k) => [k.code, k.plainLabel])
);
const CODE_BY_LABEL = new Map(
  CANONICAL_KEYWORDS.map((k) => [k.plainLabel, k.code])
);

export function isCanonicalKeywordCode(
  value: string
): value is CanonicalKeywordCode {
  return LABEL_BY_CODE.has(value as CanonicalKeywordCode);
}

export function canonicalLabel(code: CanonicalKeywordCode): string {
  return LABEL_BY_CODE.get(code) ?? code;
}

export function canonicalCodeByLabel(
  label: string
): CanonicalKeywordCode | undefined {
  return CODE_BY_LABEL.get(label);
}
