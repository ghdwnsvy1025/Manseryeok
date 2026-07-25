/**
 * 질문 엔진용 16 키워드 카탈로그
 * — 사용자 노출 문구는 plainLabel만. 사주 용어는 넣지 않음.
 */

export type KeywordCode =
  | "relation"
  | "work"
  | "money"
  | "health"
  | "recovery"
  | "expression"
  | "decision"
  | "conflict"
  | "growth"
  | "stability"
  | "change"
  | "rest"
  | "focus"
  | "recognition"
  | "responsibility"
  | "freedom";

export type KeywordDefinition = {
  code: KeywordCode;
  /** 사용자·질문용 쉬운 말 */
  plainLabel: string;
  relatedCategories: string[];
  relatedTags: string[];
};

export const KEYWORD_CATALOG: KeywordDefinition[] = [
  {
    code: "relation",
    plainLabel: "관계",
    relatedCategories: ["relationship", "emotional_balance"],
    relatedTags: ["meeting", "conflict", "family"],
  },
  {
    code: "work",
    plainLabel: "일·성과",
    relatedCategories: ["work_study", "focus_execution"],
    relatedTags: ["work_pressure", "achievement", "learning"],
  },
  {
    code: "money",
    plainLabel: "돈·자원",
    relatedCategories: ["finance_resource"],
    relatedTags: ["income", "big_spend"],
  },
  {
    code: "health",
    plainLabel: "몸·컨디션",
    relatedCategories: ["physical_condition", "energy"],
    relatedTags: ["illness", "exercise"],
  },
  {
    code: "recovery",
    plainLabel: "회복",
    relatedCategories: ["recovery_sleep", "emotional_balance"],
    relatedTags: ["rest"],
  },
  {
    code: "expression",
    plainLabel: "표현",
    relatedCategories: ["emotional_balance", "focus_execution"],
    relatedTags: ["achievement"],
  },
  {
    code: "decision",
    plainLabel: "선택·결정",
    relatedCategories: ["focus_execution", "change_opportunity"],
    relatedTags: ["decision", "new_start"],
  },
  {
    code: "conflict",
    plainLabel: "갈등",
    relatedCategories: ["relationship", "emotional_balance"],
    relatedTags: ["conflict", "mistake"],
  },
  {
    code: "growth",
    plainLabel: "성장",
    relatedCategories: ["work_study", "change_opportunity"],
    relatedTags: ["learning", "new_start", "achievement"],
  },
  {
    code: "stability",
    plainLabel: "안정",
    relatedCategories: ["emotional_balance", "finance_resource"],
    relatedTags: ["rest", "family"],
  },
  {
    code: "change",
    plainLabel: "변화",
    relatedCategories: ["change_opportunity"],
    relatedTags: ["travel", "new_start", "decision"],
  },
  {
    code: "rest",
    plainLabel: "휴식",
    relatedCategories: ["recovery_sleep", "energy"],
    relatedTags: ["rest"],
  },
  {
    code: "focus",
    plainLabel: "집중",
    relatedCategories: ["focus_execution", "work_study"],
    relatedTags: ["work_pressure", "learning"],
  },
  {
    code: "recognition",
    plainLabel: "인정",
    relatedCategories: ["work_study", "relationship"],
    relatedTags: ["achievement"],
  },
  {
    code: "responsibility",
    plainLabel: "책임",
    relatedCategories: ["work_study", "focus_execution"],
    relatedTags: ["work_pressure", "decision", "family"],
  },
  {
    code: "freedom",
    plainLabel: "자유",
    relatedCategories: ["change_opportunity", "emotional_balance"],
    relatedTags: ["travel", "new_start"],
  },
];

export const KEYWORD_COUNT = KEYWORD_CATALOG.length;

export function getKeyword(code: string): KeywordDefinition | undefined {
  return KEYWORD_CATALOG.find((k) => k.code === code);
}

export function isKeywordCode(value: string): value is KeywordCode {
  return KEYWORD_CATALOG.some((k) => k.code === value);
}
