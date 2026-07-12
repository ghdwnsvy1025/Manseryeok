import type { DiaryStorage } from "./storage";
import type { DiaryEntry } from "./types";
import type { DiaryAnalysis } from "./dimensions";
import { normalizeDiaryEntry } from "./migrate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type DbRow = {
  id: string;
  user_id: string;
  date: string;
  content: string;
  day_pillar: DiaryEntry["dayPillar"];
  month_pillar_ko: string | null;
  year_pillar_ko: string | null;
  scores: DiaryAnalysis | null;
  ai_summary: string | null;
  created_at: string;
  updated_at: string;
};

function rowToEntry(row: DbRow): DiaryEntry {
  return normalizeDiaryEntry({
    id: row.id,
    date: row.date,
    content: row.content,
    dayPillar: row.day_pillar,
    monthPillarKo: row.month_pillar_ko ?? undefined,
    yearPillarKo: row.year_pillar_ko ?? undefined,
    analysis: row.scores,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function entryToRow(entry: DiaryEntry, userId: string): Omit<DbRow, "user_id"> & { user_id: string } {
  return {
    id: entry.id,
    user_id: userId,
    date: entry.date,
    content: entry.content,
    day_pillar: entry.dayPillar,
    month_pillar_ko: entry.monthPillarKo ?? null,
    year_pillar_ko: entry.yearPillarKo ?? null,
    scores: entry.analysis,
    ai_summary: entry.analysis?.summary ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

export class SupabaseDiaryStorage implements DiaryStorage {
  constructor(private userId: string) {}

  private get client() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("Supabase가 설정되지 않았습니다.");
    return supabase;
  }

  async save(entry: DiaryEntry): Promise<void> {
    const { error } = await this.client
      .from("diary_entries")
      .upsert(entryToRow(entry, this.userId), { onConflict: "user_id,date" });
    if (error) throw new Error(error.message);
  }

  async getByDate(date: string): Promise<DiaryEntry | null> {
    const { data, error } = await this.client
      .from("diary_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToEntry(data as DbRow) : null;
  }

  async getById(id: string): Promise<DiaryEntry | null> {
    const { data, error } = await this.client
      .from("diary_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToEntry(data as DbRow) : null;
  }

  async list(opts?: { limit?: number; offset?: number }): Promise<DiaryEntry[]> {
    let query = this.client
      .from("diary_entries")
      .select("*")
      .eq("user_id", this.userId)
      .order("updated_at", { ascending: false });

    if (opts?.limit) query = query.limit(opts.limit);
    if (opts?.offset) query = query.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data as DbRow[]).map(rowToEntry);
  }

  async listByDayPillar(ganjiKo: string): Promise<DiaryEntry[]> {
    const { data, error } = await this.client
      .from("diary_entries")
      .select("*")
      .eq("user_id", this.userId)
      .eq("day_pillar->>ganjiKo", ganjiKo)
      .order("date", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as DbRow[]).map(rowToEntry);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("diary_entries")
      .delete()
      .eq("user_id", this.userId)
      .eq("id", id);
    if (error) throw new Error(error.message);
  }
}

export async function getSupabaseDiaryStorage(): Promise<SupabaseDiaryStorage | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return new SupabaseDiaryStorage(user.id);
}

export { isSupabaseConfigured } from "@/lib/supabase/client";
