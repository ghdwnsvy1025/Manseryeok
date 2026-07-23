import type { JournalEntry, JournalScore, UserCategoryPreference } from "./types";

export type JournalScoreSaveRow = {
  categoryCode: string;
  /** 사용자 점수 — rawScore 별칭 허용 */
  userScore?: JournalScore | null;
  rawScore?: JournalScore | null;
  aiScore?: number | null;
  finalScore?: number | null;
  isNotApplicable: boolean;
};

export type JournalSaveInput = {
  entryDate: string;
  userTimezone?: string;
  content: string;
  overallSatisfaction: JournalScore | null;
  moodLabel: string | null;
  mainEventText: string | null;
  scores: JournalScoreSaveRow[];
  tagCodes: string[];
  /** 저장 시 활성 카테고리 — 검증용 (없으면 scores만으로 검증) */
  enabledCodes?: string[];
  existingId?: string;
  /** XP 덮어쓰기 (storage가 계산한 결과) */
  xpGranted?: boolean;
  xpAwarded?: number;
};

export type JournalSaveResult = {
  entry: JournalEntry;
  xp: {
    gainedXp: number;
    dayXp: number;
    wasFirstSaveOfDay: boolean;
    totalXp: number;
    level: number;
    leveledUp: boolean;
    previousLevel: number;
  };
};

export interface JournalStorage {
  getByDate(entryDate: string): Promise<JournalEntry | null>;
  /** @deprecated use saveWithMeta — 호환용, entry만 반환 */
  save(input: JournalSaveInput): Promise<JournalEntry>;
  saveWithMeta?(input: JournalSaveInput): Promise<JournalSaveResult>;
  list(): Promise<JournalEntry[]>;
  getPreferences(): Promise<UserCategoryPreference[]>;
  savePreferences(prefs: UserCategoryPreference[]): Promise<void>;
}
