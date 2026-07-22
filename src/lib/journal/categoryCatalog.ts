import type { CategoryCode, CategoryDefinition } from "./types";

/** 시스템 카테고리 seed — DB seed와 동일 내용. UI/오프라인은 이 목록을 사용 */
export const CATEGORY_CATALOG: CategoryDefinition[] = [
  {
    code: "emotional_balance",
    name: "감정·만족도",
    question: "오늘 감정은 편안하고 안정적이었나요?",
    meaning: "감정 안정과 만족",
    sortOrder: 1,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "energy",
    name: "에너지·활력",
    question: "오늘 몸과 마음에 움직일 힘이 있었나요?",
    meaning: "활력과 활동성",
    sortOrder: 2,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "recovery_sleep",
    name: "수면·회복",
    question: "오늘 충분히 쉬고 회복되었다고 느끼나요?",
    meaning: "수면과 회복",
    sortOrder: 3,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "physical_condition",
    name: "건강·신체 상태",
    question: "오늘 몸의 컨디션은 어땠나요?",
    meaning: "신체 체감 상태",
    sortOrder: 4,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "focus_execution",
    name: "집중·실행력",
    question: "계획한 일을 집중해서 실행했나요?",
    meaning: "집중, 결정, 마무리",
    sortOrder: 5,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "work_study",
    name: "일·학업 성과",
    question: "오늘 일이나 공부의 결과에 만족하나요?",
    meaning: "생산, 성취, 평가",
    sortOrder: 6,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "relationship",
    name: "관계·연애",
    question: "오늘 사람들과의 관계는 원만했나요?",
    meaning: "가족, 친구, 연애, 직장 관계",
    sortOrder: 7,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "finance_resource",
    name: "재정·소비",
    question: "오늘 돈과 자원을 잘 관리했다고 느끼나요?",
    meaning: "수입, 지출, 현실 관리",
    sortOrder: 8,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
  {
    code: "change_opportunity",
    name: "변화·기회",
    question: "오늘 새로운 시도나 변화의 기회가 있었나요?",
    meaning: "시작, 이동, 새 만남",
    sortOrder: 9,
    isActive: true,
    isSystem: true,
    schemaVersion: 1,
  },
];

export const DEFAULT_RECOMMENDED_CODES: CategoryCode[] = [
  "emotional_balance",
  "energy",
  "recovery_sleep",
  "focus_execution",
  "work_study",
  "relationship",
];

export function getCategoryByCode(code: string): CategoryDefinition | undefined {
  return CATEGORY_CATALOG.find((c) => c.code === code);
}

export function isCategoryCode(value: string): value is CategoryCode {
  return CATEGORY_CATALOG.some((c) => c.code === value);
}
