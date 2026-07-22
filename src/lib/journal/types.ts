/** 신규 일기(journal) 도메인 — Legacy diary_entries 와 분리 */

export const JOURNAL_SCHEMA_VERSION = 1;

export type CategoryCode =
  | "emotional_balance"
  | "energy"
  | "recovery_sleep"
  | "physical_condition"
  | "focus_execution"
  | "work_study"
  | "relationship"
  | "finance_resource"
  | "change_opportunity";

export type CategoryDefinition = {
  code: CategoryCode;
  name: string;
  question: string;
  meaning: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  schemaVersion: number;
};

/** 1–5 또는 해당 없음(결측). 미선택과 구분하기 위해 UI에서는 undefined 사용 */
export type CategoryScoreValue =
  | { kind: "score"; rawScore: 1 | 2 | 3 | 4 | 5 }
  | { kind: "not_applicable" }
  | { kind: "unset" };

export type CategoryScoreRecord = {
  id: string;
  entryId: string;
  userId: string | null;
  categoryCode: CategoryCode;
  /** null when not_applicable or unset-not-saved */
  rawScore: 1 | 2 | 3 | 4 | 5 | null;
  isNotApplicable: boolean;
  normalizedZ: number | null;
  normalizationVersion: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventTagCode = string;

export type EventTagDefinition = {
  tagCode: EventTagCode;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  schemaVersion: number;
};

export type JournalEntryTag = {
  tagCode: EventTagCode;
  source: "user" | "ai_suggested" | "legacy_import";
  confirmedByUser: boolean;
};

export type JournalEntry = {
  id: string;
  userId: string | null;
  entryDate: string; // YYYY-MM-DD local date
  userTimezone: string;
  content: string;
  overallSatisfaction: 1 | 2 | 3 | 4 | 5 | null;
  moodLabel: string | null;
  mainEventText: string | null;
  source: "new_diary" | "legacy_import";
  scores: CategoryScoreRecord[];
  tags: JournalEntryTag[];
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type UserCategoryPreference = {
  userId: string | null;
  categoryCode: CategoryCode;
  enabled: boolean;
  sortOrder: number;
  enabledAt: string | null;
  disabledAt: string | null;
  updatedAt: string;
};

export const MIN_ENABLED_CATEGORIES = 4;
export const MAX_ENABLED_CATEGORIES = 9;
export const RECOMMENDED_ENABLED_CATEGORIES = 6;

export const SCORE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "매우 좋지 않음",
  2: "좋지 않음",
  3: "보통",
  4: "좋음",
  5: "매우 좋음",
};

export const MOOD_OPTIONS = [
  "기쁨",
  "평온",
  "설렘",
  "지침",
  "불안",
  "분노",
  "슬픔",
  "무덤덤",
] as const;
