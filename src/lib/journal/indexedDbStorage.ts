import type { JournalStorage, JournalSaveInput } from "./storage";
import type {
  CategoryCode,
  CategoryScoreRecord,
  JournalEntry,
  JournalEntryTag,
  UserCategoryPreference,
} from "./types";
import { JOURNAL_SCHEMA_VERSION } from "./types";
import { isCategoryCode } from "./categoryCatalog";
import {
  loadCategoryPreferencesLocal,
  saveCategoryPreferencesLocal,
} from "./preferences";
import {
  validateScorePayload,
  validateTagCodes,
} from "./validation";

const DB_NAME = "manseryeok-journal";
const DB_VERSION = 1;
const ENTRY_STORE = "journal_entries";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        const store = db.createObjectStore(ENTRY_STORE, { keyPath: "id" });
        store.createIndex("entryDate", "entryDate", { unique: true });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(ENTRY_STORE, mode);
        const store = tx.objectStore(ENTRY_STORE);
        const req = fn(store);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve(req.result as T);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function buildScores(
  entryId: string,
  userId: string | null,
  now: string,
  inputScores: JournalSaveInput["scores"],
  previous: CategoryScoreRecord[]
): CategoryScoreRecord[] {
  const prevByCode = new Map(previous.map((s) => [s.categoryCode, s]));
  const out: CategoryScoreRecord[] = [];

  for (const row of inputScores) {
    const check = validateScorePayload(row);
    if (!check.ok) throw new Error(check.error);
    if (!isCategoryCode(row.categoryCode)) continue;

    // unset: skip writing a row (or keep previous if editing — omit)
    if (!row.isNotApplicable && row.rawScore == null) {
      continue;
    }

    const prev = prevByCode.get(row.categoryCode);
    out.push({
      id: prev?.id ?? generateId(),
      entryId,
      userId,
      categoryCode: row.categoryCode,
      rawScore: row.isNotApplicable ? null : row.rawScore,
      isNotApplicable: row.isNotApplicable,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    });
  }
  return out;
}

export class IndexedDbJournalStorage implements JournalStorage {
  async getByDate(entryDate: string): Promise<JournalEntry | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ENTRY_STORE, "readonly");
      const store = tx.objectStore(ENTRY_STORE);
      const index = store.index("entryDate");
      const req = index.get(entryDate);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        resolve((req.result as JournalEntry) ?? null);
        db.close();
      };
    });
  }

  async list(): Promise<JournalEntry[]> {
    const all = await runStore("readonly", (store) => store.getAll());
    return (all as JournalEntry[]).sort((a, b) =>
      b.entryDate.localeCompare(a.entryDate)
    );
  }

  async save(input: JournalSaveInput): Promise<JournalEntry> {
    const tagCheck = validateTagCodes(input.tagCodes);
    if (!tagCheck.ok) throw new Error(tagCheck.error);

    for (const row of input.scores) {
      const check = validateScorePayload(row);
      if (!check.ok) throw new Error(check.error);
    }
    if (
      input.overallSatisfaction != null &&
      (input.overallSatisfaction < 1 || input.overallSatisfaction > 5)
    ) {
      throw new Error("종합 만족도는 1~5만 허용됩니다.");
    }

    const now = new Date().toISOString();
    const existing =
      (input.existingId
        ? await runStore<JournalEntry | undefined>("readonly", (s) =>
            s.get(input.existingId!)
          )
        : null) ?? (await this.getByDate(input.entryDate));

    // Enforce one entry per date: if another id exists for date, upsert that row
    const byDate = await this.getByDate(input.entryDate);
    const base = byDate ?? existing;

    const id = base?.id ?? generateId();
    const scores = buildScores(
      id,
      base?.userId ?? null,
      now,
      input.scores,
      base?.scores ?? []
    );
    const tags: JournalEntryTag[] = input.tagCodes.map((tagCode) => ({
      tagCode,
      source: "user" as const,
      confirmedByUser: true,
    }));

    const entry: JournalEntry = {
      id,
      userId: base?.userId ?? null,
      entryDate: input.entryDate,
      userTimezone: input.userTimezone ?? "Asia/Seoul",
      content: input.content,
      overallSatisfaction: input.overallSatisfaction,
      moodLabel: input.moodLabel,
      mainEventText: input.mainEventText,
      source: "new_diary",
      scores,
      tags,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };

    await runStore("readwrite", (store) => store.put(entry));
    return entry;
  }

  async getPreferences(): Promise<UserCategoryPreference[]> {
    return loadCategoryPreferencesLocal(null);
  }

  async savePreferences(prefs: UserCategoryPreference[]): Promise<void> {
    const result = saveCategoryPreferencesLocal(prefs);
    if (!result.ok) throw new Error(result.error);
  }
}

export function getIndexedDbJournalStorage(): JournalStorage {
  return new IndexedDbJournalStorage();
}

/** 테스트용 인메모리 저장소 */
export class MemoryJournalStorage implements JournalStorage {
  private entries = new Map<string, JournalEntry>();
  private prefs: UserCategoryPreference[] | null = null;

  async getByDate(entryDate: string): Promise<JournalEntry | null> {
    return Array.from(this.entries.values()).find((e) => e.entryDate === entryDate) ?? null;
  }

  async list(): Promise<JournalEntry[]> {
    return Array.from(this.entries.values()).sort((a, b) =>
      b.entryDate.localeCompare(a.entryDate)
    );
  }

  async save(input: JournalSaveInput): Promise<JournalEntry> {
    const tagCheck = validateTagCodes(input.tagCodes);
    if (!tagCheck.ok) throw new Error(tagCheck.error);
    for (const row of input.scores) {
      const check = validateScorePayload(row);
      if (!check.ok) throw new Error(check.error);
    }
    const now = new Date().toISOString();
    const existing = await this.getByDate(input.entryDate);
    const id = existing?.id ?? generateId();
    const scores = buildScores(
      id,
      "test-user",
      now,
      input.scores,
      existing?.scores ?? []
    );
    const entry: JournalEntry = {
      id,
      userId: "test-user",
      entryDate: input.entryDate,
      userTimezone: input.userTimezone ?? "Asia/Seoul",
      content: input.content,
      overallSatisfaction: input.overallSatisfaction,
      moodLabel: input.moodLabel,
      mainEventText: input.mainEventText,
      source: "new_diary",
      scores,
      tags: input.tagCodes.map((tagCode) => ({
        tagCode,
        source: "user",
        confirmedByUser: true,
      })),
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entries.set(id, entry);
    Array.from(this.entries.entries()).forEach(([k, v]) => {
      if (v.entryDate === entry.entryDate && k !== id) this.entries.delete(k);
    });
    return entry;
  }

  async getPreferences(): Promise<UserCategoryPreference[]> {
    if (this.prefs) return this.prefs;
    const { createDefaultPreferences } = await import("./preferences");
    return createDefaultPreferences("test-user");
  }

  async savePreferences(prefs: UserCategoryPreference[]): Promise<void> {
    const enabled = prefs.filter((p) => p.enabled).map((p) => p.categoryCode);
    const { validateEnabledCategorySelection } = await import("./validation");
    const check = validateEnabledCategorySelection(enabled as CategoryCode[]);
    if (!check.ok) throw new Error(check.error);
    this.prefs = prefs.map((p) => ({ ...p, userId: "test-user" }));
  }
}
