import {
  clampScore,
  computeDailyWellbeing,
  createEmptyScoreReasons,
  DETAIL_SCORE_DIMENSIONS,
  type DetailScoreDimensionId,
  type DiaryAnalysis,
  type EmotionLabel,
  type ScaleScore,
} from "./dimensions";

export type DiaryInputMode = "text" | "scores";

export type ManualDetailScores = {
  depression_score: ScaleScore;
  anxiety_score: ScaleScore;
  stress_score: ScaleScore;
  achievement_score: ScaleScore;
  meaning_score: ScaleScore;
  energy_score: ScaleScore;
  relationship_score: ScaleScore | null;
  gratitude_score: ScaleScore;
  self_acceptance_score: ScaleScore;
};

export type ManualScoreState = {
  details: ManualDetailScores;
};

export const DEFAULT_WELLBEING = 50;

export function wellbeingToEmotionLabel(wellbeing: ScaleScore): EmotionLabel {
  if (wellbeing >= 80) return "very_positive";
  if (wellbeing >= 60) return "positive";
  if (wellbeing >= 40) return "neutral";
  if (wellbeing >= 20) return "negative";
  return "very_negative";
}

function createDefaultDetails(): ManualDetailScores {
  const w = DEFAULT_WELLBEING;
  const negative = 100 - w;
  return {
    depression_score: negative,
    anxiety_score: negative,
    stress_score: negative,
    achievement_score: w,
    meaning_score: w,
    energy_score: w,
    relationship_score: w,
    gratitude_score: w,
    self_acceptance_score: w,
  };
}

export function createManualScoreState(): ManualScoreState {
  return {
    details: createDefaultDetails(),
  };
}

export function updateDetailScore(
  state: ManualScoreState,
  key: DetailScoreDimensionId,
  value: ScaleScore | null
): ManualScoreState {
  return {
    ...state,
    details: {
      ...state.details,
      [key]: key === "relationship_score" ? value : clampScore(value ?? 0),
    },
  };
}

function computeHappinessFromDetails(details: ManualDetailScores): ScaleScore {
  const positives = [
    details.achievement_score,
    details.meaning_score,
    details.energy_score,
    details.relationship_score ?? DEFAULT_WELLBEING,
    details.gratitude_score,
    details.self_acceptance_score,
  ];
  const avg =
    positives.reduce((sum, v) => sum + v, 0) / (positives.length || 1);
  return clampScore(avg);
}

export function manualStateToAnalysis(state: ManualScoreState): DiaryAnalysis {
  const happiness_score = computeHappinessFromDetails(state.details);

  const scores = {
    happiness_score,
    ...state.details,
  };

  const daily_wellbeing_score = computeDailyWellbeing(scores);
  const emotion_label = wellbeingToEmotionLabel(daily_wellbeing_score);

  const score_reasons = createEmptyScoreReasons();
  for (const dim of DETAIL_SCORE_DIMENSIONS) {
    if (dim.id === "relationship_score") {
      score_reasons.relationship_score =
        state.details.relationship_score === null
          ? null
          : "직접 설정한 점수입니다.";
    } else {
      score_reasons[dim.id] = "직접 설정한 점수입니다.";
    }
  }

  return {
    ...scores,
    daily_wellbeing_score,
    emotion_label,
    dominant_emotions: [],
    summary: `오늘의 행복도는 ${daily_wellbeing_score}점이에요.`,
    key_events: [],
    reason: "슬라이더로 직접 기록한 감정 점수입니다.",
    confidence: 100,
    score_reasons,
    psychological_analysis: null,
  };
}

export function analysisToManualState(analysis: DiaryAnalysis): ManualScoreState {
  return {
    details: {
      depression_score: analysis.depression_score,
      anxiety_score: analysis.anxiety_score,
      stress_score: analysis.stress_score,
      achievement_score: analysis.achievement_score,
      meaning_score: analysis.meaning_score,
      energy_score: analysis.energy_score,
      relationship_score: analysis.relationship_score,
      gratitude_score: analysis.gratitude_score,
      self_acceptance_score: analysis.self_acceptance_score,
    },
  };
}

export function formatManualDiaryContent(state: ManualScoreState): string {
  const analysis = manualStateToAnalysis(state);
  return `오늘의 행복도: ${analysis.daily_wellbeing_score}점`;
}

export function inferInputMode(entry: {
  inputMode?: DiaryInputMode;
  content: string;
}): DiaryInputMode {
  if (entry.inputMode) return entry.inputMode;
  if (/^오늘의 행복도:\s*\d+점/.test(entry.content.trim())) return "scores";
  return "text";
}
