export type LifeArea =
  | "work"
  | "study"
  | "relationship"
  | "romance"
  | "family"
  | "money"
  | "condition"
  | "self"
  | "none";

export const LIFE_AREA_OPTIONS: Array<{ id: LifeArea; label: string }> = [
  { id: "work", label: "일" },
  { id: "study", label: "공부" },
  { id: "relationship", label: "관계" },
  { id: "romance", label: "연애" },
  { id: "family", label: "가족" },
  { id: "money", label: "돈" },
  { id: "condition", label: "건강·컨디션" },
  { id: "self", label: "나 자신" },
  { id: "none", label: "특별한 일 없음" },
];

export type AnalysisFeedback =
  | "agree"
  | "partly_agree"
  | "disagree"
  | "unsure";

export const ANALYSIS_FEEDBACK_LABELS: Record<AnalysisFeedback, string> = {
  agree: "맞는 것 같아요",
  partly_agree: "일부만 맞아요",
  disagree: "아니에요",
  unsure: "잘 모르겠어요",
};

export type ForecastMatchLevelUi =
  | "very_similar"
  | "partly_similar"
  | "different"
  | "unsure";

export type ReflectionSource = "generated" | "verified_quote";

export type DiaryWriteMode = "quick" | "oneline" | "free";

export const DEFAULT_CHECKIN_TAGS = [
  "성취",
  "부담",
  "갈등",
  "기다림",
  "휴식",
  "새로운 만남",
  "소비",
  "이동",
  "몰입",
  "걱정",
  "설렘",
  "외로움",
] as const;

export type FocusRating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const FOCUS_RATING_LABELS: Record<FocusRating, string> = {
  1: "최악",
  2: "매우 산만",
  3: "산만함",
  4: "조금 산만",
  5: "보통↓",
  6: "보통",
  7: "괜찮음",
  8: "잘됨",
  9: "매우 잘됨",
  10: "최고",
};
