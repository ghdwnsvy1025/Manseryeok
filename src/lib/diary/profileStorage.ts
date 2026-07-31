import type { SajuInput, SajuResult } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import {
  DIARY_SCHEMA_VERSION,
  type SajuProfile,
  type SajuProfilePillars,
  type UserBirthPillarDetail,
  type UserProfile,
} from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 저장된 프로필 → 재계산용 입력.
 * birthDate는 항상 양력(normalized solar)이므로 calendarType은 solar로 고정한다.
 */
export function sajuInputFromProfile(profile: SajuProfile): SajuInput {
  const [year, month, day] = profile.birthDate.split("-").map(Number);
  const hasTime =
    !profile.birthTimeUnknown &&
    profile.birthHour !== undefined &&
    profile.birthMinute !== undefined;

  return {
    year,
    month,
    day,
    hour: hasTime ? profile.birthHour : undefined,
    minute: hasTime ? profile.birthMinute : undefined,
    gender: profile.gender,
    options: {
      calendarType: "solar",
      isLeapMonth: false,
      timezone: profile.timezone || "Asia/Seoul",
      dayChangeRule: profile.dayChangeRule,
      timeCorrection: profile.timeCorrection,
      location:
        profile.locationName || profile.longitude !== undefined
          ? {
              name: profile.locationName,
              longitude: profile.longitude,
              latitude: profile.latitude,
            }
          : {
              name: "대한민국, 서울",
              longitude: 126.98,
              latitude: 37.57,
            },
    },
  };
}

/** 활성(적용 중) 프로필 캐시 — 하위 호환 */
const LOCAL_SAJU_PROFILE_KEY = "manseryeok_saju_profile_v2";
/** 전체 프로필 목록 */
const LOCAL_SAJU_PROFILES_KEY = "manseryeok_saju_profiles_v2";
const LOCAL_USER_PROFILE_KEY = "manseryeok_user_profile_v2";
/** 만세력 보기용 프로필 id — 원격 컬럼 없어도 유지 */
const LOCAL_VIEW_PROFILE_KEY = "manseryeok_active_view_profile_id_v1";
/** 마지막으로 reconcile한 auth user id — 계정 전환 감지 */
const LAST_AUTH_USER_KEY = "manseryeok_last_auth_user_id_v1";
const CALCULATOR_VERSION = "0.1.0";
export const SAJU_PROFILE_CHANGED_EVENT = "manseryeok:saju-profile-changed";
/** 프로필 관리 화면을 목록으로 되돌림 (같은 라우트에서 메뉴 클릭 시) */
export const PROFILES_LIST_EVENT = "manseryeok:profiles-list";

export function notifySajuProfileChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAJU_PROFILE_CHANGED_EVENT));
}

/** 게스트(비로그인) 로컬 프로필을 현재 계정으로 옮겨도 되는지 */
export function localProfilesSafeToMigrate(
  profiles: Array<{ userId?: string | null }>,
  userId: string
): boolean {
  if (profiles.length === 0) return true;
  return profiles.every((p) => !p.userId || p.userId === userId);
}

/**
 * 사주/유저 프로필 로컬 캐시 삭제.
 * 계정 전환·로그아웃 시 이전 계정 데이터가 화면에 잠깐이라도 보이지 않게 한다.
 */
export function clearLocalAccountScopedState(opts?: {
  notify?: boolean;
}): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LOCAL_SAJU_PROFILE_KEY);
    localStorage.removeItem(LOCAL_SAJU_PROFILES_KEY);
    localStorage.removeItem(LOCAL_USER_PROFILE_KEY);
    localStorage.removeItem(LOCAL_VIEW_PROFILE_KEY);
  } catch {
    /* ignore */
  }
  try {
    // experienceMode 모듈과 순환 import 피하려고 키를 직접 지움
    localStorage.removeItem("manseryeok_experience_mode");
    localStorage.removeItem("manseryeok_onboarding_completed_at");
    localStorage.removeItem("manseryeok_first_visit_welcome_v1");
  } catch {
    /* ignore */
  }
  if (opts?.notify !== false) {
    notifySajuProfileChanged();
  }
}

/**
 * auth user가 바뀌면 로컬 계정 스코프 상태를 정리한다.
 * - 로그아웃(→ null): 기기 로컬 프로필·일기 유지 (비로그인 재진입)
 * - 게스트 → 첫 로그인: 로컬 유지 후 이관
 * - 다른 계정으로 전환: 이관 불가면 이전 캐시 삭제
 */
export function reconcileLocalStateWithAuthUser(userId: string | null): void {
  if (typeof window === "undefined") return;
  let prev: string | null = null;
  try {
    prev = localStorage.getItem(LAST_AUTH_USER_KEY);
  } catch {
    prev = null;
  }
  if (userId === prev) return;

  // 로그아웃: 로컬 데이터는 지우지 않음
  if (!userId) {
    try {
      localStorage.removeItem(LAST_AUTH_USER_KEY);
    } catch {
      /* ignore */
    }
    return;
  }

  // 다른 로그인 사용자로 바뀔 때, 로컬이 그 계정 것이 아니면 비움
  if (prev && prev !== userId) {
    if (!localProfilesSafeToMigrate(loadLocalSajuProfiles(), userId)) {
      clearLocalAccountScopedState({ notify: true });
    }
  }

  try {
    localStorage.setItem(LAST_AUTH_USER_KEY, userId);
  } catch {
    /* ignore */
  }
}

export function getLocalViewProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LOCAL_VIEW_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function setLocalViewProfileId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(LOCAL_VIEW_PROFILE_KEY, id);
    else localStorage.removeItem(LOCAL_VIEW_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pillarDetail(pillar: {
  stem: { hanja: string; ko: string };
  branch: { hanja: string; ko: string };
  ganjiKo: string;
}): UserBirthPillarDetail {
  return {
    stemHanja: pillar.stem.hanja,
    branchHanja: pillar.branch.hanja,
    stemKo: pillar.stem.ko,
    branchKo: pillar.branch.ko,
    ganjiKo: pillar.ganjiKo,
  };
}

export function pillarsFromSajuResult(result: SajuResult): SajuProfilePillars {
  return {
    year: pillarDetail(result.pillars.year),
    month: pillarDetail(result.pillars.month),
    day: pillarDetail(result.pillars.day),
    hour: result.pillars.hour ? pillarDetail(result.pillars.hour) : null,
  };
}

export function profileDisplayName(profile: SajuProfile): string {
  const name = profile.label?.trim();
  return name || "이름 없음";
}

export function buildSajuProfileFromResult(
  result: SajuResult,
  opts?: { id?: string; userId?: string | null; label?: string; isPrimary?: boolean }
): SajuProfile {
  const now = new Date().toISOString();
  const original = result.input.original;
  const options = result.options;
  const birthTimeUnknown =
    original.hour === undefined || original.minute === undefined;

  return {
    id: opts?.id ?? generateId(),
    userId: opts?.userId ?? null,
    label: opts?.label?.trim() || "이름 없음",
    isPrimary: opts?.isPrimary ?? true,
    birthDate: result.input.normalizedSolarDate,
    birthHour: original.hour,
    birthMinute: original.minute,
    birthTimeUnknown,
    calendarType: options.calendarType,
    isLeapMonth: options.isLeapMonth ?? false,
    gender: original.gender,
    timezone: options.timezone || "Asia/Seoul",
    locationName: options.location?.name,
    longitude: options.location?.longitude,
    latitude: options.location?.latitude,
    dayChangeRule: options.dayChangeRule,
    timeCorrection: options.timeCorrection,
    pillars: pillarsFromSajuResult(result),
    calculationVersion: CALCULATOR_VERSION,
    inputHash: undefined,
    solarTermBoundary: {
      lichun: result.debug.usedLichun,
      monthStart: result.debug.usedMonthSolarTermStart,
      monthEnd: result.debug.usedMonthSolarTermEnd,
      monthName: result.debug.usedMonthSolarTermName,
    },
    calculationMetadata: {
      normalizedSolarDateTime: result.input.normalizedSolarDateTime,
      jdnForDayPillar: result.debug.jdnForDayPillar,
      warnings: result.debug.warnings,
      timeCorrectionMinutes: result.debug.timeCorrectionMinutes,
    },
    reconstructed: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: DIARY_SCHEMA_VERSION,
  };
}

export function loadLocalSajuProfile(): SajuProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SAJU_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SajuProfile;
  } catch {
    return null;
  }
}

export function saveLocalSajuProfile(profile: SajuProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_SAJU_PROFILE_KEY, JSON.stringify(profile));
}

/** 로컬에 저장된 전체 프로필 (단일 키 → 목록으로 마이그레이션 포함) */
export function loadLocalSajuProfiles(): SajuProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const rawList = localStorage.getItem(LOCAL_SAJU_PROFILES_KEY);
    if (rawList) {
      const parsed = JSON.parse(rawList) as SajuProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* fall through */
  }

  const single = loadLocalSajuProfile();
  if (!single) return [];
  const migrated = [{ ...single, isPrimary: true }];
  saveLocalSajuProfiles(migrated);
  return migrated;
}

export function saveLocalSajuProfiles(profiles: SajuProfile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_SAJU_PROFILES_KEY, JSON.stringify(profiles));
  const primary =
    profiles.find((p) => p.isPrimary) ?? (profiles.length > 0 ? profiles[0] : null);
  if (primary) {
    saveLocalSajuProfile(primary);
  } else {
    localStorage.removeItem(LOCAL_SAJU_PROFILE_KEY);
  }
}

function upsertLocalProfileList(profile: SajuProfile): SajuProfile[] {
  let list = loadLocalSajuProfiles();
  if (profile.isPrimary) {
    list = list.map((p) => ({ ...p, isPrimary: p.id === profile.id }));
  }
  const idx = list.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    list[idx] = { ...profile };
  } else {
    list.push(profile);
  }
  if (list.length > 0 && !list.some((p) => p.isPrimary)) {
    list[0] = { ...list[0], isPrimary: true };
  }
  saveLocalSajuProfiles(list);
  const primary = list.find((p) => p.isPrimary) ?? list[0];
  if (primary) ensureLocalUserProfile(primary.id);
  return list;
}

export function loadLocalUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveLocalUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_USER_PROFILE_KEY, JSON.stringify(profile));
}

export function ensureLocalUserProfile(
  activeSajuProfileId?: string | null,
  opts?: {
    journalId?: string | null;
    viewId?: string | null;
  }
): UserProfile {
  const existing = loadLocalUserProfile();
  const now = new Date().toISOString();
  const journalId =
    opts?.journalId ??
    activeSajuProfileId ??
    existing?.activeJournalProfileId ??
    existing?.activeSajuProfileId ??
    null;
  const viewId =
    opts?.viewId ??
    existing?.activeViewProfileId ??
    journalId;

  if (existing) {
    const next: UserProfile = {
      ...existing,
      activeSajuProfileId: journalId,
      activeJournalProfileId: journalId,
      activeViewProfileId: viewId,
      updatedAt: now,
      schemaVersion: DIARY_SCHEMA_VERSION,
    };
    saveLocalUserProfile(next);
    return next;
  }
  const created: UserProfile = {
    id: "local-anonymous",
    locale: "ko-KR",
    timezone: "Asia/Seoul",
    activeSajuProfileId: journalId,
    activeJournalProfileId: journalId,
    activeViewProfileId: viewId,
    experienceMode: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: DIARY_SCHEMA_VERSION,
  };
  saveLocalUserProfile(created);
  return created;
}

type SajuProfileRow = {
  id: string;
  user_id: string;
  label: string | null;
  is_primary: boolean;
  birth_date: string;
  birth_hour: number | null;
  birth_minute: number | null;
  birth_time_unknown: boolean;
  calendar_type: SajuProfile["calendarType"];
  is_leap_month: boolean | null;
  gender: Gender | null;
  timezone: string;
  location_name: string | null;
  longitude: number | null;
  latitude: number | null;
  day_change_rule: SajuProfile["dayChangeRule"];
  time_correction: SajuProfile["timeCorrection"];
  pillars: SajuProfilePillars;
  calculation_version: string;
  input_hash: string | null;
  solar_term_boundary: SajuProfile["solarTermBoundary"] | null;
  calculation_metadata: Record<string, unknown> | null;
  reconstructed: boolean;
  schema_version: number;
  created_at: string;
  updated_at: string;
};

function rowToProfile(row: SajuProfileRow): SajuProfile {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label ?? undefined,
    isPrimary: row.is_primary,
    birthDate: row.birth_date,
    birthHour: row.birth_hour ?? undefined,
    birthMinute: row.birth_minute ?? undefined,
    birthTimeUnknown: row.birth_time_unknown,
    calendarType: row.calendar_type,
    isLeapMonth: row.is_leap_month ?? false,
    gender: row.gender ?? undefined,
    timezone: row.timezone,
    locationName: row.location_name ?? undefined,
    longitude: row.longitude ?? undefined,
    latitude: row.latitude ?? undefined,
    dayChangeRule: row.day_change_rule,
    timeCorrection: row.time_correction,
    pillars: row.pillars,
    calculationVersion: row.calculation_version,
    inputHash: row.input_hash ?? undefined,
    solarTermBoundary: row.solar_term_boundary ?? undefined,
    calculationMetadata: row.calculation_metadata ?? undefined,
    reconstructed: row.reconstructed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: row.schema_version,
  };
}

function profileToRow(profile: SajuProfile, userId: string) {
  return {
    id: profile.id,
    user_id: userId,
    label: profile.label ?? null,
    is_primary: profile.isPrimary,
    birth_date: profile.birthDate,
    birth_hour: profile.birthHour ?? null,
    birth_minute: profile.birthMinute ?? null,
    birth_time_unknown: profile.birthTimeUnknown,
    calendar_type: profile.calendarType,
    is_leap_month: profile.isLeapMonth ?? false,
    gender: profile.gender ?? null,
    timezone: profile.timezone,
    location_name: profile.locationName ?? null,
    longitude: profile.longitude ?? null,
    latitude: profile.latitude ?? null,
    day_change_rule: profile.dayChangeRule,
    time_correction: profile.timeCorrection,
    pillars: profile.pillars,
    calculation_version: profile.calculationVersion,
    input_hash: profile.inputHash ?? null,
    solar_term_boundary: profile.solarTermBoundary ?? null,
    calculation_metadata: profile.calculationMetadata ?? null,
    reconstructed: profile.reconstructed ?? false,
    schema_version: profile.schemaVersion,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

export async function saveSajuProfile(profile: SajuProfile): Promise<SajuProfile> {
  const withMeta: SajuProfile = {
    ...profile,
    label: profile.label?.trim() || "이름 없음",
    updatedAt: new Date().toISOString(),
  };

  upsertLocalProfileList(withMeta);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return withMeta;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return withMeta;

  const remote: SajuProfile = {
    ...withMeta,
    userId: user.id,
  };

  if (remote.isPrimary) {
    const { error: demoteError } = await supabase
      .from("saju_profiles")
      .update({ is_primary: false, updated_at: remote.updatedAt })
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .neq("id", remote.id);
    if (demoteError) throw new Error(demoteError.message);
  }

  const { error } = await supabase
    .from("saju_profiles")
    .upsert(profileToRow(remote, user.id), { onConflict: "id" });
  if (error) throw new Error(error.message);

  if (remote.isPrimary) {
    const local = loadLocalUserProfile();
    const viewId = local?.activeViewProfileId ?? remote.id;
    await supabase.from("user_profiles").upsert({
      id: user.id,
      locale: "ko-KR",
      timezone: remote.timezone,
      active_saju_profile_id: remote.id,
      active_journal_profile_id: remote.id,
      active_view_profile_id: viewId,
      experience_mode: local?.experienceMode ?? null,
      onboarding_completed_at: local?.onboardingCompletedAt ?? null,
      schema_version: DIARY_SCHEMA_VERSION,
      updated_at: remote.updatedAt,
    });
    ensureLocalUserProfile(remote.id, {
      journalId: remote.id,
      viewId,
    });
  }

  upsertLocalProfileList(remote);
  return remote;
}

/**
 * 비로그인 상태에서 만든 로컬 사주 프로필을 첫 로그인 후 계정에 연결합니다.
 * 이미 계정에 primary 프로필이 있으면 원격 프로필을 우선하며 덮어쓰지 않습니다.
 * 다른 계정의 로컬 캐시는 절대 업로드하지 않습니다.
 */
export async function syncLocalSajuProfileToAccount(): Promise<SajuProfile | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return loadLocalSajuProfiles().find((p) => p.isPrimary) ?? loadLocalSajuProfiles()[0] ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return loadLocalSajuProfiles().find((p) => p.isPrimary) ?? loadLocalSajuProfiles()[0] ?? null;
  }

  reconcileLocalStateWithAuthUser(user.id);

  const { data: existing, error } = await supabase
    .from("saju_profiles")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();

  if (!error && existing) {
    const remote = rowToProfile(existing as SajuProfileRow);
    const { data: allRemote } = await supabase
      .from("saju_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (allRemote?.length) {
      saveLocalSajuProfiles(allRemote.map((row) => rowToProfile(row as SajuProfileRow)));
    } else {
      upsertLocalProfileList(remote);
    }
    ensureLocalUserProfile(remote.id);
    return remote;
  }

  const localProfiles = loadLocalSajuProfiles();
  if (!localProfilesSafeToMigrate(localProfiles, user.id)) {
    clearLocalAccountScopedState({ notify: true });
    return null;
  }

  const local =
    localProfiles.find((p) => p.isPrimary) ?? localProfiles[0] ?? null;
  if (!local) return null;

  // 익명 로컬 → 계정: 새 id로 올려 이전 계정 row와 PK 충돌을 피한다
  const adoptId =
    local.userId === user.id ? local.id : generateId();
  return saveSajuProfile({
    ...local,
    id: adoptId,
    userId: user.id,
    isPrimary: true,
  });
}

export async function loadAllSajuProfiles(): Promise<SajuProfile[]> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // 계정 전환 정리는 ClientShell reconcile에만 맡긴다.
      // 여기서 다시 clear 하면 방금 만든 프로필이 홈 게이트에서 안 보이는 레이스가 난다.
      const { data, error } = await supabase
        .from("saju_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const profiles = data.map((row) => rowToProfile(row as SajuProfileRow));
        saveLocalSajuProfiles(profiles);
        if (profiles.length === 0) {
          setLocalViewProfileId(null);
          const existing = loadLocalUserProfile();
          if (existing) {
            saveLocalUserProfile({
              ...existing,
              activeSajuProfileId: null,
              activeJournalProfileId: null,
              activeViewProfileId: null,
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          await syncActiveIdsFromRemote(user.id);
        }
        return profiles;
      }
      // 로그인인데 조회 실패 시 — 타인 로컬 캐시를 보여주지 않음
      const locals = loadLocalSajuProfiles().filter(
        (p) => !p.userId || p.userId === user.id
      );
      return locals;
    }
  }
  return loadLocalSajuProfiles();
}

async function syncActiveIdsFromRemote(userId: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const full = await supabase
    .from("user_profiles")
    .select(
      "active_saju_profile_id, active_journal_profile_id, active_view_profile_id"
    )
    .eq("id", userId)
    .maybeSingle();
  const row = (!full.error && full.data
    ? full.data
    : (
        await supabase
          .from("user_profiles")
          .select("active_saju_profile_id")
          .eq("id", userId)
          .maybeSingle()
      ).data) as {
    active_saju_profile_id?: string | null;
    active_journal_profile_id?: string | null;
    active_view_profile_id?: string | null;
  } | null;
  if (!row) return;
  const journal =
    row.active_journal_profile_id ?? row.active_saju_profile_id ?? null;
  const remoteView =
    typeof row.active_view_profile_id === "string" && row.active_view_profile_id
      ? row.active_view_profile_id
      : null;
  // 로컬 view가 있으면 우선 (클릭 직후·026 미적용·원격 지연 시 덮어쓰기 방지)
  const localView = getLocalViewProfileId();
  const view = localView ?? remoteView ?? journal;
  if (!localView && remoteView) {
    setLocalViewProfileId(remoteView);
  }
  ensureLocalUserProfile(journal, { journalId: journal, viewId: view });
}

function pickFromList(
  profiles: SajuProfile[],
  preferredId: string | null | undefined
): SajuProfile | null {
  if (profiles.length === 0) return null;
  if (preferredId) {
    const hit = profiles.find((p) => p.id === preferredId);
    if (hit) return hit;
  }
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

/** 일기·운세·명언에 쓰는 프로필 */
export async function loadJournalSajuProfile(): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  const local = loadLocalUserProfile();
  return pickFromList(
    profiles,
    local?.activeJournalProfileId ?? local?.activeSajuProfileId
  );
}

/** 만세력(/saju)에 표시하는 프로필 */
export async function loadViewSajuProfile(): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  const local = loadLocalUserProfile();
  const preferred =
    getLocalViewProfileId() ??
    local?.activeViewProfileId ??
    local?.activeJournalProfileId ??
    local?.activeSajuProfileId;
  return pickFromList(profiles, preferred);
}

/** @deprecated use loadJournalSajuProfile */
export async function loadPrimarySajuProfile(): Promise<SajuProfile | null> {
  return loadJournalSajuProfile();
}

async function upsertUserActiveIds(opts: {
  journalId?: string | null;
  viewId?: string | null;
  timezone?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const local = loadLocalUserProfile();
  const journalId =
    opts.journalId !== undefined
      ? opts.journalId
      : (local?.activeJournalProfileId ?? local?.activeSajuProfileId ?? null);
  const viewId =
    opts.viewId !== undefined
      ? opts.viewId
      : (local?.activeViewProfileId ?? journalId);

  ensureLocalUserProfile(journalId, { journalId, viewId });
  if (viewId) setLocalViewProfileId(viewId);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const payload: Record<string, unknown> = {
    id: user.id,
    locale: "ko-KR",
    timezone: opts.timezone ?? local?.timezone ?? "Asia/Seoul",
    schema_version: DIARY_SCHEMA_VERSION,
    updated_at: now,
  };
  if (journalId) {
    payload.active_saju_profile_id = journalId;
    payload.active_journal_profile_id = journalId;
  }
  if (viewId) {
    payload.active_view_profile_id = viewId;
  }

  const { error } = await supabase.from("user_profiles").upsert(payload);
  if (error && /active_journal_profile_id|active_view_profile_id/.test(error.message)) {
    // 026 not applied — legacy columns only
    await supabase.from("user_profiles").upsert({
      id: user.id,
      locale: "ko-KR",
      timezone: opts.timezone ?? "Asia/Seoul",
      active_saju_profile_id: journalId,
      schema_version: DIARY_SCHEMA_VERSION,
      updated_at: now,
    });
  }
}

/** 일기용 프로필로 지정 (is_primary + journal active)
 *  현재는 ‘나’ 고정 — 이미 일기 프로필이 있으면 다른 id로 전환 불가.
 */
export async function setJournalSajuProfile(
  profileId: string
): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return null;

  const local = loadLocalUserProfile();
  const currentJournalId =
    local?.activeJournalProfileId ??
    local?.activeSajuProfileId ??
    profiles.find((p) => p.isPrimary)?.id ??
    null;

  if (currentJournalId && currentJournalId !== profileId) {
    throw new Error(
      "지금은 내 프로필로만 일기를 쓸 수 있어요. (다른 프로필 일기는 나중에 열 수 있습니다)"
    );
  }

  const saved = await saveSajuProfile({ ...target, isPrimary: true });
  await upsertUserActiveIds({
    journalId: saved.id,
    timezone: saved.timezone,
  });
  return saved;
}

/** 만세력 보기용 프로필만 전환 (일기 스코프 유지) */
export async function setViewSajuProfile(
  profileId: string,
  opts?: { notify?: boolean }
): Promise<SajuProfile | null> {
  // 원격 sync가 덮어쓰기 전에 로컬 view를 먼저 고정
  setLocalViewProfileId(profileId);
  const profiles = await loadAllSajuProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return null;
  await upsertUserActiveIds({
    viewId: target.id,
    timezone: target.timezone,
  });
  if (opts?.notify !== false) {
    notifySajuProfileChanged();
  }
  return target;
}

/** id로 프로필 조회 (현재 계정 원격 목록 기준) */
export async function loadSajuProfileById(
  profileId: string
): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  return profiles.find((p) => p.id === profileId) ?? null;
}

/**
 * 다른 사람 프로필 삭제 (일기용/내 프로필은 삭제 불가).
 * view가 그 사람이면 내(journal) 프로필로 되돌림.
 */
export async function deleteSajuProfile(profileId: string): Promise<void> {
  const profiles = await loadAllSajuProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) throw new Error("프로필을 찾을 수 없어요.");

  const local = loadLocalUserProfile();
  const journalId =
    local?.activeJournalProfileId ??
    local?.activeSajuProfileId ??
    profiles.find((p) => p.isPrimary)?.id ??
    null;

  if (
    target.isPrimary ||
    (journalId && target.id === journalId)
  ) {
    throw new Error("내 프로필은 삭제할 수 없어요.");
  }

  const next = profiles.filter((p) => p.id !== profileId);
  saveLocalSajuProfiles(next);

  const viewId = getLocalViewProfileId() ?? local?.activeViewProfileId;
  if (viewId === profileId) {
    setLocalViewProfileId(journalId);
    await upsertUserActiveIds({
      journalId,
      viewId: journalId,
    });
  }

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from("saju_profiles")
        .delete()
        .eq("id", profileId)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    }
  }

  notifySajuProfileChanged();
}

/** @deprecated use setJournalSajuProfile — also used to mean "activate for everything" historically */
export async function setActiveSajuProfile(
  profileId: string
): Promise<SajuProfile | null> {
  return setJournalSajuProfile(profileId);
}
