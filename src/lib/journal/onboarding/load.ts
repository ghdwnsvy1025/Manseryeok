/**
 * 서버 측 온보딩 프로필 로드 (Supabase)
 * — 실패 시 조용히 빈 프로필. 운세·질문 생성이 온보딩 때문에 깨지지 않게 한다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deriveOnboardingProfile,
  EMPTY_ONBOARDING_PROFILE,
  type OnboardingProfile,
} from "./profile";
import type { OnboardingAnswers } from "./questions";

export async function loadOnboardingProfile(
  sb: SupabaseClient,
  userId: string,
  sajuProfileId: string
): Promise<OnboardingProfile> {
  try {
    const { data, error } = await sb
      .from("journal_onboarding_profiles")
      .select("answers, derived")
      .eq("user_id", userId)
      .eq("saju_profile_id", sajuProfileId)
      .maybeSingle();
    if (error || !data) return EMPTY_ONBOARDING_PROFILE;

    const derived = data.derived as OnboardingProfile | null;
    if (derived && typeof derived.completeness === "number") return derived;
    return deriveOnboardingProfile((data.answers ?? {}) as OnboardingAnswers);
  } catch {
    return EMPTY_ONBOARDING_PROFILE;
  }
}
