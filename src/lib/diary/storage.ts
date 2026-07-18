import type { DiaryEntry, DiaryListOptions, DiaryMonthRange } from "./types";

export interface DiaryStorage {
  save(entry: DiaryEntry): Promise<void>;
  getByDate(date: string): Promise<DiaryEntry | null>;
  getById(id: string): Promise<DiaryEntry | null>;
  list(opts?: DiaryListOptions): Promise<DiaryEntry[]>;
  listByDayPillar(ganjiKo: string): Promise<DiaryEntry[]>;
  listByMonth(range: DiaryMonthRange): Promise<DiaryEntry[]>;
  upsertMany(entries: DiaryEntry[]): Promise<void>;
  delete(id: string): Promise<void>;
}
