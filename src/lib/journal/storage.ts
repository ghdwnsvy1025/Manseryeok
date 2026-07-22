import type { JournalEntry, UserCategoryPreference } from "./types";

export type JournalSaveInput = {
  entryDate: string;
  userTimezone?: string;
  content: string;
  overallSatisfaction: 1 | 2 | 3 | 4 | 5 | null;
  moodLabel: string | null;
  mainEventText: string | null;
  /** categoryCode → score or N/A */
  scores: Array<{
    categoryCode: string;
    rawScore: 1 | 2 | 3 | 4 | 5 | null;
    isNotApplicable: boolean;
  }>;
  tagCodes: string[];
  existingId?: string;
};

export interface JournalStorage {
  getByDate(entryDate: string): Promise<JournalEntry | null>;
  save(input: JournalSaveInput): Promise<JournalEntry>;
  list(): Promise<JournalEntry[]>;
  getPreferences(): Promise<UserCategoryPreference[]>;
  savePreferences(prefs: UserCategoryPreference[]): Promise<void>;
}
