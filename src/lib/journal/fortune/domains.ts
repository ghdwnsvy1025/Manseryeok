/**
 * 운세 영역 ↔ 16키워드 매핑 (마스터 1A)
 */
import type { KeywordCode } from "@/lib/journal/keywords/catalog";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";

export const FORTUNE_DOMAIN_ORDER: FortuneDomainCode[] = [
  "overall",
  "work",
  "relationship",
  "finance",
  "health",
];

export const FORTUNE_DOMAIN_TITLES: Record<FortuneDomainCode, string> = {
  overall: "종합운",
  work: "일·학업운",
  relationship: "관계·연애운",
  finance: "재물운",
  health: "건강·회복운",
};

/** 영역별 우선 키워드 */
export const DOMAIN_KEYWORD_MAP: Record<FortuneDomainCode, KeywordCode[]> = {
  overall: [], // 상위 키워드 전체 결합
  work: [
    "focus",
    "work",
    "recognition",
    "responsibility",
    "freedom",
    "decision",
    "change",
    "recovery",
  ],
  relationship: [
    "relation",
    "conflict",
    "expression",
    "stability",
    "freedom",
    "change",
  ],
  finance: [
    "money",
    "decision",
    "responsibility",
    "recognition",
    "freedom",
    "change",
    "stability",
  ],
  health: [
    "recovery",
    "health",
    "stability",
    "rest",
    "responsibility",
    "growth",
  ],
};

/** 영역 ↔ 카테고리 점수 힌트 */
export const DOMAIN_CATEGORY_HINTS: Record<FortuneDomainCode, string[]> = {
  overall: [],
  work: ["focus_execution", "work_study"],
  relationship: ["relationship", "emotional_balance"],
  finance: ["finance_resource", "change_opportunity"],
  health: ["energy", "physical_condition", "recovery_sleep"],
};
