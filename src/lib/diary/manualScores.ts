import {
  clampScore,
  type DiaryAnalysis,
  type EmotionLabel,
  type ScaleScore,
} from "./dimensions";

export type DiaryInputMode = "text" | "scores";

export const MANUAL_WELLBEING_DIMENSIONS = [
  { id: "joy", label: "즐거움", color: "#fbbf24" },
  { id: "calm", label: "편안함", color: "#34d399" },
  { id: "energy", label: "에너지", color: "#60a5fa" },
  { id: "engagement", label: "몰입", color: "#a78bfa" },
  { id: "relationship", label: "관계", color: "#f472b6" },
  { id: "autonomy", label: "자율성", color: "#818cf8" },
  { id: "achievement", label: "성취", color: "#fb923c" },
  { id: "meaning", label: "의미", color: "#c084fc" },
] as const;

export type ManualWellbeingId =
  (typeof MANUAL_WELLBEING_DIMENSIONS)[number]["id"];
export type ManualWellbeingScores = Record<ManualWellbeingId, ScaleScore>;

export type ManualScoreState = {
  dimensions: ManualWellbeingScores;
};

export const DEFAULT_WELLBEING = 50;

export function wellbeingToEmotionLabel(wellbeing: ScaleScore): EmotionLabel {
  if (wellbeing >= 80) return "very_positive";
  if (wellbeing >= 60) return "positive";
  if (wellbeing >= 40) return "neutral";
  if (wellbeing >= 20) return "negative";
  return "very_negative";
}

function createDimensions(value: number): ManualWellbeingScores {
  const score = clampScore(value);
  return {
    joy: score,
    calm: score,
    energy: score,
    engagement: score,
    relationship: score,
    autonomy: score,
    achievement: score,
    meaning: score,
  };
}

export function createManualScoreState(): ManualScoreState {
  return { dimensions: createDimensions(DEFAULT_WELLBEING) };
}

/** 현재 행복도를 모든 세부 항목의 조절 시작값으로 사용 */
export function createManualScoreStateFromWellbeing(
  wellbeing: number
): ManualScoreState {
  return { dimensions: createDimensions(wellbeing) };
}

export function updateManualWellbeingScore(
  state: ManualScoreState,
  key: ManualWellbeingId,
  value: ScaleScore
): ManualScoreState {
  return {
    ...state,
    dimensions: {
      ...state.dimensions,
      [key]: clampScore(value),
    },
  };
}

function averageWellbeing(dimensions: ManualWellbeingScores): ScaleScore {
  const values = Object.values(dimensions);
  return clampScore(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
}

export function manualStateToAnalysis(state: ManualScoreState): DiaryAnalysis {
  const d = state.dimensions;
  const inverseCalm = 100 - d.calm;
  const scores = {
    happiness_score: d.joy,
    depression_score: inverseCalm,
    anxiety_score: inverseCalm,
    stress_score: inverseCalm,
    achievement_score: d.achievement,
    meaning_score: d.meaning,
    energy_score: d.energy,
    relationship_score: d.relationship,
    gratitude_score: d.engagement,
    self_acceptance_score: d.autonomy,
  };

  const daily_wellbeing_score = averageWellbeing(d);
  const emotion_label = wellbeingToEmotionLabel(daily_wellbeing_score);

  const directReason = "웰빙 항목에서 직접 설정한 점수입니다.";
  const score_reasons = {
    depression_score: directReason,
    anxiety_score: directReason,
    stress_score: directReason,
    achievement_score: directReason,
    meaning_score: directReason,
    energy_score: directReason,
    relationship_score: directReason,
    gratitude_score: directReason,
    self_acceptance_score: directReason,
  };

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
  const psych = analysis.psychological_analysis;
  const calm = clampScore(
    100 -
      (analysis.depression_score +
        analysis.anxiety_score +
        analysis.stress_score) /
        3
  );
  return {
    dimensions: {
      joy: psych
        ? clampScore(psych.perma.positive_emotion.score * 10)
        : analysis.happiness_score,
      calm,
      energy: analysis.energy_score,
      engagement: psych
        ? clampScore(psych.perma.engagement.score * 10)
        : analysis.gratitude_score,
      relationship: psych
        ? clampScore(psych.perma.relationships.score * 10)
        : analysis.relationship_score ?? analysis.daily_wellbeing_score,
      autonomy: psych
        ? clampScore(psych.sdt.autonomy.score * 10)
        : analysis.self_acceptance_score,
      achievement: psych
        ? clampScore(psych.perma.accomplishment.score * 10)
        : analysis.achievement_score,
      meaning: psych
        ? clampScore(psych.perma.meaning.score * 10)
        : analysis.meaning_score,
    },
  };
}

export function formatManualDiaryContent(state: ManualScoreState): string {
  const analysis = manualStateToAnalysis(state);
  return `오늘의 행복도: ${analysis.daily_wellbeing_score}점`;
}

/** 행복도(+선택 mood)만으로 분석 객체 생성 — 홈 단순 기록용 */
export function wellbeingToAnalysis(
  wellbeing: number,
  emotionLabel?: EmotionLabel
): DiaryAnalysis {
  const w = clampScore(wellbeing);
  const analysis = manualStateToAnalysis({
    dimensions: createDimensions(w),
  });
  return {
    ...analysis,
    happiness_score: w,
    daily_wellbeing_score: w,
    emotion_label: emotionLabel ?? wellbeingToEmotionLabel(w),
    summary: `오늘의 행복도는 ${w}점이에요.`,
  };
}

export function analysisToWellbeing(analysis: DiaryAnalysis | null | undefined): number {
  if (!analysis) return DEFAULT_WELLBEING;
  return clampScore(analysis.daily_wellbeing_score);
}

export function inferInputMode(entry: {
  inputMode?: DiaryInputMode;
  content: string;
}): DiaryInputMode {
  if (entry.inputMode) return entry.inputMode;
  if (/^오늘의 행복도:\s*\d+점/.test(entry.content.trim())) return "scores";
  return "text";
}
