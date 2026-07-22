import type { ExperienceMode, UserProfile } from "@/lib/diary/types";
import { DIARY_SCHEMA_VERSION } from "@/lib/diary/types";
import {
  DEFAULT_EXPERIENCE_MODE,
  normalizeExperienceMode,
  type UserExperienceMode,
} from "@/lib/product/modes";
import {
  ensureLocalUserProfile,
  loadLocalUserProfile,
  saveLocalUserProfile,
} from "@/lib/diary/profileStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const EXPERIENCE_MODE_KEY = "manseryeok_experience_mode";
const ONBOARDING_DONE_KEY = "manseryeok_onboarding_completed_at";

export function isExperienceMode(value: unknown): value is ExperienceMode {
  return normalizeExperienceMode(value) != null;
}

export function loadExperienceModeLocal(): ExperienceMode | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(EXPERIENCE_MODE_KEY);
  const normalized = normalizeExperienceMode(raw);
  if (normalized && raw !== normalized) {
    localStorage.setItem(EXPERIENCE_MODE_KEY, normalized);
  }
  return normalized;
}

export function saveExperienceModeLocal(mode: ExperienceMode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EXPERIENCE_MODE_KEY, mode);
}

export function loadOnboardingCompletedAtLocal(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ONBOARDING_DONE_KEY);
}

export function markOnboardingCompletedLocal(at = new Date().toISOString()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARDING_DONE_KEY, at);
}

export async function loadUserExperienceSettings(): Promise<{
  experienceMode: ExperienceMode | null;
  onboardingCompletedAt: string | null;
  profile: UserProfile | null;
}> {
  const localMode = loadExperienceModeLocal();
  const localOnboarding = loadOnboardingCompletedAtLocal();
  let profile = loadLocalUserProfile();

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        const mode = normalizeExperienceMode(data.experience_mode);
        profile = {
          id: data.id,
          locale: data.locale ?? "ko-KR",
          timezone: data.timezone ?? "Asia/Seoul",
          activeSajuProfileId: data.active_saju_profile_id ?? null,
          experienceMode: mode,
          onboardingCompletedAt: data.onboarding_completed_at ?? null,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          schemaVersion: data.schema_version ?? DIARY_SCHEMA_VERSION,
        };
        saveLocalUserProfile(profile);
        if (profile.experienceMode) {
          saveExperienceModeLocal(profile.experienceMode);
        }
        if (profile.onboardingCompletedAt) {
          markOnboardingCompletedLocal(profile.onboardingCompletedAt);
        }
      }
    }
  }

  return {
    experienceMode: profile?.experienceMode ?? localMode,
    onboardingCompletedAt: profile?.onboardingCompletedAt ?? localOnboarding,
    profile,
  };
}

export async function saveExperienceMode(mode: ExperienceMode): Promise<void> {
  const resolved = normalizeExperienceMode(mode) ?? DEFAULT_EXPERIENCE_MODE;
  saveExperienceModeLocal(resolved);
  const now = new Date().toISOString();
  const local = ensureLocalUserProfile();
  const next: UserProfile = {
    ...local,
    experienceMode: resolved,
    updatedAt: now,
    schemaVersion: DIARY_SCHEMA_VERSION,
  };
  saveLocalUserProfile(next);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_profiles").upsert({
    id: user.id,
    locale: next.locale ?? "ko-KR",
    timezone: next.timezone ?? "Asia/Seoul",
    active_saju_profile_id: next.activeSajuProfileId ?? null,
    experience_mode: resolved,
    onboarding_completed_at: next.onboardingCompletedAt ?? null,
    schema_version: DIARY_SCHEMA_VERSION,
    updated_at: now,
  });
}

export async function completeOnboarding(
  mode: ExperienceMode | UserExperienceMode = DEFAULT_EXPERIENCE_MODE
): Promise<void> {
  const resolved = normalizeExperienceMode(mode) ?? DEFAULT_EXPERIENCE_MODE;
  const at = new Date().toISOString();
  markOnboardingCompletedLocal(at);
  saveExperienceModeLocal(resolved);

  const local = ensureLocalUserProfile();
  const next: UserProfile = {
    ...local,
    experienceMode: resolved,
    onboardingCompletedAt: at,
    updatedAt: at,
    schemaVersion: DIARY_SCHEMA_VERSION,
  };
  saveLocalUserProfile(next);

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_profiles").upsert({
    id: user.id,
    locale: next.locale ?? "ko-KR",
    timezone: next.timezone ?? "Asia/Seoul",
    active_saju_profile_id: next.activeSajuProfileId ?? null,
    experience_mode: resolved,
    onboarding_completed_at: at,
    schema_version: DIARY_SCHEMA_VERSION,
    updated_at: at,
  });
}
