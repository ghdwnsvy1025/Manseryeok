import type { SajuResult } from "@/lib/saju/types";
import type { Gender } from "@/lib/saju/daeun";
import {
  DIARY_SCHEMA_VERSION,
  type SajuProfile,
  type SajuProfilePillars,
  type UserBirthPillarDetail,
  type UserProfile,
} from "./types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const LOCAL_SAJU_PROFILE_KEY = "manseryeok_saju_profile_v2";
const LOCAL_USER_PROFILE_KEY = "manseryeok_user_profile_v2";
const CALCULATOR_VERSION = "0.1.0";

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

export function buildSajuProfileFromResult(
  result: SajuResult,
  opts?: { id?: string; userId?: string | null; label?: string }
): SajuProfile {
  const now = new Date().toISOString();
  const original = result.input.original;
  const options = result.options;
  const birthTimeUnknown =
    original.hour === undefined || original.minute === undefined;

  return {
    id: opts?.id ?? generateId(),
    userId: opts?.userId ?? null,
    label: opts?.label ?? "내 사주",
    isPrimary: true,
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
  saveLocalSajuProfile(profile);
  ensureLocalUserProfile(profile.id);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return profile;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return profile;

  const { data: existingPrimary } = await supabase
    .from("saju_profiles")
    .select("id, created_at")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();

  const withUser = {
    ...profile,
    id: existingPrimary?.id ?? profile.id,
    userId: user.id,
    createdAt: existingPrimary?.created_at ?? profile.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("saju_profiles")
    .upsert(profileToRow(withUser, user.id), { onConflict: "id" });
  if (error) throw new Error(error.message);

  await supabase.from("user_profiles").upsert({
    id: user.id,
    locale: "ko-KR",
    timezone: withUser.timezone,
    active_saju_profile_id: withUser.id,
    schema_version: DIARY_SCHEMA_VERSION,
    updated_at: withUser.updatedAt,
  });

  saveLocalSajuProfile(withUser);
  return withUser;
}

/**
 * 비로그인 상태에서 만든 로컬 사주 프로필을 첫 로그인 후 계정에 연결합니다.
 * 이미 계정에 primary 프로필이 있으면 원격 프로필을 우선하며 덮어쓰지 않습니다.
 */
export async function syncLocalSajuProfileToAccount(): Promise<SajuProfile | null> {
  const local = loadLocalSajuProfile();
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
    saveLocalSajuProfile(remote);
    ensureLocalUserProfile(remote.id);
    return remote;
  }

  return saveSajuProfile({ ...local, userId: user.id });
}

export async function loadPrimarySajuProfile(): Promise<SajuProfile | null> {
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
        .eq("is_primary", true)
        .maybeSingle();
      if (!error && data) {
        const profile = rowToProfile(data as SajuProfileRow);
        saveLocalSajuProfile(profile);
        return profile;
      }
    }
  }
  return loadLocalSajuProfile();
}
