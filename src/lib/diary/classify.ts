import {
  computeDailyWellbeing,
  createEmptyScoreReasons,
  DETAIL_SCORE_DIMENSIONS,
  isEmotionLabel,
  NEGATIVE_SCORE_KEYS,
  normalizeScoreValue,
  POSITIVE_SCORE_KEYS,
  type DetailScoreDimensionId,
  type DiaryAnalysis,
  type EmotionLabel,
  type ScoreReasons,
} from "@/lib/diary/dimensions";

export type ClassifyInput = {
  content: string;
  date?: string;
  dayPillarKo?: string;
};

export type ClassifyResult = DiaryAnalysis;

export function buildClassifyPrompt(input: ClassifyInput): string {
  const context = [
    input.date ? `Date: ${input.date}` : null,
    input.dayPillarKo ? `Day pillar (日柱): ${input.dayPillarKo}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const detailDims = DETAIL_SCORE_DIMENSIONS.map(
    (d) => `- ${d.id}: ${d.label} — ${d.description}`
  ).join("\n");

  return `Analyze the user's Korean diary and classify the emotional state.

Score each dimension as an integer from 0 to 100 (1-point increments allowed, e.g. 37, 62, 81).
Do NOT restrict scores to multiples of 25. Use the full 0–100 range for nuance.

Internal dimensions (include happiness_score for wellbeing calculation, but it is not shown as a detail score):
- happiness_score: joy, satisfaction, positive mood

Detail dimensions (also provide score_reasons for each):
${detailDims}

Important rules:
1. All scores must be integers 0–100 (1-point granularity).
2. If there is no evidence for relationship_score, return null for both score and reason.
3. Do not diagnose mental illness. This is diary-based emotional classification only.
4. Base every score only on diary content.
5. If strong positive and strong negative emotions coexist, use emotion_label = "mixed".
6. summary, reason, and every score_reasons value must be in Korean.
7. score_reasons: for each detail dimension, explain WHY that score was given, citing specific diary evidence (1–2 sentences).

Calculate daily_wellbeing_score:
positive_average = average of non-null: happiness_score, achievement_score, meaning_score, energy_score, relationship_score, gratitude_score, self_acceptance_score
negative_average = average of: depression_score, anxiety_score, stress_score
daily_wellbeing_score = round(positive_average * 0.6 + (100 - negative_average) * 0.4)

emotion_label: very_positive | positive | neutral | mixed | negative | very_negative

${context ? `Context:\n${context}\n` : ""}
Diary:
"""
${input.content.trim()}
"""

Return only valid JSON in this format:

{
  "happiness_score": number,
  "depression_score": number,
  "anxiety_score": number,
  "stress_score": number,
  "achievement_score": number,
  "meaning_score": number,
  "energy_score": number,
  "relationship_score": number | null,
  "gratitude_score": number,
  "self_acceptance_score": number,
  "daily_wellbeing_score": number,
  "emotion_label": string,
  "dominant_emotions": string[],
  "summary": string,
  "key_events": string[],
  "reason": string,
  "confidence": number,
  "score_reasons": {
    "depression_score": string,
    "anxiety_score": string,
    "stress_score": string,
    "achievement_score": string,
    "meaning_score": string,
    "energy_score": string,
    "relationship_score": string | null,
    "gratitude_score": string,
    "self_acceptance_score": string
  }
}`;
}

function parseScoreReasons(raw: unknown): ScoreReasons {
  const defaults = createEmptyScoreReasons();
  if (!raw || typeof raw !== "object") return defaults;

  const obj = raw as Record<string, unknown>;
  const result = { ...defaults };

  for (const dim of DETAIL_SCORE_DIMENSIONS) {
    const v = obj[dim.id];
    if (dim.id === "relationship_score") {
      result.relationship_score =
        v === null || v === undefined
          ? null
          : typeof v === "string"
            ? v.trim()
            : null;
    } else if (typeof v === "string") {
      result[dim.id as Exclude<DetailScoreDimensionId, "relationship_score">] = v.trim();
    }
  }

  return result;
}

export function parseClassifyResponse(raw: string): ClassifyResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 응답을 JSON으로 파싱할 수 없습니다.");
    parsed = JSON.parse(match[0]);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }

  const obj = parsed as Record<string, unknown>;

  const scores = {
    happiness_score: normalizeScoreValue(obj.happiness_score)!,
    depression_score: normalizeScoreValue(obj.depression_score)!,
    anxiety_score: normalizeScoreValue(obj.anxiety_score)!,
    stress_score: normalizeScoreValue(obj.stress_score)!,
    achievement_score: normalizeScoreValue(obj.achievement_score)!,
    meaning_score: normalizeScoreValue(obj.meaning_score)!,
    energy_score: normalizeScoreValue(obj.energy_score)!,
    relationship_score: normalizeScoreValue(obj.relationship_score, true),
    gratitude_score: normalizeScoreValue(obj.gratitude_score)!,
    self_acceptance_score: normalizeScoreValue(obj.self_acceptance_score)!,
  };

  const daily_wellbeing_score = computeDailyWellbeing(scores);

  const emotionLabelRaw = typeof obj.emotion_label === "string" ? obj.emotion_label : "neutral";
  const emotion_label: EmotionLabel = isEmotionLabel(emotionLabelRaw)
    ? emotionLabelRaw
    : "neutral";

  const dominant_emotions = Array.isArray(obj.dominant_emotions)
    ? obj.dominant_emotions.filter((v): v is string => typeof v === "string")
    : [];

  const key_events = Array.isArray(obj.key_events)
    ? obj.key_events.filter((v): v is string => typeof v === "string")
    : [];

  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const reason = typeof obj.reason === "string" ? obj.reason.trim() : "";

  if (!summary) throw new Error("AI 응답에 summary가 없습니다.");

  const confidence =
    typeof obj.confidence === "number"
      ? Math.max(0, Math.min(100, Math.round(obj.confidence)))
      : 70;

  return {
    ...scores,
    daily_wellbeing_score,
    emotion_label,
    dominant_emotions,
    summary,
    key_events,
    reason,
    confidence,
    score_reasons: parseScoreReasons(obj.score_reasons),
  };
}

export function buildClassifySystemPrompt(): string {
  const dims = DETAIL_SCORE_DIMENSIONS.map((d) => `- ${d.id}: ${d.label}`).join("\n");
  return `You are an expert at analyzing Korean diary entries for emotional state.
Detail score dimensions:
${dims}

Also compute happiness_score internally for wellbeing (not shown in detail UI).

Positive keys for wellbeing: ${POSITIVE_SCORE_KEYS.join(", ")}
Negative keys: ${NEGATIVE_SCORE_KEYS.join(", ")}

Scores: integers 0–100, 1-point steps. Always return valid JSON. Never diagnose mental illness.`;
}
