/** 신규 일기(journal) 도메인 — Legacy diary_entries 와 분리 */

import type { JournalScore } from "./scoreScale";

/** 3 = A 점수 1~10 · 4 = 체크인 v2 (행복도 0~10 · mood_labels 등) */
export const JOURNAL_SCHEMA_VERSION = 4;

export const CHECKIN_VERSION_LEGACY = 1;
export const CHECKIN_VERSION_V2 = 2;

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

export type CoreStatePayload = {
  ordinal: number | null;
  isNotApplicable: boolean;
};

export type DomainScorePayload = {
  code: string;
  ordinal: number | null;
  isNotApplicable: boolean;
};

export type JournalEntry = {
  id: string;
  userId: string | null;
  /** Owning saju profile — journal data is isolated per profile */
  sajuProfileId: string | null;
  entryDate: string; // YYYY-MM-DD local date
  userTimezone: string;
  content: string;
  /** 레거시/호환 만족도 (체크인 v2에서는 happiness와 동기화, 0~10 가능) */
  overallSatisfaction: JournalScore | 0 | null;
  /** 체크인 v2 행복도 0~10 */
  happinessScore: number | null;
  moodLabel: string | null;
  /** 체크인 v2 복수 기분 (≤3) */
  moodLabels: string[];
  mainEventText: string | null;
  source: "new_diary" | "legacy_import";
  scores: CategoryScoreRecord[];
  tags: JournalEntryTag[];
  /** 체크인 v2 핵심 상태 원본 */
  coreStates: Record<string, CoreStatePayload> | null;
  /** 체크인 v2 조건부 도메인 */
  domainScores: DomainScorePayload[] | null;
  /** 1=레거시 에디터, 2=체크인 v2 */
  checkinVersion: number | null;
  /** 이 날짜에 XP를 이미 지급했는지 (수정 저장 시 중복 방지) */
  xpGranted: boolean;
  /** 최초 저장 시 지급된 XP (수정 시 유지) */
  xpAwarded: number;
  schemaVersion: number;
  /**
   * 이 날짜를 최초로 기록한 시각 — 회상 지연 계산용이라 재저장해도 갱신하지 않는다.
   * 레거시 데이터는 없을 수 있어 optional. 없으면 createdAt으로 대체한다.
   */
  firstRecordedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserCategoryPreference = {
  userId: string | null;
  sajuProfileId: string | null;
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

/** 체크인 v2 기분 (최대 3개 선택) — 키워드 랭킹·문장 안전필터와 연동 */
export const MOOD_OPTIONS = [
  "기쁨",
  "뿌듯함",
  "설렘",
  "평온",
  "무덤덤",
  "지침",
  "답답함",
  "짜증남",
  "불안",
  "분노",
  "슬픔",
  "우울함",
  "후회스러움",
] as const;
