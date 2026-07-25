import type { CategoryCode } from "@/lib/journal/types";

/** 매일 묻는 핵심 4 (5단계 서열) */
export const CORE_STATE_CODES = [
  "emotional_balance",
  "energy",
  "recovery_sleep",
  "focus_execution",
] as const satisfies readonly CategoryCode[];

export type CoreStateCode = (typeof CORE_STATE_CODES)[number];

/** 조건부 생활영역 후보 (하루 최대 2) */
export const DOMAIN_POOL_CODES = [
  "physical_condition",
  "work_study",
  "relationship",
  "finance_resource",
  "change_opportunity",
] as const satisfies readonly CategoryCode[];

export type DomainCode = (typeof DOMAIN_POOL_CODES)[number];

export const MAX_MOODS = 3;
export const MAX_CHECKIN_TAGS = 3;
export const MAX_DAILY_DOMAINS = 2;

/** 5단계 서열 (높을수록 긍정) */
export type OrdinalScore = 1 | 2 | 3 | 4 | 5;

export const ORDINAL_VALUES: OrdinalScore[] = [1, 2, 3, 4, 5];

export const ORDINAL_LABELS: Record<OrdinalScore, string> = {
  1: "매우 나쁨",
  2: "나쁨",
  3: "보통",
  4: "좋음",
  5: "매우 좋음",
};

export type TagGroup = {
  id: string;
  name: string;
  tagCodes: string[];
};

/** 사건 태그 UI 그룹 */
export const CHECKIN_TAG_GROUPS: TagGroup[] = [
  {
    id: "growth",
    name: "성장",
    tagCodes: ["new_start", "achievement", "learning"],
  },
  {
    id: "people",
    name: "관계",
    tagCodes: ["meeting", "conflict", "family"],
  },
  {
    id: "money",
    name: "돈",
    tagCodes: ["income", "big_spend"],
  },
  {
    id: "body",
    name: "몸",
    tagCodes: ["exercise", "illness", "rest"],
  },
  {
    id: "daily",
    name: "일상",
    tagCodes: ["travel", "mistake", "decision", "work_pressure"],
  },
];

/** 태그 → 우선 도메인 힌트 */
export const TAG_DOMAIN_HINTS: Partial<Record<string, DomainCode[]>> = {
  illness: ["physical_condition"],
  exercise: ["physical_condition"],
  rest: ["physical_condition"],
  work_pressure: ["work_study"],
  learning: ["work_study"],
  achievement: ["work_study"],
  meeting: ["relationship"],
  conflict: ["relationship"],
  family: ["relationship"],
  income: ["finance_resource"],
  big_spend: ["finance_resource"],
  new_start: ["change_opportunity"],
  travel: ["change_opportunity"],
  decision: ["change_opportunity"],
};

export function isCoreStateCode(code: string): code is CoreStateCode {
  return (CORE_STATE_CODES as readonly string[]).includes(code);
}

export function isDomainCode(code: string): code is DomainCode {
  return (DOMAIN_POOL_CODES as readonly string[]).includes(code);
}

export function isOrdinalScore(value: unknown): value is OrdinalScore {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/** 5단계 → 카테고리 A(1~10) */
export function ordinalToJournalScore(ordinal: OrdinalScore): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  const map = {
    1: 1,
    2: 3,
    3: 5,
    4: 8,
    5: 10,
  } as const;
  return map[ordinal];
}
