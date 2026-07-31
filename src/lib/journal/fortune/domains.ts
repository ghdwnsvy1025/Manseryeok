/**
 * 운세 영역 ↔ 키워드·카테고리 매핑
 */
import type { KeywordCode } from "@/lib/journal/keywords/catalog";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";

export const FORTUNE_DOMAIN_ORDER: FortuneDomainCode[] = [
  "overall",
  "work",
  "relationships",
  "love",
  "money",
  "health",
];

export const FORTUNE_DOMAIN_TITLES: Record<FortuneDomainCode, string> = {
  overall: "종합운",
  work: "직장운",
  relationships: "대인관계운",
  love: "연애운",
  money: "재물운",
  health: "건강운",
};

/** 구 캐시·로그 호환 */
export function normalizeFortuneDomainCode(
  raw: string
): FortuneDomainCode | null {
  if (raw === "relationship") return "relationships";
  if (raw === "finance") return "money";
  if (
    raw === "overall" ||
    raw === "work" ||
    raw === "relationships" ||
    raw === "love" ||
    raw === "money" ||
    raw === "health"
  ) {
    return raw;
  }
  return null;
}

/** 영역별 우선 키워드 */
export const DOMAIN_KEYWORD_MAP: Record<FortuneDomainCode, KeywordCode[]> = {
  overall: [],
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
  relationships: [
    "relation",
    "conflict",
    "expression",
    "stability",
    "freedom",
    "change",
  ],
  /** 연애: 같은 관계 점수를 쓰되 표현·관계 키워드에 기울임 */
  love: ["relation", "expression", "stability", "freedom", "conflict"],
  money: [
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
  relationships: ["relationship", "emotional_balance"],
  love: ["relationship", "emotional_balance"],
  money: ["finance_resource", "change_opportunity"],
  health: ["energy", "physical_condition", "recovery_sleep"],
};
