import { calculateSaju } from "@/lib/saju/calculator";
import type { SajuInput, SajuResult } from "@/lib/saju/types";
import { completeOnboarding } from "@/lib/app/experienceMode";
import type { ExperienceMode, SajuProfile } from "@/lib/diary/types";
import {
  buildSajuProfileFromResult,
  loadLocalSajuProfiles,
  notifySajuProfileChanged,
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
};

/** 이미 계산된 결과로 프로필 저장 + 온보딩 완료 */
export async function registerSajuProfileFromResult(
  result: SajuResult,
  opts?: RegisterSajuOptions
): Promise<SajuProfile> {
  const existing = loadLocalSajuProfiles();
  const makePrimary = opts?.makePrimary ?? existing.length === 0;
  const label = opts?.label?.trim() || "이름 없음";

  if (makePrimary) {
    persistBirthSettings(result);
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
  return profile;
}

/** 생년월일 입력 → 계산 → 프로필 저장 → 온보딩 완료 */
export async function registerSajuProfile(
  input: SajuInput,
  opts?: RegisterSajuOptions
): Promise<SajuProfile> {
  return registerSajuProfileFromResult(calculateSaju(input), opts);
}
