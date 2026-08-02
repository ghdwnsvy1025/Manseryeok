import type { CategoryCode } from "@/lib/journal/types";

/**
 * 매일 묻는 핵심 4 (5단계 서열)
 * — 레거시 핵심(감정/에너지/수면/집중)은 adaptLegacyCoreStates로 해석
 */
export const CORE_STATE_CODES = [
  "energy",
  "focus_execution",
  "physical_condition",
  "emotional_balance",
] as const satisfies readonly CategoryCode[];

export type CoreStateCode = (typeof CORE_STATE_CODES)[number];

/** 조건부 생활영역 후보 (하루 최대 2) — 수면·회복 포함 */
export const DOMAIN_POOL_CODES = [
  "recovery_sleep",
  "work_study",
  "relationship",
  "finance_resource",
  "change_opportunity",
] as const satisfies readonly CategoryCode[];

export type DomainCode = (typeof DOMAIN_POOL_CODES)[number];

/** 체크인 기분: 최소 1 · 최대 3 */
export const MAX_MOODS = 3;
/** 저장 시 기분 최소 개수 */
export const MIN_MOODS = 1;
export const MAX_CHECKIN_TAGS = 3;
export const MAX_DAILY_DOMAINS = 2;

/** 다른 사건과 동시 저장 불가 */
export const NONE_SPECIAL_TAG = "none_special";
/** 자유 기타 */
export const OTHER_EVENT_TAG = "other";

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
    id: "base",
    name: "기본",
    tagCodes: [NONE_SPECIAL_TAG, OTHER_EVENT_TAG],
  },
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

/** 태그 → 연관 도메인 (점수 가산용, 단독 결정 아님) */
export const TAG_DOMAIN_HINTS: Partial<Record<string, DomainCode[]>> = {
  illness: ["recovery_sleep"],
  exercise: ["recovery_sleep"],
  rest: ["recovery_sleep"],
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
export function ordinalToJournalScore(
  ordinal: OrdinalScore
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  const map = {
    1: 1,
    2: 3,
    3: 5,
    4: 8,
    5: 10,
  } as const;
  return map[ordinal];
}

/** 카테고리 A(1~10) → 5단계 (로드 복원용) */
export function journalScoreToOrdinal(score: number): OrdinalScore | null {
  if (!Number.isFinite(score)) return null;
  const exact: Record<number, OrdinalScore> = {
    1: 1,
    3: 2,
    5: 3,
    8: 4,
    10: 5,
  };
  if (exact[score] != null) return exact[score]!;
  if (score <= 1.5) return 1;
  if (score <= 3.5) return 2;
  if (score <= 5.5) return 3;
  if (score <= 8.5) return 4;
  if (score <= 10) return 5;
  return null;
}

/** 레거시 핵심 상태(수면 포함) → 신규 4항목 어댑터 */
export function adaptLegacyCoreStates(
  raw: Record<string, { ordinal: number | null; isNotApplicable?: boolean }> | null | undefined
): Record<CoreStateCode, { ordinal: number | null; isNotApplicable: boolean }> {
  const empty = (): { ordinal: number | null; isNotApplicable: boolean } => ({
    ordinal: null,
    isNotApplicable: false,
  });
  const out: Record<CoreStateCode, { ordinal: number | null; isNotApplicable: boolean }> = {
    energy: empty(),
    focus_execution: empty(),
    physical_condition: empty(),
    emotional_balance: empty(),
  };
  if (!raw) return out;
  for (const code of CORE_STATE_CODES) {
    const row = raw[code];
    if (row) {
      out[code] = {
        ordinal: row.ordinal,
        isNotApplicable: Boolean(row.isNotApplicable),
      };
    }
  }
  // 레거시: recovery_sleep가 핵심이었던 기록 — 조건부 영역으로만 쓰므로 코어에 넣지 않음
  return out;
}
