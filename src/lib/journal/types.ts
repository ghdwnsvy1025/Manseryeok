/** 신규 일기(journal) 도메인 — Legacy diary_entries 와 분리 */

import type { JournalScore } from "./scoreScale";

/** 3 = A 점수 1~10 */
export const JOURNAL_SCHEMA_VERSION = 3;

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

/** 1–10 또는 해당 없음(결측). 미선택과 구분하기 위해 UI에서는 undefined 사용 */
export type CategoryScoreValue =
  | { kind: "score"; rawScore: JournalScore }
  | { kind: "not_applicable" }
  | { kind: "unset" };

export type CategoryScoreRecord = {
  id: string;
  entryId: string;
  userId: string | null;
  categoryCode: CategoryCode;
  /** 사용자가 직접 선택한 1~10. 해당 없음이면 null */
  userScore: JournalScore | null;
  /** AI가 일기 글에서 추출한 1~10. 근거 부족·실패 시 null */
  aiScore: number | null;
  /**
   * 통계·학습용 최종 A.
   * 해당 없음이면 null. 그 외 (user+ai)/2 또는 한쪽만.
   */
  finalScore: number | null;
  /**
   * @deprecated userScore와 동일. 하위 호환용.
   */
  rawScore: JournalScore | null;
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
  overallSatisfaction: JournalScore | null;
  moodLabel: string | null;
  mainEventText: string | null;
  source: "new_diary" | "legacy_import";
  scores: CategoryScoreRecord[];
  tags: JournalEntryTag[];
  /** 이 날짜에 XP를 이미 지급했는지 (수정 저장 시 중복 방지) */
  xpGranted: boolean;
  /** 최초 저장 시 지급된 XP (수정 시 유지) */
  xpAwarded: number;
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

export { JOURNAL_SCORE_LABELS as SCORE_LABELS } from "./scoreScale";
export type { JournalScore } from "./scoreScale";

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
