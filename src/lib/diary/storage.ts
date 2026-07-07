import type { DiaryEntry, DiaryListOptions } from "./types";

export interface DiaryStorage {
  save(entry: DiaryEntry): Promise<void>;
  getByDate(date: string): Promise<DiaryEntry | null>;
  getById(id: string): Promise<DiaryEntry | null>;
  list(opts?: DiaryListOptions): Promise<DiaryEntry[]>;
  listByDayPillar(ganjiKo: string): Promise<DiaryEntry[]>;
  delete(id: string): Promise<void>;
}
