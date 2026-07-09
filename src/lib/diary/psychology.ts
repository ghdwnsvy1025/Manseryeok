// ============================================================
// 심리학 이론 기반 일기 분석 타입 (PANAS, Circumplex, PERMA, SDT, Appraisal)
// ============================================================

export type ScoredEvidence = {
  score: number;
  evidence: string;
  confidence: number;
};

export type PANASAnalysis = {
  positive_affect: ScoredEvidence;
  negative_affect: ScoredEvidence;
};

export type CircumplexAnalysis = {
  valence: ScoredEvidence;
  arousal: ScoredEvidence;
};

export type PERMAAnalysis = {
  positive_emotion: ScoredEvidence;
  engagement: ScoredEvidence;
  relationships: ScoredEvidence;
  meaning: ScoredEvidence;
  accomplishment: ScoredEvidence;
};

export type SDTAnalysis = {
  autonomy: ScoredEvidence;
  competence: ScoredEvidence;
  relatedness: ScoredEvidence;
};

export type AppraisalDimension = {
  analysis: string;
  confidence: number;
};

export type AppraisalAnalysis = {
  key_event: string;
  goal_relevance: AppraisalDimension;
  expectation_match: AppraisalDimension;
  control_perception: AppraisalDimension;
  responsibility: AppraisalDimension;
  coping_potential: AppraisalDimension;
};

export type PsychologicalAnalysis = {
  panas: PANASAnalysis;
  circumplex: CircumplexAnalysis;
  perma: PERMAAnalysis;
  sdt: SDTAnalysis;
  appraisal: AppraisalAnalysis;
  recovery_suggestions: string[];
  comprehensive_wellbeing_reason: string;
};

export const PANAS_LABELS: Record<keyof PANASAnalysis, string> = {
  positive_affect: "긍정 정서 (PA)",
  negative_affect: "부정 정서 (NA)",
};

export const CIRCUMPLEX_LABELS: Record<keyof CircumplexAnalysis, string> = {
  valence: "쾌-불쾌 (Valence)",
  arousal: "각성도 (Arousal)",
};

export const PERMA_LABELS: Record<keyof PERMAAnalysis, string> = {
  positive_emotion: "Positive Emotion",
  engagement: "Engagement",
  relationships: "Relationships",
  meaning: "Meaning",
  accomplishment: "Accomplishment",
};

export const PERMA_LABELS_KO: Record<keyof PERMAAnalysis, string> = {
  positive_emotion: "긍정 정서",
  engagement: "몰입",
  relationships: "관계",
  meaning: "의미",
  accomplishment: "성취",
};

export const SDT_LABELS: Record<keyof SDTAnalysis, string> = {
  autonomy: "Autonomy (자율성)",
  competence: "Competence (유능감)",
  relatedness: "Relatedness (관계성)",
};

export const APPRAISAL_LABELS: Record<
  keyof Omit<AppraisalAnalysis, "key_event">,
  string
> = {
  goal_relevance: "목표 연관",
  expectation_match: "기대 일치",
  control_perception: "통제감",
  responsibility: "책임감",
  coping_potential: "대처 가능성",
};

export function clampScore0to10(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value)));
}

export function clampValence(value: number): number {
  return Math.max(-5, Math.min(5, Math.round(value)));
}

export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function parseScoredEvidence(
  raw: unknown,
  scoreParser: (n: number) => number = clampScore0to10
): ScoredEvidence {
  if (!raw || typeof raw !== "object") {
    return { score: 0, evidence: "", confidence: 0 };
  }
  const obj = raw as Record<string, unknown>;
  const score =
    typeof obj.score === "number" && !Number.isNaN(obj.score)
      ? scoreParser(obj.score)
      : 0;
  const evidence = typeof obj.evidence === "string" ? obj.evidence.trim() : "";
  const confidence =
    typeof obj.confidence === "number" && !Number.isNaN(obj.confidence)
      ? clampConfidence(obj.confidence)
      : 50;
  return { score, evidence, confidence };
}

export function parseAppraisalDimension(raw: unknown): AppraisalDimension {
  if (!raw || typeof raw !== "object") {
    return { analysis: "", confidence: 0 };
  }
  const obj = raw as Record<string, unknown>;
  return {
    analysis: typeof obj.analysis === "string" ? obj.analysis.trim() : "",
    confidence:
      typeof obj.confidence === "number" && !Number.isNaN(obj.confidence)
        ? clampConfidence(obj.confidence)
        : 50,
  };
}

function parseScoredGroup<T extends Record<string, ScoredEvidence>>(
  raw: unknown,
  keys: (keyof T)[],
  scoreParsers?: Partial<Record<keyof T, (n: number) => number>>
): T {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const result = {} as T;
  for (const key of keys) {
    const parser = scoreParsers?.[key] ?? clampScore0to10;
    result[key] = parseScoredEvidence(obj[key as string], parser) as T[keyof T];
  }
  return result;
}

export function parsePsychologicalAnalysis(raw: unknown): PsychologicalAnalysis | null {
  if (!raw || typeof raw !== "object") return null;

  const obj = raw as Record<string, unknown>;

  const panas = parseScoredGroup<PANASAnalysis>(obj.panas, [
    "positive_affect",
    "negative_affect",
  ]);

  const circumplex = parseScoredGroup<CircumplexAnalysis>(
    obj.circumplex,
    ["valence", "arousal"],
    { valence: clampValence, arousal: clampScore0to10 }
  );

  const perma = parseScoredGroup<PERMAAnalysis>(obj.perma, [
    "positive_emotion",
    "engagement",
    "relationships",
    "meaning",
    "accomplishment",
  ]);

  const sdt = parseScoredGroup<SDTAnalysis>(obj.sdt, [
    "autonomy",
    "competence",
    "relatedness",
  ]);

  const appraisalRaw =
    obj.appraisal && typeof obj.appraisal === "object"
      ? (obj.appraisal as Record<string, unknown>)
      : {};

  const appraisal: AppraisalAnalysis = {
    key_event:
      typeof appraisalRaw.key_event === "string" ? appraisalRaw.key_event.trim() : "",
    goal_relevance: parseAppraisalDimension(appraisalRaw.goal_relevance),
    expectation_match: parseAppraisalDimension(appraisalRaw.expectation_match),
    control_perception: parseAppraisalDimension(appraisalRaw.control_perception),
    responsibility: parseAppraisalDimension(appraisalRaw.responsibility),
    coping_potential: parseAppraisalDimension(appraisalRaw.coping_potential),
  };

  const recovery_suggestions = Array.isArray(obj.recovery_suggestions)
    ? obj.recovery_suggestions.filter((v): v is string => typeof v === "string")
    : [];

  const comprehensive_wellbeing_reason =
    typeof obj.comprehensive_wellbeing_reason === "string"
      ? obj.comprehensive_wellbeing_reason.trim()
      : "";

  return {
    panas,
    circumplex,
    perma,
    sdt,
    appraisal,
    recovery_suggestions,
    comprehensive_wellbeing_reason,
  };
}

/** 이론 기반 점수로 종합 행복 점수(0–100) 계산 */
export function computeComprehensiveWellbeing(analysis: PsychologicalAnalysis): number {
  const permaScores = Object.values(analysis.perma).map((s) => s.score);
  const sdtScores = Object.values(analysis.sdt).map((s) => s.score);
  const permaAvg = permaScores.reduce((a, b) => a + b, 0) / permaScores.length;
  const sdtAvg = sdtScores.reduce((a, b) => a + b, 0) / sdtScores.length;

  const valenceNorm = ((analysis.circumplex.valence.score + 5) / 10) * 100;
  const panasPositive = analysis.panas.positive_affect.score * 10;
  const panasNegativeAdj = (10 - analysis.panas.negative_affect.score) * 10;

  return Math.round(
    permaAvg * 10 * 0.3 +
      sdtAvg * 10 * 0.2 +
      valenceNorm * 0.2 +
      panasPositive * 0.15 +
      panasNegativeAdj * 0.15
  );
}
