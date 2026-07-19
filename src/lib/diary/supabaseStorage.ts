import type { DiaryStorage } from "./storage";
import type { DiaryEntry, DiaryMonthRange } from "./types";
import type { DiaryAnalysis } from "./dimensions";
import { normalizeDiaryEntry } from "./migrate";
import { DIARY_SCHEMA_VERSION } from "./types";
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
  happiness_rating: number | null;
  happiness_source: string | null;
  condition_rating: number | null;
  emotions: string[] | null;
  tags: string[] | null;
  heavenly_stem: string | null;
  earthly_branch: string | null;
  weekday: number | null;
  is_weekend: boolean | null;
  sleep_score: number | null;
  sleep_satisfaction: string | null;
  exercise_status: string | null;
  activity_level: string | null;
  social_activity: string | null;
  social_met: string | null;
  work_intensity: string | null;
  weather_metadata: Record<string, unknown> | null;
  input_mode: string | null;
  emotion_source: string | null;
  data_origin: string | null;
  saju_depth: string | null;
  user_birth_pillars: DiaryEntry["userBirthPillars"] | null;
  saju_profile_id: string | null;
  schema_version: number | null;
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
    happinessRating: row.happiness_rating ?? undefined,
    happinessSource: row.happiness_source ?? undefined,
    conditionRating: row.condition_rating ?? null,
    emotions: row.emotions ?? [],
    tags: row.tags ?? [],
    heavenlyStem: row.heavenly_stem ?? undefined,
    earthlyBranch: row.earthly_branch ?? undefined,
    weekday: row.weekday ?? undefined,
    isWeekend: row.is_weekend ?? undefined,
    sleepScore: row.sleep_score,
    sleepSatisfaction: row.sleep_satisfaction ?? null,
    exerciseStatus: row.exercise_status,
    activityLevel: row.activity_level ?? null,
    socialActivity: row.social_activity,
    socialMet: row.social_met ?? null,
    workIntensity: row.work_intensity ?? null,
    weatherMetadata: row.weather_metadata,
    inputMode: row.input_mode ?? undefined,
    emotionSource: row.emotion_source ?? undefined,
    dataOrigin: row.data_origin ?? undefined,
    sajuDepth: row.saju_depth ?? undefined,
    userBirthPillars: row.user_birth_pillars ?? undefined,
    sajuProfileId: row.saju_profile_id,
    schemaVersion: row.schema_version ?? DIARY_SCHEMA_VERSION,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function entryToRow(
  entry: DiaryEntry,
  userId: string
): Omit<DbRow, "user_id"> & { user_id: string } {
  const normalized = normalizeDiaryEntry(entry as unknown as Record<string, unknown>);
  return {
    id: normalized.id,
    user_id: userId,
    date: normalized.date,
    content: normalized.content,
    day_pillar: normalized.dayPillar,
    month_pillar_ko: normalized.monthPillarKo ?? null,
    year_pillar_ko: normalized.yearPillarKo ?? null,
    scores: normalized.analysis,
    ai_summary: normalized.analysis?.summary ?? null,
    happiness_rating: normalized.happinessRating ?? null,
    happiness_source: normalized.happinessSource ?? null,
    condition_rating: normalized.conditionRating ?? null,
    emotions: normalized.emotions ?? [],
    tags: normalized.tags ?? [],
    heavenly_stem: normalized.heavenlyStem ?? null,
    earthly_branch: normalized.earthlyBranch ?? null,
    weekday: normalized.weekday ?? null,
    is_weekend: normalized.isWeekend ?? null,
    sleep_score: normalized.sleepScore ?? null,
    sleep_satisfaction: normalized.sleepSatisfaction ?? null,
    exercise_status: normalized.exerciseStatus ?? null,
    activity_level: normalized.activityLevel ?? null,
    social_activity: normalized.socialActivity ?? null,
    social_met: normalized.socialMet ?? null,
    work_intensity: normalized.workIntensity ?? null,
    weather_metadata: normalized.weatherMetadata ?? null,
    input_mode: normalized.inputMode ?? null,
    emotion_source: normalized.emotionSource ?? null,
    data_origin: normalized.dataOrigin ?? "user",
    saju_depth: normalized.sajuDepth ?? null,
    user_birth_pillars: normalized.userBirthPillars ?? null,
    saju_profile_id: normalized.sajuProfileId ?? null,
    schema_version: normalized.schemaVersion ?? DIARY_SCHEMA_VERSION,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

function monthBounds({ year, month }: DiaryMonthRange): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
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

  async upsertMany(entries: DiaryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((entry) => entryToRow(entry, this.userId));
    const { error } = await this.client
      .from("diary_entries")
      .upsert(rows, { onConflict: "user_id,date" });
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

  async listByMonth(range: DiaryMonthRange): Promise<DiaryEntry[]> {
    const { start, end } = monthBounds(range);
    const { data, error } = await this.client
      .from("diary_entries")
      .select("*")
      .eq("user_id", this.userId)
      .gte("date", start)
      .lte("date", end)
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return new SupabaseDiaryStorage(user.id);
}

export { isSupabaseConfigured } from "@/lib/supabase/client";
