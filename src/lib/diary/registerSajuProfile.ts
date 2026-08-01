import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput, SajuResult } from "@/lib/saju/types";
import {
  completeOnboarding,
  markOnboardingCompletedLocal,
  saveExperienceModeLocal,
} from "@/lib/app/experienceMode";
import { DEFAULT_EXPERIENCE_MODE } from "@/lib/product/modes";
import type { ExperienceMode, SajuProfile } from "@/lib/diary/types";
import {
  buildSajuProfileFromResult,
  ensureLocalUserProfile,
  loadLocalSajuProfiles,
  notifySajuProfileChanged,
  saveLocalUserProfile,
  saveSajuProfile,
} from "@/lib/diary/profileStorage";
import { loadSajuSettings, saveSajuSettings } from "@/lib/diary/sajuSettings";

function isSupportedGender(
  value: unknown
): value is NonNullable<SajuProfile["gender"]> {
  return value === "male" || value === "female";
}

function persistBirthSettings(result: SajuResult): void {
  const current = loadSajuSettings();
  const hour = result.input.original.hour;
  const minute = result.input.original.minute;
  const gender = result.input.original.gender;

  saveSajuSettings({
    ...current,
    birthDate: result.input.normalizedSolarDate,
    birthHour: hour !== undefined ? hour : undefined,
    birthMinute: minute !== undefined && hour !== undefined ? minute : undefined,
    gender: isSupportedGender(gender) ? gender : current.gender,
  });
}

export type RegisterSajuOptions = {
  experienceMode?: ExperienceMode;
  /** 사람 이름 (프로필 표시명) */
  label?: string;
  /**
   * true면 적용 중 프로필로 저장.
   * 생략 시: 기존 프로필이 없으면 true, 있으면 false(추가만).
   */
  makePrimary?: boolean;
  /** PostHog: onboarding | settings */
  analyticsSource?: "onboarding" | "settings";
  analyticsStartedAt?: number;
};

/** 이미 계산된 결과로 프로필 저장 + 온보딩 완료 */
export async function registerSajuProfileFromResult(
  result: SajuResult,
  opts?: RegisterSajuOptions
): Promise<SajuProfile> {
  const existing = loadLocalSajuProfiles();
  const makePrimary = opts?.makePrimary ?? existing.length === 0;
  const label = opts?.label?.trim() || "이름 없음";

  // 수정 전 버전을 쌓지 않음 — 적용 중 프로필이 있으면 덮어쓴다
  if (makePrimary) {
    const primary =
      existing.find((p) => p.isPrimary) ?? existing[0] ?? null;
    if (primary) {
      return updateSajuProfileFromResult(primary, result, { label });
    }
  }

  if (makePrimary) {
    persistBirthSettings(result);
    // saveSajuProfile의 user_profiles upsert보다 먼저 로컬 온보딩을 세워
    // 원격 행이 빈 onboarding으로 생겨 홈이 막히는 일을 막는다.
    const mode = opts?.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
    const at = new Date().toISOString();
    markOnboardingCompletedLocal(at);
    saveExperienceModeLocal(mode);
    const local = ensureLocalUserProfile();
    saveLocalUserProfile({
      ...local,
      experienceMode: mode,
      onboardingCompletedAt: at,
      updatedAt: at,
    });
  }

  const built = buildSajuProfileFromResult(result, {
    label,
    isPrimary: makePrimary,
  });

  let profile = built;
  try {
    profile = await saveSajuProfile(built);
  } catch {
    // 원격 실패 시에도 saveSajuProfile이 로컬은 먼저 쓴다. 로컬만으로 진행.
    profile = built;
  }

  if (makePrimary) {
    await completeOnboarding(opts?.experienceMode ?? "balanced");
  }
  notifySajuProfileChanged();
  try {
    const { ANALYTICS_EVENTS, captureEvent, markPersonProfileCreated } =
      await import("@/lib/analytics/posthog");
    const { completionTimeBucket } = await import("@/lib/analytics/buckets");
    captureEvent(ANALYTICS_EVENTS.profileCreated, {
      source: opts?.analyticsSource ?? (makePrimary ? "onboarding" : "settings"),
      completion_time_bucket: completionTimeBucket(opts?.analyticsStartedAt),
    });
    markPersonProfileCreated();
  } catch {
    /* analytics optional */
  }
  return profile;
}

/** 기존 프로필 생년월일·이름 수정 */
export async function updateSajuProfileFromResult(
  existing: SajuProfile,
  result: SajuResult,
  opts?: { label?: string }
): Promise<SajuProfile> {
  const label = opts?.label?.trim() || existing.label || "이름 없음";
  if (existing.isPrimary) {
    persistBirthSettings(result);
  }

  const built = buildSajuProfileFromResult(result, {
    id: existing.id,
    userId: existing.userId,
    label,
    isPrimary: existing.isPrimary,
  });

  let profile = {
    ...built,
    createdAt: existing.createdAt,
  };
  try {
    profile = await saveSajuProfile(profile);
  } catch {
    /* local already written inside saveSajuProfile when possible */
  }
  notifySajuProfileChanged();
  return profile;
}

/** 생년월일 입력 → 계산 → 프로필 저장 → 온보딩 완료 */
export async function registerSajuProfile(
  input: SajuInput,
  opts?: RegisterSajuOptions
): Promise<SajuProfile> {
  return registerSajuProfileFromResult(calculateSaju(input), opts);
}
