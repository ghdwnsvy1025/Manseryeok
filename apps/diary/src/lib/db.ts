// night_* 테이블 읽기·쓰기. 모두 로그인한 사용자의 Supabase 클라이언트로 부르며 RLS가 본인 행만 허용한다.
// 스키마: supabase/migrations/0001_night_core.sql
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryInput } from "./entry";
import type { DayGanji } from "./ganji";
import type { ComputedProfile, ProfileInput, PillarsSnapshot } from "./profile";

export interface EntryRow {
  id: string;
  entry_date: string;
  happiness: number;
  moods: string[];
  note: string | null;
  day_ganji_index: number;
  day_stem: string;
  day_branch: string;
}

export interface SajuProfileRow {
  id: string;
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  is_leap_month: boolean;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  birth_hour: number | null;
  birth_minute: number | null;
  city: string;
  pillars: PillarsSnapshot;
  engine_version: string;
}

const ENTRY_COLUMNS = "id, entry_date, happiness, moods, note, day_ganji_index, day_stem, day_branch";
const PROFILE_COLUMNS =
  "id, name, gender, calendar, is_leap_month, birth_year, birth_month, birth_day, birth_hour, birth_minute, city, pillars, engine_version";

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

export async function getSajuProfile(sb: SupabaseClient, userId: string): Promise<SajuProfileRow | null> {
  const { data, error } = await sb.from("night_saju_profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) fail("사주 프로필 읽기", error);
  return data as SajuProfileRow | null;
}

export async function saveSajuProfile(
  sb: SupabaseClient,
  userId: string,
  input: ProfileInput,
  computed: ComputedProfile,
): Promise<void> {
  const { error } = await sb.from("night_saju_profiles").upsert(
    {
      user_id: userId,
      name: input.name,
      gender: input.gender,
      calendar: input.calendar,
      is_leap_month: input.isLeapMonth,
      birth_year: input.birthYear,
      birth_month: input.birthMonth,
      birth_day: input.birthDay,
      birth_hour: input.birthHour,
      birth_minute: input.birthMinute,
      city: input.city,
      pillars: computed.pillars,
      engine_version: computed.engineVersion,
    },
    { onConflict: "user_id" },
  );
  if (error) fail("사주 프로필 저장", error);

  const { error: e2 } = await sb
    .from("night_profiles")
    .upsert({ user_id: userId, onboarded_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (e2) fail("사용자 저장", e2);
}

/** 로그인 직후 한 번. 이미 있으면 그대로 둔다. */
export async function ensureUserRow(sb: SupabaseClient, userId: string): Promise<void> {
  const { error } = await sb
    .from("night_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) fail("사용자 만들기", error);
}

export async function getEntry(sb: SupabaseClient, userId: string, date: string): Promise<EntryRow | null> {
  const { data, error } = await sb
    .from("night_entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();
  if (error) fail("기록 읽기", error);
  return data as EntryRow | null;
}

export async function listEntries(sb: SupabaseClient, userId: string, limit = 30): Promise<EntryRow[]> {
  const { data, error } = await sb
    .from("night_entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .limit(limit);
  if (error) fail("기록 목록 읽기", error);
  return (data ?? []) as EntryRow[];
}

export async function countEntries(sb: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await sb
    .from("night_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) fail("기록 수 세기", error);
  return count ?? 0;
}

/** 같은 날 기록이 있으면 고친다 (하루 하나). */
export async function saveEntry(sb: SupabaseClient, userId: string, input: EntryInput, ganji: DayGanji): Promise<void> {
  const { error } = await sb.from("night_entries").upsert(
    {
      user_id: userId,
      entry_date: input.entryDate,
      happiness: input.happiness,
      moods: input.moods,
      note: input.note,
      day_ganji_index: ganji.index,
      day_stem: ganji.stemKo,
      day_branch: ganji.branchKo,
    },
    { onConflict: "user_id,entry_date" },
  );
  if (error) fail("기록 저장", error);
}

/** 운세 보정용: 전체 기록을 가볍게 (날짜 역순 제한 없음, 간지 통계에도 쓴다) */
export async function listEntriesForStats(
  sb: SupabaseClient,
  userId: string,
): Promise<Pick<EntryRow, "entry_date" | "happiness" | "day_ganji_index" | "day_stem" | "day_branch">[]> {
  const { data, error } = await sb
    .from("night_entries")
    .select("entry_date, happiness, day_ganji_index, day_stem, day_branch")
    .eq("user_id", userId)
    .order("entry_date", { ascending: false })
    .limit(2000);
  if (error) fail("기록 통계 읽기", error);
  return data ?? [];
}

export async function getFortuneVote(sb: SupabaseClient, userId: string, date: string): Promise<1 | -1 | null> {
  const { data, error } = await sb
    .from("night_fortune_feedback")
    .select("vote")
    .eq("user_id", userId)
    .eq("fortune_date", date)
    .maybeSingle();
  if (error) fail("운세 피드백 읽기", error);
  return (data?.vote as 1 | -1 | undefined) ?? null;
}

export async function saveFortuneVote(sb: SupabaseClient, userId: string, date: string, vote: 1 | -1): Promise<void> {
  const { error } = await sb
    .from("night_fortune_feedback")
    .upsert({ user_id: userId, fortune_date: date, vote }, { onConflict: "user_id,fortune_date" });
  if (error) fail("운세 피드백 저장", error);
}

export interface NotificationSettingsRow {
  enabled: boolean;
  remind_at: string; // "21:00:00"
  web_push: unknown | null;
  kakao_opt_in: boolean;
}

export async function getNotificationSettings(sb: SupabaseClient, userId: string): Promise<NotificationSettingsRow | null> {
  const { data, error } = await sb
    .from("night_notification_settings")
    .select("enabled, remind_at, web_push, kakao_opt_in")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("알림 설정 읽기", error);
  return (data as NotificationSettingsRow | null) ?? null;
}

export async function saveNotificationSettings(
  sb: SupabaseClient,
  userId: string,
  patch: Partial<NotificationSettingsRow>,
): Promise<void> {
  const { error } = await sb
    .from("night_notification_settings")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) fail("알림 설정 저장", error);
}
