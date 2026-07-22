import type { JournalStorage, JournalSaveInput } from "./storage";
import type {
  CategoryScoreRecord,
  JournalEntry,
  JournalEntryTag,
  UserCategoryPreference,
} from "./types";
import { JOURNAL_SCHEMA_VERSION } from "./types";
import { isCategoryCode } from "./categoryCatalog";
import {
  createDefaultPreferences,
  loadCategoryPreferencesLocal,
  saveCategoryPreferencesLocal,
} from "./preferences";
import {
  validateScorePayload,
  validateTagCodes,
} from "./validation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Supabase journal storage.
 * 테이블이 아직 없으면 null을 반환해 IndexedDB로 폴백.
 */
export async function getSupabaseJournalStorage(): Promise<JournalStorage | null> {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  // Probe table existence
  const probe = await client.from("journal_entries").select("id").limit(1);
  if (probe.error) {
    return null;
  }

  return new SupabaseJournalStorage(user.id);
}

class SupabaseJournalStorage implements JournalStorage {
  constructor(private userId: string) {}

  private get client() {
    const c = getSupabaseBrowserClient();
    if (!c) throw new Error("Supabase가 설정되지 않았습니다.");
    return c;
  }

  async getByDate(entryDate: string): Promise<JournalEntry | null> {
    const { data: row, error } = await this.client
      .from("journal_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("entry_date", entryDate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return this.hydrate(row as Record<string, unknown>);
  }

  async list(): Promise<JournalEntry[]> {
    const { data, error } = await this.client
      .from("journal_entries")
      .select("*")
      .eq("user_id", this.userId)
      .order("entry_date", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const out: JournalEntry[] = [];
    for (const row of rows) {
      out.push(await this.hydrate(row as Record<string, unknown>));
    }
    return out;
  }

  private async hydrate(row: Record<string, unknown>): Promise<JournalEntry> {
    const entryId = String(row.id);
    const [{ data: scores }, { data: tags }] = await Promise.all([
      this.client
        .from("category_scores")
        .select("*")
        .eq("entry_id", entryId)
        .eq("user_id", this.userId),
      this.client
        .from("journal_entry_tags")
        .select("*")
        .eq("entry_id", entryId)
        .eq("user_id", this.userId),
    ]);

    const scoreRecords: CategoryScoreRecord[] = (scores ?? []).map((s) => ({
      id: String(s.id),
      entryId,
      userId: this.userId,
      categoryCode: s.category_code,
      rawScore: s.raw_score,
      isNotApplicable: Boolean(s.is_not_applicable),
      normalizedZ: s.normalized_z,
      normalizationVersion: s.normalization_version,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    const tagRecords: JournalEntryTag[] = (tags ?? []).map((t) => ({
      tagCode: String(t.tag_code),
      source: t.source ?? "user",
      confirmedByUser: t.confirmed_by_user !== false,
    }));

    return {
      id: entryId,
      userId: this.userId,
      entryDate: String(row.entry_date),
      userTimezone: String(row.user_timezone ?? "Asia/Seoul"),
      content: String(row.content ?? ""),
      overallSatisfaction: row.overall_satisfaction as JournalEntry["overallSatisfaction"],
      moodLabel: (row.mood_label as string | null) ?? null,
      mainEventText: (row.main_event_text as string | null) ?? null,
      source: (row.source as JournalEntry["source"]) ?? "new_diary",
      scores: scoreRecords,
      tags: tagRecords,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
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

    const upsertRow = {
      id,
      user_id: this.userId,
      entry_date: input.entryDate,
      user_timezone: input.userTimezone ?? "Asia/Seoul",
      content: input.content,
      overall_satisfaction: input.overallSatisfaction,
      mood_label: input.moodLabel,
      main_event_text: input.mainEventText,
      source: "new_diary",
      updated_at: now,
      created_at: existing?.createdAt ?? now,
    };

    const { error: upErr } = await this.client
      .from("journal_entries")
      .upsert(upsertRow, { onConflict: "user_id,entry_date" });
    if (upErr) throw new Error(upErr.message);

    // Replace scores for this entry (only provided rows with score or N/A)
    await this.client
      .from("category_scores")
      .delete()
      .eq("entry_id", id)
      .eq("user_id", this.userId);

    const scoreRows = input.scores
      .filter((s) => s.isNotApplicable || s.rawScore != null)
      .filter((s) => isCategoryCode(s.categoryCode))
      .map((s) => ({
        id: generateId(),
        entry_id: id,
        user_id: this.userId,
        category_code: s.categoryCode,
        raw_score: s.isNotApplicable ? null : s.rawScore,
        is_not_applicable: s.isNotApplicable,
        updated_at: now,
        created_at: now,
      }));

    if (scoreRows.length > 0) {
      const { error } = await this.client.from("category_scores").insert(scoreRows);
      if (error) throw new Error(error.message);
    }

    await this.client
      .from("journal_entry_tags")
      .delete()
      .eq("entry_id", id)
      .eq("user_id", this.userId);

    if (input.tagCodes.length > 0) {
      const tagRows = input.tagCodes.map((tag_code) => ({
        entry_id: id,
        tag_code,
        user_id: this.userId,
        source: "user",
        confirmed_by_user: true,
      }));
      const { error } = await this.client.from("journal_entry_tags").insert(tagRows);
      if (error) throw new Error(error.message);
    }

    const saved = await this.getByDate(input.entryDate);
    if (!saved) throw new Error("저장 후 일기를 불러오지 못했습니다.");
    return saved;
  }

  async getPreferences(): Promise<UserCategoryPreference[]> {
    const { data, error } = await this.client
      .from("user_category_preferences")
      .select("*")
      .eq("user_id", this.userId);
    if (error) {
      return loadCategoryPreferencesLocal(this.userId);
    }
    if (!data || data.length === 0) {
      return createDefaultPreferences(this.userId);
    }
    return data.map((p) => ({
      userId: this.userId,
      categoryCode: p.category_code,
      enabled: Boolean(p.enabled),
      sortOrder: p.sort_order ?? 0,
      enabledAt: p.enabled_at,
      disabledAt: p.disabled_at,
      updatedAt: p.updated_at,
    }));
  }

  async savePreferences(prefs: UserCategoryPreference[]): Promise<void> {
    const local = saveCategoryPreferencesLocal(prefs);
    if (!local.ok) throw new Error(local.error);

    const rows = prefs.map((p) => ({
      user_id: this.userId,
      category_code: p.categoryCode,
      enabled: p.enabled,
      sort_order: p.sortOrder,
      enabled_at: p.enabledAt,
      disabled_at: p.disabledAt,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await this.client
      .from("user_category_preferences")
      .upsert(rows, { onConflict: "user_id,category_code" });
    if (error) throw new Error(error.message);
  }
}
