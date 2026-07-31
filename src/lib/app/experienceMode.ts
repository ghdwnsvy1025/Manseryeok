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

/** 계정 전환 시 — 이전 계정의 온보딩/모드 로컬 캐시 제거 */
export function clearLocalExperienceState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(EXPERIENCE_MODE_KEY);
    localStorage.removeItem(ONBOARDING_DONE_KEY);
  } catch {
    /* ignore */
  }
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
          activeSajuProfileId:
            data.active_journal_profile_id ??
            data.active_saju_profile_id ??
            null,
          activeJournalProfileId:
            data.active_journal_profile_id ??
            data.active_saju_profile_id ??
            null,
          activeViewProfileId:
            data.active_view_profile_id ??
            data.active_journal_profile_id ??
            data.active_saju_profile_id ??
            null,
          experienceMode: mode,
          onboardingCompletedAt: data.onboarding_completed_at ?? null,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          schemaVersion: data.schema_version ?? DIARY_SCHEMA_VERSION,
        };
        saveLocalUserProfile(profile);
        if (profile.experienceMode) {
          saveExperienceModeLocal(profile.experienceMode);
        } else {
          try {
            localStorage.removeItem(EXPERIENCE_MODE_KEY);
          } catch {
            /* ignore */
          }
        }
        if (profile.onboardingCompletedAt) {
          markOnboardingCompletedLocal(profile.onboardingCompletedAt);
        } else if (localOnboarding) {
          // 원격 행은 있는데 온보딩 시각만 비어 있으면 로컬을 유지·복구
          // (saveSajuProfile upsert 직후 completeOnboarding 전에 읽히거나
          //  원격 upsert 실패 시 로컬을 지워 홈 진입이 막히던 문제)
          profile = {
            ...profile,
            onboardingCompletedAt: localOnboarding,
            experienceMode:
              profile.experienceMode ?? localMode ?? DEFAULT_EXPERIENCE_MODE,
          };
          saveLocalUserProfile(profile);
        } else {
          try {
            localStorage.removeItem(ONBOARDING_DONE_KEY);
          } catch {
            /* ignore */
          }
        }
        // 로그인 상태: 원격 + (필요 시) 로컬 온보딩 복구값
        return {
          experienceMode: profile.experienceMode ?? localMode ?? null,
          onboardingCompletedAt:
            profile.onboardingCompletedAt ?? localOnboarding ?? null,
          profile,
        };
      }

      // 원격 user_profiles 없음 — 이전 계정 캐시 대신, 방금 로컬 온보딩만 있으면 유지
      if (localOnboarding) {
        const now = new Date().toISOString();
        profile = {
          id: user.id,
          locale: "ko-KR",
          timezone: "Asia/Seoul",
          activeSajuProfileId:
            loadLocalUserProfile()?.activeJournalProfileId ??
            loadLocalUserProfile()?.activeSajuProfileId ??
            null,
          activeJournalProfileId:
            loadLocalUserProfile()?.activeJournalProfileId ??
            loadLocalUserProfile()?.activeSajuProfileId ??
            null,
          activeViewProfileId:
            loadLocalUserProfile()?.activeViewProfileId ?? null,
          experienceMode: localMode ?? DEFAULT_EXPERIENCE_MODE,
          onboardingCompletedAt: localOnboarding,
          createdAt: now,
          updatedAt: now,
          schemaVersion: DIARY_SCHEMA_VERSION,
        };
        saveLocalUserProfile(profile);
        return {
          experienceMode: profile.experienceMode,
          onboardingCompletedAt: localOnboarding,
          profile,
        };
      }

      clearLocalExperienceState();
      const now = new Date().toISOString();
      profile = {
        id: user.id,
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        activeSajuProfileId: null,
        activeJournalProfileId: null,
        activeViewProfileId: null,
        experienceMode: null,
        onboardingCompletedAt: null,
        createdAt: now,
        updatedAt: now,
        schemaVersion: DIARY_SCHEMA_VERSION,
      };
      saveLocalUserProfile(profile);
      return {
        experienceMode: null,
        onboardingCompletedAt: null,
        profile,
      };
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
    active_saju_profile_id: next.activeJournalProfileId ?? next.activeSajuProfileId ?? null,
    active_journal_profile_id:
      next.activeJournalProfileId ?? next.activeSajuProfileId ?? null,
    active_view_profile_id:
      next.activeViewProfileId ??
      next.activeJournalProfileId ??
      next.activeSajuProfileId ??
      null,
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
    active_saju_profile_id: next.activeJournalProfileId ?? next.activeSajuProfileId ?? null,
    active_journal_profile_id:
      next.activeJournalProfileId ?? next.activeSajuProfileId ?? null,
    active_view_profile_id:
      next.activeViewProfileId ??
      next.activeJournalProfileId ??
      next.activeSajuProfileId ??
      null,
    experience_mode: resolved,
    onboarding_completed_at: at,
    schema_version: DIARY_SCHEMA_VERSION,
    updated_at: at,
  });
}
