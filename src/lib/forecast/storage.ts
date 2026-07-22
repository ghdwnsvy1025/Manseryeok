import type { DailyForecast, ForecastFeedback } from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const DB_NAME = "manseryeok-forecast";
const DB_VERSION = 1;
const FORECAST_STORE = "forecasts";
const FEEDBACK_STORE = "forecast_feedback";

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
      if (!db.objectStoreNames.contains(FORECAST_STORE)) {
        const store = db.createObjectStore(FORECAST_STORE, { keyPath: "id" });
        store.createIndex("targetDate", "targetDate", { unique: true });
      }
      if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
        const store = db.createObjectStore(FEEDBACK_STORE, { keyPath: "id" });
        store.createIndex("forecastId", "forecastId", { unique: true });
        store.createIndex("targetDate", "targetDate", { unique: false });
      }
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export type ForecastStorage = {
  saveForecast(forecast: DailyForecast): Promise<void>;
  getForecastByDate(targetDate: string): Promise<DailyForecast | null>;
  saveFeedback(feedback: ForecastFeedback): Promise<void>;
  getFeedbackByForecastId(forecastId: string): Promise<ForecastFeedback | null>;
  getFeedbackByDate(targetDate: string): Promise<ForecastFeedback | null>;
};

class IndexedDbForecastStorage implements ForecastStorage {
  async saveForecast(forecast: DailyForecast): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FORECAST_STORE, "readwrite");
      const store = tx.objectStore(FORECAST_STORE);
      const index = store.index("targetDate");
      const getReq = index.get(forecast.targetDate);
      getReq.onsuccess = () => {
        const existing = getReq.result as DailyForecast | undefined;
        const toSave: DailyForecast = {
          ...forecast,
          id: existing?.id ?? forecast.id,
          updatedAt: new Date().toISOString(),
        };
        store.put(toSave);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getForecastByDate(targetDate: string): Promise<DailyForecast | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FORECAST_STORE, "readonly");
      const store = tx.objectStore(FORECAST_STORE);
      const request = store.index("targetDate").get(targetDate);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as DailyForecast) ?? null);
      tx.oncomplete = () => db.close();
    });
  }

  async saveFeedback(feedback: ForecastFeedback): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FEEDBACK_STORE, "readwrite");
      const store = tx.objectStore(FEEDBACK_STORE);
      const index = store.index("forecastId");
      const getReq = index.get(feedback.forecastId);
      getReq.onsuccess = () => {
        const existing = getReq.result as ForecastFeedback | undefined;
        store.put({
          ...feedback,
          id: existing?.id ?? feedback.id,
          updatedAt: new Date().toISOString(),
        });
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getFeedbackByForecastId(forecastId: string): Promise<ForecastFeedback | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FEEDBACK_STORE, "readonly");
      const store = tx.objectStore(FEEDBACK_STORE);
      const request = store.index("forecastId").get(forecastId);
      request.onerror = () => reject(request.error);
      request.onsuccess = () =>
        resolve((request.result as ForecastFeedback) ?? null);
      tx.oncomplete = () => db.close();
    });
  }

  async getFeedbackByDate(targetDate: string): Promise<ForecastFeedback | null> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FEEDBACK_STORE, "readonly");
      const store = tx.objectStore(FEEDBACK_STORE);
      const request = store.index("targetDate").getAll(targetDate);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const list = (request.result as ForecastFeedback[]) ?? [];
        resolve(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null);
      };
      tx.oncomplete = () => db.close();
    });
  }
}

class SupabaseForecastStorage implements ForecastStorage {
  constructor(private userId: string) {}

  private get client() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase가 설정되지 않았습니다.");
    return supabase;
  }

  async saveForecast(forecast: DailyForecast): Promise<void> {
    const row = {
      id: forecast.id,
      user_id: this.userId,
      target_date: forecast.targetDate,
      source_entry_id: forecast.sourceEntryId,
      source_entry_date: forecast.sourceEntryDate,
      saju_profile_id: forecast.sajuProfileId,
      payload: forecast,
      maturity: forecast.maturity,
      generation_mode: forecast.generationMode,
      rule_version: forecast.ruleVersion,
      model_version: forecast.modelVersion,
      created_at: forecast.createdAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.client
      .from("daily_forecasts")
      .upsert(row, { onConflict: "user_id,target_date" });
    if (error) throw new Error(error.message);
  }

  async getForecastByDate(targetDate: string): Promise<DailyForecast | null> {
    const { data, error } = await this.client
      .from("daily_forecasts")
      .select("payload")
      .eq("user_id", this.userId)
      .eq("target_date", targetDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.payload) return null;
    return data.payload as DailyForecast;
  }

  async saveFeedback(feedback: ForecastFeedback): Promise<void> {
    const row = {
      id: feedback.id,
      user_id: this.userId,
      forecast_id: feedback.forecastId,
      target_date: feedback.targetDate,
      match_level: feedback.matchLevel,
      action_executed: feedback.actionExecuted,
      action_helpfulness: feedback.actionHelpfulness,
      inner_signal_feedback: feedback.innerSignalFeedback,
      memo: feedback.memo ?? null,
      created_at: feedback.createdAt,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.client
      .from("forecast_feedback")
      .upsert(row, { onConflict: "user_id,forecast_id" });
    if (error) throw new Error(error.message);
  }

  async getFeedbackByForecastId(forecastId: string): Promise<ForecastFeedback | null> {
    const { data, error } = await this.client
      .from("forecast_feedback")
      .select("*")
      .eq("user_id", this.userId)
      .eq("forecast_id", forecastId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      forecastId: data.forecast_id,
      targetDate: data.target_date,
      matchLevel: data.match_level,
      actionExecuted: data.action_executed,
      actionHelpfulness: data.action_helpfulness,
      innerSignalFeedback: data.inner_signal_feedback,
      memo: data.memo,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getFeedbackByDate(targetDate: string): Promise<ForecastFeedback | null> {
    const { data, error } = await this.client
      .from("forecast_feedback")
      .select("*")
      .eq("user_id", this.userId)
      .eq("target_date", targetDate)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      forecastId: data.forecast_id,
      targetDate: data.target_date,
      matchLevel: data.match_level,
      actionExecuted: data.action_executed,
      actionHelpfulness: data.action_helpfulness,
      innerSignalFeedback: data.inner_signal_feedback,
      memo: data.memo,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

export async function getForecastStorage(): Promise<ForecastStorage> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return new SupabaseForecastStorage(user.id);
  }
  return new IndexedDbForecastStorage();
}

export function createForecastId(): string {
  return generateId();
}

export function createFeedbackId(): string {
  return generateId();
}
