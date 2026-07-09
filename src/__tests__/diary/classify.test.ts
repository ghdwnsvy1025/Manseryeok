import { describe, expect, test } from "@jest/globals";
import {
  clampScore,
  computeDailyWellbeing,
  normalizeScoreValue,
} from "@/lib/diary/dimensions";
import { parseClassifyResponse } from "@/lib/diary/classify";
import {
  clampScore0to10,
  clampValence,
  computeComprehensiveWellbeing,
  parsePsychologicalAnalysis,
  type PsychologicalAnalysis,
} from "@/lib/diary/psychology";

const samplePsychologicalAnalysis: PsychologicalAnalysis = {
  panas: {
    positive_affect: { score: 7, evidence: "회의 피드백에 기뻤다고 적음", confidence: 85 },
    negative_affect: { score: 3, evidence: "내일 발표가 걱정된다고 언급", confidence: 70 },
  },
  circumplex: {
    valence: { score: 3, evidence: "전반적으로 긍정적 하루", confidence: 80 },
    arousal: { score: 6, evidence: "운동 후 활력이 넘친다고 표현", confidence: 75 },
  },
  perma: {
    positive_emotion: { score: 7, evidence: "기분이 좋았다", confidence: 85 },
    engagement: { score: 6, evidence: "업무에 집중했다", confidence: 70 },
    relationships: { score: 5, evidence: "동료와 협업", confidence: 65 },
    meaning: { score: 6, evidence: "하는 일에 의미를 느낌", confidence: 75 },
    accomplishment: { score: 8, evidence: "좋은 피드백을 받음", confidence: 90 },
  },
  sdt: {
    autonomy: { score: 6, evidence: "스스로 일정을 조율", confidence: 70 },
    competence: { score: 8, evidence: "업무 성과에 자신감", confidence: 85 },
    relatedness: { score: 5, evidence: "동료와 소통", confidence: 65 },
  },
  appraisal: {
    key_event: "회의에서 긍정적 피드백을 받음",
    goal_relevance: { analysis: "업무 목표 달성에 도움이 됨", confidence: 80 },
    expectation_match: { analysis: "기대 이상의 결과", confidence: 85 },
    control_perception: { analysis: "노력이 인정받아 통제감 상승", confidence: 75 },
    responsibility: { analysis: "자신의 기여를 인정", confidence: 70 },
    coping_potential: { analysis: "내일 발표도 대처 가능하다고 느낌", confidence: 65 },
  },
  recovery_suggestions: ["충분한 수면 취하기", "발표 전 호흡 연습", "오늘의 성취 기록하기"],
  comprehensive_wellbeing_reason: "PERMA 성취·긍정 정서가 높고 부정 정서는 낮아 전반적 웰빙이 양호합니다.",
};

describe("clampScore", () => {
  test("0~100 정수로 clamp (1점 단위)", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(37.4)).toBe(37);
    expect(clampScore(72.6)).toBe(73);
    expect(clampScore(150)).toBe(100);
  });
});

describe("normalizeScoreValue", () => {
  test("relationship_score null 허용", () => {
    expect(normalizeScoreValue(null, true)).toBeNull();
    expect(normalizeScoreValue(undefined, true)).toBeNull();
  });

  test("1점 단위 유지", () => {
    expect(normalizeScoreValue(63)).toBe(63);
    expect(normalizeScoreValue(62.7)).toBe(63);
  });
});

describe("computeDailyWellbeing", () => {
  test("공식: positive*0.6 + (100-negative)*0.4", () => {
    const scores = {
      happiness_score: 75,
      depression_score: 25,
      anxiety_score: 25,
      stress_score: 25,
      achievement_score: 75,
      meaning_score: 50,
      energy_score: 75,
      relationship_score: null,
      gratitude_score: 50,
      self_acceptance_score: 50,
    };
    const positiveAvg = (75 + 75 + 50 + 75 + 50 + 50) / 6;
    const negativeAvg = (25 + 25 + 25) / 3;
    const expected = Math.round(positiveAvg * 0.6 + (100 - negativeAvg) * 0.4);
    expect(computeDailyWellbeing(scores)).toBe(expected);
  });
});

describe("psychology", () => {
  test("clampScore0to10 / clampValence", () => {
    expect(clampScore0to10(11)).toBe(10);
    expect(clampScore0to10(-2)).toBe(0);
    expect(clampValence(6)).toBe(5);
    expect(clampValence(-7)).toBe(-5);
  });

  test("computeComprehensiveWellbeing", () => {
    const score = computeComprehensiveWellbeing(samplePsychologicalAnalysis);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("parsePsychologicalAnalysis", () => {
    const parsed = parsePsychologicalAnalysis(samplePsychologicalAnalysis);
    expect(parsed?.panas.positive_affect.score).toBe(7);
    expect(parsed?.circumplex.valence.score).toBe(3);
    expect(parsed?.recovery_suggestions).toHaveLength(3);
  });
});

describe("parseClassifyResponse", () => {
  const samplePayload = {
    happiness_score: 73,
    depression_score: 28,
    anxiety_score: 31,
    stress_score: 12,
    achievement_score: 78,
    meaning_score: 55,
    energy_score: 67,
    relationship_score: null,
    gratitude_score: 52,
    self_acceptance_score: 48,
    daily_wellbeing_score: 80,
    emotion_label: "positive",
    dominant_emotions: ["기쁨", "성취감"],
    summary: "성취감과 긍정적 피드백으로 기분이 좋은 하루",
    key_events: ["회의 피드백"],
    reason: "업무에서 긍정적 평가를 받아 기분이 좋았습니다.",
    confidence: 85,
    score_reasons: {
      depression_score: "특별한 우울한 정서 신호는 없었습니다.",
      anxiety_score: "내일 발표가 있어 약간 긴장했습니다.",
      stress_score: "업무량이 많지 않았습니다.",
      achievement_score: "회의에서 좋은 피드백을 받았습니다.",
      meaning_score: "하는 일에 의미를 느꼈습니다.",
      energy_score: "아침에 운동해서 활력이 넘쳤습니다.",
      relationship_score: null,
      gratitude_score: "동료의 도움에 감사했습니다.",
      self_acceptance_score: "스스로를 크게 비난하지 않았습니다.",
    },
    psychological_analysis: samplePsychologicalAnalysis,
  };

  test("유효한 JSON 파싱", () => {
    const result = parseClassifyResponse(JSON.stringify(samplePayload));
    expect(result.happiness_score).toBe(73);
    expect(result.energy_score).toBe(67);
    expect(result.relationship_score).toBeNull();
    expect(result.summary).toBe(samplePayload.summary);
    expect(result.score_reasons.energy_score).toContain("운동");
    expect(result.psychological_analysis?.panas.positive_affect.score).toBe(7);
    expect(result.daily_wellbeing_score).toBe(
      computeComprehensiveWellbeing(samplePsychologicalAnalysis)
    );
  });

  test("JSON 블록 추출", () => {
    const raw = `분석:\n${JSON.stringify(samplePayload)}`;
    const result = parseClassifyResponse(raw);
    expect(result.happiness_score).toBe(73);
  });

  test("psychological_analysis 없으면 기존 공식 사용", () => {
    const { psychological_analysis: _, daily_wellbeing_score: __, ...legacy } = samplePayload;
    const result = parseClassifyResponse(JSON.stringify(legacy));
    expect(result.psychological_analysis).toBeNull();
    expect(result.daily_wellbeing_score).toBe(computeDailyWellbeing(result));
  });
});
