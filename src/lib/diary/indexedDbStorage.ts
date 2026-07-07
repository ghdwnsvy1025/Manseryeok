import type { DiaryStorage } from "./storage";
import type { DiaryEntry } from "./types";
import { normalizeDiaryEntry } from "./migrate";

const DB_NAME = "manseryeok-diary";
const DB_VERSION = 1;
const STORE_NAME = "entries";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("date", "date", { unique: true });
        store.createIndex("dayPillarKo", "dayPillar.ganjiKo", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as T);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
      })
  );
}

export class IndexedDbDiaryStorage implements DiaryStorage {
  async save(entry: DiaryEntry): Promise<void> {
    await runTransaction("readwrite", (store) => store.put(entry));
  }

  async getByDate(date: string): Promise<DiaryEntry | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("date");
      const request = index.get(date);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const raw = request.result as Record<string, unknown> | undefined;
        resolve(raw ? normalizeDiaryEntry(raw) : null);
      };
      tx.oncomplete = () => db.close();
    });
  }

  async getById(id: string): Promise<DiaryEntry | null> {
    const result = await runTransaction<DiaryEntry | undefined>("readonly", (store) =>
      store.get(id)
    );
    return result ? normalizeDiaryEntry(result as unknown as Record<string, unknown>) : null;
  }

  async list(opts?: { limit?: number; offset?: number }): Promise<DiaryEntry[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("updatedAt");
      const request = index.openCursor(null, "prev");
      const results: DiaryEntry[] = [];
      let skipped = opts?.offset ?? 0;

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        if (skipped > 0) {
          skipped--;
          cursor.continue();
          return;
        }
        results.push(normalizeDiaryEntry(cursor.value as Record<string, unknown>));
        if (opts?.limit && results.length >= opts.limit) {
          resolve(results);
          return;
        }
        cursor.continue();
      };
      tx.oncomplete = () => db.close();
    });
  }

  async listByDayPillar(ganjiKo: string): Promise<DiaryEntry[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("dayPillarKo");
      const request = index.getAll(ganjiKo);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = (request.result as Record<string, unknown>[]).map(normalizeDiaryEntry).sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        resolve(entries);
      };
      tx.oncomplete = () => db.close();
    });
  }

  async delete(id: string): Promise<void> {
    await runTransaction("readwrite", (store) => store.delete(id));
  }
}

let instance: IndexedDbDiaryStorage | null = null;

export function getIndexedDbStorage(): IndexedDbDiaryStorage {
  if (!instance) instance = new IndexedDbDiaryStorage();
  return instance;
}
