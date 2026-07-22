/**
 * 사용자 경험 모드 (제품 IA)
 * - diary: 일기 위주 (사주 용어 최소)
 * - balanced: 균형형 (기본)
 * - saju: 사주 위주
 * - study: 공부 위주
 *
 * 구버전 beginner → balanced, expert → saju
 */
export type UserExperienceMode = "diary" | "balanced" | "saju" | "study";

/** @deprecated 구버전 호환용 별칭 — UserExperienceMode 사용 */
export type ExperienceMode = UserExperienceMode;

export const DEFAULT_EXPERIENCE_MODE: UserExperienceMode = "balanced";

export const EXPERIENCE_MODE_LABELS: Record<UserExperienceMode, string> = {
  diary: "일기 중심",
  balanced: "균형형",
  saju: "사주 중심",
  study: "공부 중심",
};

export const EXPERIENCE_MODE_HINTS: Record<UserExperienceMode, string> = {
  diary: "감정·기록·조언 위주로 보여줍니다.",
  balanced: "기록과 사주 흐름을 함께 보여줍니다.",
  saju: "간지·십신·합충 등 사주 흐름을 중심에 둡니다.",
  study: "이론과 내 기록을 나란히 보여줍니다.",
};

export function isUserExperienceMode(value: unknown): value is UserExperienceMode {
  return (
    value === "diary" ||
    value === "balanced" ||
    value === "saju" ||
    value === "study"
  );
}

/** 구버전 beginner|expert 및 신규 모드를 정규화 */
export function normalizeExperienceMode(value: unknown): UserExperienceMode | null {
  if (isUserExperienceMode(value)) return value;
  if (value === "beginner") return "balanced";
  if (value === "expert") return "saju";
  return null;
}

/** 일기형/균형형에서는 쉬운 표현, 사주/공부형은 용어 노출 */
export function prefersPlainLanguage(mode: UserExperienceMode): boolean {
  return mode === "diary" || mode === "balanced";
}

export function prefersSajuTerms(mode: UserExperienceMode): boolean {
  return mode === "saju" || mode === "study";
}

/** 모드별 B 차원 라벨 */
export function bDimensionLabel(
  mode: UserExperienceMode,
  kind: "stem" | "branch" | "ganji" | "tenGod"
): string {
  if (prefersPlainLanguage(mode)) {
    switch (kind) {
      case "stem":
        return "오늘의 방향";
      case "branch":
        return "오늘의 리듬";
      case "ganji":
        return "오늘의 흐름";
      case "tenGod":
        return "나에게 온 역할";
    }
  }
  switch (kind) {
    case "stem":
      return "천간";
    case "branch":
      return "지지";
    case "ganji":
      return "간지";
    case "tenGod":
      return "십신";
  }
}
