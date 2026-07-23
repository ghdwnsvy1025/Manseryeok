import type { JournalStorage, JournalSaveInput, JournalSaveResult } from "./storage";
import type {
  CategoryCode,
  CategoryScoreRecord,
  JournalEntry,
  JournalEntryTag,
  UserCategoryPreference,
} from "./types";
import { JOURNAL_SCHEMA_VERSION } from "./types";
import {
  migrateScoreToTen,
} from "./scoreScale";
import { isCategoryCode } from "./categoryCatalog";
import {
  createDefaultPreferences,
  getEnabledCodesOrdered,
  loadCategoryPreferencesLocal,
  saveCategoryPreferencesLocal,
} from "./preferences";
import {
  validateSaveScores,
  validateScorePayload,
  validateTagCodes,
} from "./validation";
import { buildCategoryScoreRecords } from "./buildScores";
import { applyJournalXpOnSave } from "./xp";

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

function normalizeEntry(raw: JournalEntry): JournalEntry {
  const schemaVersion = raw.schemaVersion ?? 1;

  const scale = (v: number | null | undefined): number | null => {
    if (v == null || !Number.isFinite(v)) return null;
    return migrateScoreToTen(v, schemaVersion);
  };

  return {
    ...raw,
    schemaVersion: Math.max(schemaVersion, JOURNAL_SCHEMA_VERSION),
    xpGranted: Boolean(raw.xpGranted),
    xpAwarded: typeof raw.xpAwarded === "number" ? raw.xpAwarded : 0,
    overallSatisfaction: scale(raw.overallSatisfaction) as JournalEntry["overallSatisfaction"],
    scores: (raw.scores ?? []).map((s) => {
      const userRaw =
        s.userScore !== undefined && s.userScore !== null
          ? s.userScore
          : s.rawScore;
      const userScore = scale(userRaw) as JournalEntry["scores"][number]["userScore"];
      const aiScore = scale(s.aiScore ?? null);
      const finalScore =
        s.finalScore !== undefined && s.finalScore !== null
          ? (scale(s.finalScore) as number)
          : s.isNotApplicable
            ? null
            : userScore;
      return {
        ...s,
        userScore: userScore ?? null,
        aiScore,
        finalScore,
        rawScore: userScore ?? null,
      };
    }),
  };
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
        const row = req.result as JournalEntry | undefined;
        resolve(row ? normalizeEntry(row) : null);
        db.close();
      };
    });
  }

  async list(): Promise<JournalEntry[]> {
    const all = await runStore("readonly", (store) => store.getAll());
    return (all as JournalEntry[])
      .map(normalizeEntry)
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }

  async save(input: JournalSaveInput): Promise<JournalEntry> {
    const result = await this.saveWithMeta(input);
    return result.entry;
  }

  async saveWithMeta(input: JournalSaveInput): Promise<JournalSaveResult> {
    const tagCheck = validateTagCodes(input.tagCodes);
    if (!tagCheck.ok) throw new Error(tagCheck.error);

    const prefs = await this.getPreferences();
    const enabledCodes = (input.enabledCodes?.filter(isCategoryCode) ??
      getEnabledCodesOrdered(prefs)) as CategoryCode[];

    const saveCheck = validateSaveScores({
      enabledCodes,
      scores: input.scores,
    });
    if (!saveCheck.ok) throw new Error(saveCheck.error);

    if (
      input.overallSatisfaction != null &&
      (input.overallSatisfaction < 1 || input.overallSatisfaction > 10)
    ) {
      throw new Error("종합 만족도는 1~10만 허용됩니다.");
    }

    const now = new Date().toISOString();
    const existing =
      (input.existingId
        ? await runStore<JournalEntry | undefined>("readonly", (s) =>
            s.get(input.existingId!)
          ).then((e) => (e ? normalizeEntry(e) : null))
        : null) ?? (await this.getByDate(input.entryDate));

    const byDate = await this.getByDate(input.entryDate);
    const base = byDate ?? existing;

    const id = base?.id ?? generateId();
    const scores = buildCategoryScoreRecords({
      entryId: id,
      userId: base?.userId ?? null,
      now,
      inputScores: input.scores,
      previous: base?.scores ?? [],
    });
    const tags: JournalEntryTag[] = input.tagCodes.map((tagCode) => ({
      tagCode,
      source: "user" as const,
      confirmedByUser: true,
    }));

    const allEntries = await this.list();
    const xp = applyJournalXpOnSave({
      existing: base,
      saveInput: input,
      allEntries,
    });

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
      xpGranted: xp.xpGranted,
      xpAwarded: xp.xpAwarded,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };

    await runStore("readwrite", (store) => store.put(entry));
    return { entry, xp: xp.result };
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
    const result = await this.saveWithMeta(input);
    return result.entry;
  }

  async saveWithMeta(input: JournalSaveInput): Promise<JournalSaveResult> {
    const tagCheck = validateTagCodes(input.tagCodes);
    if (!tagCheck.ok) throw new Error(tagCheck.error);

    const prefs = await this.getPreferences();
    const enabledCodes = (input.enabledCodes?.filter(isCategoryCode) ??
      getEnabledCodesOrdered(prefs)) as CategoryCode[];

    // 테스트에서 enabledCodes를 명시하지 않으면 느슨하게 단건 검증만
    if (input.enabledCodes && input.enabledCodes.length > 0) {
      const saveCheck = validateSaveScores({
        enabledCodes,
        scores: input.scores,
      });
      if (!saveCheck.ok) throw new Error(saveCheck.error);
    } else {
      for (const row of input.scores) {
        const check = validateScorePayload(row);
        if (!check.ok) throw new Error(check.error);
      }
    }

    const now = new Date().toISOString();
    const existing = await this.getByDate(input.entryDate);
    const id = existing?.id ?? generateId();
    const scores = buildCategoryScoreRecords({
      entryId: id,
      userId: "test-user",
      now,
      inputScores: input.scores,
      previous: existing?.scores ?? [],
    });

    const allEntries = await this.list();
    const xp = applyJournalXpOnSave({
      existing,
      saveInput: input,
      allEntries,
    });

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
      xpGranted: xp.xpGranted,
      xpAwarded: xp.xpAwarded,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.entries.set(id, entry);
    Array.from(this.entries.entries()).forEach(([k, v]) => {
      if (v.entryDate === entry.entryDate && k !== id) this.entries.delete(k);
    });
    return { entry, xp: xp.result };
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
