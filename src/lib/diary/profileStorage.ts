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
const CALCULATOR_VERSION = "0.1.0";
export const SAJU_PROFILE_CHANGED_EVENT = "manseryeok:saju-profile-changed";

export function notifySajuProfileChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAJU_PROFILE_CHANGED_EVENT));
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
  activeSajuProfileId?: string | null
): UserProfile {
  const existing = loadLocalUserProfile();
  const now = new Date().toISOString();
  if (existing) {
    const next = {
      ...existing,
      activeSajuProfileId:
        activeSajuProfileId ?? existing.activeSajuProfileId ?? null,
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
    activeSajuProfileId: activeSajuProfileId ?? null,
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
    await supabase.from("user_profiles").upsert({
      id: user.id,
      locale: "ko-KR",
      timezone: remote.timezone,
      active_saju_profile_id: remote.id,
      schema_version: DIARY_SCHEMA_VERSION,
      updated_at: remote.updatedAt,
    });
  }

  upsertLocalProfileList(remote);
  return remote;
}

/**
 * 비로그인 상태에서 만든 로컬 사주 프로필을 첫 로그인 후 계정에 연결합니다.
 * 이미 계정에 primary 프로필이 있으면 원격 프로필을 우선하며 덮어쓰지 않습니다.
 */
export async function syncLocalSajuProfileToAccount(): Promise<SajuProfile | null> {
  const localProfiles = loadLocalSajuProfiles();
  const local = localProfiles.find((p) => p.isPrimary) ?? localProfiles[0] ?? null;
  const supabase = getSupabaseBrowserClient();
  if (!local || !supabase) return local;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return local;

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

  return saveSajuProfile({ ...local, userId: user.id, isPrimary: true });
}

export async function loadAllSajuProfiles(): Promise<SajuProfile[]> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("saju_profiles")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (!error && data) {
        const profiles = data.map((row) => rowToProfile(row as SajuProfileRow));
        saveLocalSajuProfiles(profiles);
        return profiles;
      }
    }
  }
  return loadLocalSajuProfiles();
}

export async function loadPrimarySajuProfile(): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  if (profiles.length === 0) return null;
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

/** 적용 중 프로필 바꾸기 */
export async function setActiveSajuProfile(
  profileId: string
): Promise<SajuProfile | null> {
  const profiles = await loadAllSajuProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return null;
  return saveSajuProfile({ ...target, isPrimary: true });
}
