/**
 * 사주 프로필 지문 — 생일/시간이 바뀌면 운세 캐시를 무효화한다.
 */
import type { SajuProfile } from "@/lib/diary/types";

export function sajuProfileFortuneFingerprint(
  profile: SajuProfile | null | undefined
): string {
  if (!profile) return "none";
  const day = profile.pillars?.day;
  const dayKey = day
    ? `${day.stemHanja ?? ""}:${day.branchHanja ?? ""}:${day.ganjiKo ?? ""}`
    : "";
  return [
    profile.birthDate ?? "",
    profile.birthTimeUnknown ? "tu" : `${profile.birthHour ?? ""}:${profile.birthMinute ?? ""}`,
    profile.gender ?? "",
    dayKey,
  ].join("|");
}
