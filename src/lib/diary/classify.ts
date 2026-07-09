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
import {
  computeComprehensiveWellbeing,
  parsePsychologicalAnalysis,
} from "@/lib/diary/psychology";

export type ClassifyInput = {
  content: string;
  date?: string;
  dayPillarKo?: string;
};

export type ClassifyResult = DiaryAnalysis;

function scoredEvidenceSchema(scoreDesc: string): string {
  return `{ "score": ${scoreDesc}, "evidence": "일기 근거 문장 (한국어)", "confidence": 0-100 }`;
}

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

  return `한국어 일기를 심리학 이론 기반으로 분석하세요.

## 분석 틀

### 1. PANAS (0–10)
- positive_affect: 긍정 정서 (기쁨, 흥분, 활력 등)
- negative_affect: 부정 정서 (슬픔, 긴장, 짜증 등)

### 2. Russell Circumplex Model
- valence (쾌-불쾌): -5 ~ +5
- arousal (각성도): 0 ~ 10

### 3. PERMA (0–10)
- positive_emotion, engagement, relationships, meaning, accomplishment

### 4. Self-Determination Theory (0–10)
- autonomy, competence, relatedness

### 5. Appraisal Theory
오늘의 핵심 사건이 나의 목표, 기대, 통제감, 책임감, 대처 가능성과 어떻게 연결되었는지 분석

## 분석 규칙
1. 일기 내용에 직접 근거가 있는 경우만 점수를 매긴다.
2. 근거가 약하면 confidence를 낮게 표시한다 (0–100).
3. 우울, 불안 등은 진단하지 말고 '정서적 신호'로만 표현한다.
4. 각 점수마다 일기 속 근거 문장을 짧게 evidence에 제시한다.
5. summary, reason, evidence, analysis, recovery_suggestions, comprehensive_wellbeing_reason은 모두 한국어로 작성한다.
6. mental illness 진단 금지.

## 세부 감정 점수 (0–100, 1점 단위)
행복도 계산용 내부 차원 (UI 세부 점수에 미표시):
- happiness_score: 기쁨, 만족, 긍정적 기분

세부 차원 (score_reasons 필수):
${detailDims}

세부 점수 규칙:
- 정수 0–100 (1점 단위)
- relationship_score: 관계 언급 없으면 null
- depression/anxiety/stress는 '정서적 신호' 관점으로 평가 (진단 아님)
- score_reasons: 각 차원별 근거 1–2문장 (한국어)

emotion_label: very_positive | positive | neutral | mixed | negative | very_negative

종합 행복 점수(daily_wellbeing_score): PERMA·SDT·PANAS·Circumplex valence를 종합한 0–100 점수의 근거를 comprehensive_wellbeing_reason에 설명한다.

${context ? `Context:\n${context}\n` : ""}
Diary:
"""
${input.content.trim()}
"""

Return only valid JSON:

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
  "emotion_label": string,
  "dominant_emotions": string[],
  "summary": "핵심 감정 요약 (2–3문장)",
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
  },
  "psychological_analysis": {
    "panas": {
      "positive_affect": ${scoredEvidenceSchema("0-10")},
      "negative_affect": ${scoredEvidenceSchema("0-10")}
    },
    "circumplex": {
      "valence": ${scoredEvidenceSchema("-5 to +5")},
      "arousal": ${scoredEvidenceSchema("0-10")}
    },
    "perma": {
      "positive_emotion": ${scoredEvidenceSchema("0-10")},
      "engagement": ${scoredEvidenceSchema("0-10")},
      "relationships": ${scoredEvidenceSchema("0-10")},
      "meaning": ${scoredEvidenceSchema("0-10")},
      "accomplishment": ${scoredEvidenceSchema("0-10")}
    },
    "sdt": {
      "autonomy": ${scoredEvidenceSchema("0-10")},
      "competence": ${scoredEvidenceSchema("0-10")},
      "relatedness": ${scoredEvidenceSchema("0-10")}
    },
    "appraisal": {
      "key_event": "오늘의 핵심 사건 (한 문장)",
      "goal_relevance": { "analysis": "목표와의 연결 (한국어)", "confidence": 0-100 },
      "expectation_match": { "analysis": "기대와의 일치/불일치", "confidence": 0-100 },
      "control_perception": { "analysis": "통제감 평가", "confidence": 0-100 },
      "responsibility": { "analysis": "책임감 평가", "confidence": 0-100 },
      "coping_potential": { "analysis": "대처 가능성 평가", "confidence": 0-100 }
    },
    "recovery_suggestions": ["오늘 나에게 필요한 회복/행동 제안 1", "제안 2", "제안 3"],
    "comprehensive_wellbeing_reason": "종합 행복 점수 산정 이유 (2–3문장)"
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

  const psychological_analysis = parsePsychologicalAnalysis(obj.psychological_analysis);

  const daily_wellbeing_score = psychological_analysis
    ? computeComprehensiveWellbeing(psychological_analysis)
    : computeDailyWellbeing(scores);

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
    psychological_analysis,
  };
}

export function buildClassifySystemPrompt(): string {
  const dims = DETAIL_SCORE_DIMENSIONS.map((d) => `- ${d.id}: ${d.label}`).join("\n");
  return `You are an expert psychologist analyzing Korean diary entries using established psychological theories:
- PANAS (Positive and Negative Affect Schedule)
- Russell's Circumplex Model of Affect (valence × arousal)
- Seligman's PERMA model of wellbeing
- Self-Determination Theory (autonomy, competence, relatedness)
- Appraisal Theory (cognitive evaluation of events)

Detail emotion dimensions (0–100):
${dims}

Also compute happiness_score internally for legacy compatibility.

Positive keys: ${POSITIVE_SCORE_KEYS.join(", ")}
Negative keys (emotional signals only, NOT diagnoses): ${NEGATIVE_SCORE_KEYS.join(", ")}

Rules:
- Score only from diary evidence; low confidence when evidence is weak.
- Never diagnose mental illness; describe depression/anxiety/stress as emotional signals only.
- All user-facing text in Korean.
- Always return valid JSON with psychological_analysis object.`;
}
