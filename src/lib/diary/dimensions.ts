// ============================================================
// 일기 감정 차원 정의 (UI · AI 프롬프트 공통 소스)
// ============================================================

/** 0–100 정수 (1점 단위) */
export type ScaleScore = number;

export const POSITIVE_SCORE_KEYS = [
  "happiness_score",
  "achievement_score",
  "meaning_score",
  "energy_score",
  "relationship_score",
  "gratitude_score",
  "self_acceptance_score",
] as const;

export const NEGATIVE_SCORE_KEYS = [
  "depression_score",
  "anxiety_score",
  "stress_score",
] as const;

export const SCORE_DIMENSIONS = [
  { id: "happiness_score", label: "행복", group: "positive", description: "기쁨, 만족, 긍정적 기분", hiddenInDetail: true },
  { id: "depression_score", label: "우울", group: "negative", description: "슬픔, 무기력, 공허함" },
  { id: "anxiety_score", label: "불안", group: "negative", description: "걱정, 긴장, 두려움" },
  { id: "stress_score", label: "스트레스", group: "negative", description: "부담, 압박, 번아웃" },
  { id: "achievement_score", label: "성취", group: "positive", description: "성과, 진전, 생산성" },
  { id: "meaning_score", label: "보람", group: "positive", description: "의미, 만족, 보상" },
  { id: "energy_score", label: "활력", group: "positive", description: "의욕, 신체·정신 에너지" },
  { id: "relationship_score", label: "관계", group: "positive", description: "관계 만족, 연결, 지지", nullable: true },
  { id: "gratitude_score", label: "감사", group: "positive", description: "감사, 감사함, 만족" },
  { id: "self_acceptance_score", label: "자기수용", group: "positive", description: "자존감, 자기신뢰" },
] as const;

export type ScoreDimensionId = (typeof SCORE_DIMENSIONS)[number]["id"];

export type DetailScoreDimensionId = Exclude<ScoreDimensionId, "happiness_score">;

/** 세부 점수 UI에 표시할 차원 (행복 제외 — 총 행복도로 대체) */
export const DETAIL_SCORE_DIMENSIONS = SCORE_DIMENSIONS.filter(
  (d): d is (typeof SCORE_DIMENSIONS)[number] & { id: DetailScoreDimensionId } =>
    d.id !== "happiness_score"
);

export type ScoreReasons = {
  [K in DetailScoreDimensionId]: K extends "relationship_score" ? string | null : string;
};

export type EmotionLabel =
  | "very_positive"
  | "positive"
  | "neutral"
  | "mixed"
  | "negative"
  | "very_negative";

export const EMOTION_LABEL_KO: Record<EmotionLabel, string> = {
  very_positive: "매우 긍정",
  positive: "긍정",
  neutral: "중립",
  mixed: "혼합",
  negative: "부정",
  very_negative: "매우 부정",
};

export type DiaryAnalysis = {
  happiness_score: ScaleScore;
  depression_score: ScaleScore;
  anxiety_score: ScaleScore;
  stress_score: ScaleScore;
  achievement_score: ScaleScore;
  meaning_score: ScaleScore;
  energy_score: ScaleScore;
  relationship_score: ScaleScore | null;
  gratitude_score: ScaleScore;
  self_acceptance_score: ScaleScore;
  daily_wellbeing_score: number;
  emotion_label: EmotionLabel;
  dominant_emotions: string[];
  summary: string;
  key_events: string[];
  reason: string;
  confidence: number;
  score_reasons: ScoreReasons;
};

export function clampScore(value: number): ScaleScore {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeScoreValue(value: unknown, nullable = false): ScaleScore | null {
  if (value === null || value === undefined) {
    return nullable ? null : 0;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return nullable ? null : 0;
  }
  return clampScore(value);
}

export function computeDailyWellbeing(
  scores: Pick<
    DiaryAnalysis,
    | "happiness_score"
    | "depression_score"
    | "anxiety_score"
    | "stress_score"
    | "achievement_score"
    | "meaning_score"
    | "energy_score"
    | "relationship_score"
    | "gratitude_score"
    | "self_acceptance_score"
  >
): number {
  const positiveValues = POSITIVE_SCORE_KEYS.map((key) => scores[key]).filter(
    (v): v is number => v !== null
  );
  const positiveAverage =
    positiveValues.length > 0
      ? positiveValues.reduce<number>((sum, v) => sum + v, 0) / positiveValues.length
      : 0;

  const negativeAverage =
    NEGATIVE_SCORE_KEYS.reduce<number>((sum, key) => sum + scores[key], 0) /
    NEGATIVE_SCORE_KEYS.length;

  return Math.round(positiveAverage * 0.6 + (100 - negativeAverage) * 0.4);
}

export function getDimensionLabel(id: ScoreDimensionId): string {
  return SCORE_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}

export function isEmotionLabel(value: string): value is EmotionLabel {
  return value in EMOTION_LABEL_KO;
}

export function createEmptyScoreReasons(): ScoreReasons {
  return {
    depression_score: "",
    anxiety_score: "",
    stress_score: "",
    achievement_score: "",
    meaning_score: "",
    energy_score: "",
    relationship_score: null,
    gratitude_score: "",
    self_acceptance_score: "",
  };
}
