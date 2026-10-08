// night_* 테이블 읽기·쓰기. 모두 로그인한 사용자의 Supabase 클라이언트로 부르며 RLS가 본인 행만 허용한다.
// 스키마: supabase/migrations/0001_night_core.sql
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryInput, Promise_ } from "./entry";
import type { DayGanji } from "./ganji";
import { CITIES, type CityId } from "./cities";
import type { BirthProfile, ComputedProfile, ProfileInput, PillarsSnapshot } from "./profile";

export interface EntryRow {
  id: string;
  entry_date: string;
  happiness: number;
  moods: string[];
  note: string | null;
  day_ganji_index: number;
  day_stem: string;
  day_branch: string;
  /** 오늘의 작은 약속 (0003_promise.sql). 컬럼 적용 전이면 undefined */
  promise?: Promise_ | null;
  promise_text?: string | null;
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

/** 저장된 프로필 행 → 운세 계산 입력 (대운·세운용). 모르는 도시는 서울로 */
export function birthProfileOf(row: SajuProfileRow): BirthProfile {
  const city = (CITIES.find((c) => c.id === row.city)?.id ?? "seoul") as CityId;
  return {
    gender: row.gender,
    calendar: row.calendar,
    isLeapMonth: row.is_leap_month,
    birthYear: row.birth_year,
    birthMonth: row.birth_month,
    birthDay: row.birth_day,
    birthHour: row.birth_hour,
    birthMinute: row.birth_minute,
    city,
  };
}

const ENTRY_COLUMNS_LEGACY = "id, entry_date, happiness, moods, note, day_ganji_index, day_stem, day_branch";
/** 0003_promise.sql 적용 뒤의 전체 컬럼. 적용 전이면 읽기·쓰기가 컬럼 없음으로 실패하므로 LEGACY로 한 번 더 시도한다 */
const ENTRY_COLUMNS = `${ENTRY_COLUMNS_LEGACY}, promise, promise_text`;
const PROFILE_COLUMNS =
  "id, name, gender, calendar, is_leap_month, birth_year, birth_month, birth_day, birth_hour, birth_minute, city, pillars, engine_version";

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

/**
 * 마이그레이션이 아직 안 적용돼 컬럼이 없을 때의 오류. Postgres 42703 · PostgREST PGRST204(스키마 캐시에 컬럼 없음).
 * 그동안은 약속 없이 저장·읽기로 물러난다 — 사용자에게 500을 보이지 않는다.
 */
export function isMissingColumnError(error: { code?: string; message: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(error.message);
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

/**
 * 이름만 바꾼다 (설정 "이름", B4). night_saju_profiles.name(운세·공유 문구가 읽는 쪽)과
 * night_profiles.display_name을 같이 맞춘다. 사주 프로필이 아직 없으면 night_profiles만 바뀐다 (0 rows는 오류가 아니다).
 */
export async function saveName(sb: SupabaseClient, userId: string, name: string): Promise<void> {
  const { error } = await sb.from("night_saju_profiles").update({ name }).eq("user_id", userId);
  if (error) fail("이름 저장", error);
  const { error: e2 } = await sb.from("night_profiles").upsert({ user_id: userId, display_name: name }, { onConflict: "user_id" });
  if (e2) fail("사용자 이름 저장", e2);
}

/** 사용자 클라이언트(RLS: 본인 행만)로 지우는 night_* 테이블. 순서는 자식 → 부모 (B9) */
export const USER_DELETABLE_TABLES = [
  "night_entries",
  "night_fortune_feedback",
  "night_notification_settings",
  "night_saju_profiles",
  "night_profiles",
] as const;

/**
 * 본인 기록 전부 지우기 (설정 "기록 모두 지우기", B9). 사용자 클라이언트로 부르므로 RLS가 본인 행만 허용한다.
 * night_fortunes는 사용자에게 지우기 권한이 없어 deleteFortunesAsAdmin이 따로 맡는다.
 */
export async function deleteAllUserRows(sb: SupabaseClient, userId: string): Promise<void> {
  for (const table of USER_DELETABLE_TABLES) {
    const { error } = await sb.from(table).delete().eq("user_id", userId);
    if (error) fail(`${table} 지우기`, error);
  }
}

/** 운세 캐시 지우기 — RLS가 읽기만 허용하므로 service role 클라이언트로, user_id 조건을 반드시 건다 */
export async function deleteFortunesAsAdmin(admin: SupabaseClient, userId: string): Promise<void> {
  if (!userId) throw new Error("운세 캐시 지우기: user_id가 없다");
  const { error } = await admin.from("night_fortunes").delete().eq("user_id", userId);
  if (error) fail("운세 캐시 지우기", error);
}

/** 로그인(익명 포함) 직후 한 번. 이미 있으면 그대로 둔다. 익명 사용자는 이름 "손님" */
export async function ensureUserRow(sb: SupabaseClient, userId: string, displayName: string | null = null): Promise<void> {
  const { error } = await sb
    .from("night_profiles")
    .upsert({ user_id: userId, ...(displayName ? { display_name: displayName } : {}) }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) fail("사용자 만들기", error);
}

export interface LinkPromptState {
  promptedAt: string | null;
  promptCount: number;
}

/**
 * Google 연결 안내를 몇 번 보여 줬는지. 컬럼은 0002_anon.sql — 아직 적용 전이면(42703) 0으로 본다.
 */
export async function getLinkPromptState(sb: SupabaseClient, userId: string): Promise<LinkPromptState> {
  const { data, error } = await sb
    .from("night_profiles")
    .select("link_prompted_at, link_prompt_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (error.code === "42703" || /column|does not exist/i.test(error.message)) return { promptedAt: null, promptCount: 0 };
    fail("연결 안내 상태 읽기", error);
  }
  const row = data as { link_prompted_at?: string | null; link_prompt_count?: number | null } | null;
  return { promptedAt: row?.link_prompted_at ?? null, promptCount: Number(row?.link_prompt_count ?? 0) };
}

/** 안내를 보여 줬다고 기록한다. 컬럼이 없으면 조용히 넘어간다 */
export async function markLinkPrompted(sb: SupabaseClient, userId: string, nextCount: number): Promise<void> {
  const { error } = await sb
    .from("night_profiles")
    .upsert(
      { user_id: userId, link_prompted_at: new Date().toISOString(), link_prompt_count: nextCount },
      { onConflict: "user_id" },
    );
  if (error && !(error.code === "42703" || /column|does not exist/i.test(error.message))) fail("연결 안내 기록", error);
}

export async function getEntry(sb: SupabaseClient, userId: string, date: string): Promise<EntryRow | null> {
  const q = (cols: string) => sb.from("night_entries").select(cols).eq("user_id", userId).eq("entry_date", date).maybeSingle();
  let { data, error } = await q(ENTRY_COLUMNS);
  if (error && isMissingColumnError(error)) ({ data, error } = await q(ENTRY_COLUMNS_LEGACY));
  if (error) fail("기록 읽기", error);
  return data as unknown as EntryRow | null;
}

export async function listEntries(sb: SupabaseClient, userId: string, limit = 30): Promise<EntryRow[]> {
  const q = (cols: string) =>
    sb.from("night_entries").select(cols).eq("user_id", userId).order("entry_date", { ascending: false }).limit(limit);
  let { data, error } = await q(ENTRY_COLUMNS);
  if (error && isMissingColumnError(error)) ({ data, error } = await q(ENTRY_COLUMNS_LEGACY));
  if (error) fail("기록 목록 읽기", error);
  return (data ?? []) as unknown as EntryRow[];
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
  const base = {
    user_id: userId,
    entry_date: input.entryDate,
    happiness: input.happiness,
    moods: input.moods,
    note: input.note,
    day_ganji_index: ganji.index,
    day_stem: ganji.stemKo,
    day_branch: ganji.branchKo,
  };
  const upsert = (row: Record<string, unknown>) => sb.from("night_entries").upsert(row, { onConflict: "user_id,entry_date" });
  const { error } = await upsert({ ...base, promise: input.promise, promise_text: input.promiseText });
  if (!error) return;
  // 0003_promise.sql 적용 전: 약속 컬럼을 빼고 다시 저장 (약속만 버려지고 기록은 남는다)
  if (isMissingColumnError(error)) {
    const { error: e2 } = await upsert(base);
    if (e2) fail("기록 저장", e2);
    return;
  }
  fail("기록 저장", error);
}

/** 그 날짜의 내 기록 하나 지우기 (쓰기 화면 "지우기"). RLS가 본인 행만 허용한다. 없는 날짜는 0 rows — 오류가 아니다 */
export async function deleteEntry(sb: SupabaseClient, userId: string, date: string): Promise<void> {
  const { error } = await sb.from("night_entries").delete().eq("user_id", userId).eq("entry_date", date);
  if (error) fail("기록 지우기", error);
}

/** 운세 보정용: 전체 기록을 가볍게 (날짜 역순 제한 없음, 간지 통계에도 쓴다) */
export async function listEntriesForStats(
  sb: SupabaseClient,
  userId: string,
): Promise<Pick<EntryRow, "entry_date" | "happiness" | "day_ganji_index" | "day_stem" | "day_branch" | "promise">[]> {
  const legacy = "entry_date, happiness, day_ganji_index, day_stem, day_branch";
  const q = (cols: string) =>
    sb.from("night_entries").select(cols).eq("user_id", userId).order("entry_date", { ascending: false }).limit(2000);
  let { data, error } = await q(`${legacy}, promise`);
  if (error && isMissingColumnError(error)) ({ data, error } = await q(legacy));
  if (error) fail("기록 통계 읽기", error);
  return (data ?? []) as unknown as Pick<EntryRow, "entry_date" | "happiness" | "day_ganji_index" | "day_stem" | "day_branch" | "promise">[];
}

export interface CachedFortuneDo {
  /** 운세 "하면 좋아요" 한 줄 = 그날의 약속 */
  doText: string;
}

/**
 * 그날 운세 캐시의 do 문장만 읽는다 (쓰기 화면의 "오늘의 작은 약속").
 * night_fortunes에서 owner+date로 select만 한다 — 캐시가 없어도 새로 계산하거나 모델을 부르지 않는다.
 * RLS night_fortunes_read_own으로 본인 행만 보이므로 사용자 클라이언트로 부른다.
 * 읽기 실패(테이블 없음 등)도 null — 약속 블록을 생략할 뿐 쓰기 화면을 막지 않는다.
 */
export async function readCachedFortune(sb: SupabaseClient, userId: string, date: string): Promise<CachedFortuneDo | null> {
  const { data, error } = await sb
    .from("night_fortunes")
    .select("content")
    .eq("user_id", userId)
    .eq("fortune_date", date)
    .maybeSingle();
  if (error || !data) return null;
  const content = (data as { content?: unknown }).content;
  const doText = content && typeof content === "object" ? (content as { do?: unknown }).do : null;
  return typeof doText === "string" && doText.trim() ? { doText: doText.trim() } : null;
}

/**
 * 오늘 화면이 첫 Promise.all에서 읽어 두는 운세 캐시 행 (RLS: 본인 것만 읽기). 지문 비교는 lib/fortune의 cachedFortuneContent가 한다.
 * null = 행이 없음(확정), undefined = 읽기 실패(운세 쪽이 service role로 다시 조회한다)
 */
export async function readFortuneCacheRow(
  sb: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ id: string; profile_fingerprint: string; content: unknown } | null | undefined> {
  const { data, error } = await sb
    .from("night_fortunes")
    .select("id, profile_fingerprint, content")
    .eq("user_id", userId)
    .eq("fortune_date", date)
    .maybeSingle();
  if (error) {
    console.error("운세 캐시 읽기", error);
    return undefined;
  }
  return (data as { id: string; profile_fingerprint: string; content: unknown } | null) ?? null;
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

/** 투표 취소: 눌린 쪽을 다시 누르면 그 날짜 행을 지운다. 없는 날짜는 0 rows — 오류가 아니다 */
export async function deleteFortuneVote(sb: SupabaseClient, userId: string, date: string): Promise<void> {
  const { error } = await sb.from("night_fortune_feedback").delete().eq("user_id", userId).eq("fortune_date", date);
  if (error) fail("운세 피드백 지우기", error);
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
