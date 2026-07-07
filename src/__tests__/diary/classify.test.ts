import { describe, expect, test } from "@jest/globals";
import {
  clampScore,
  computeDailyWellbeing,
  normalizeScoreValue,
} from "@/lib/diary/dimensions";
import { parseClassifyResponse } from "@/lib/diary/classify";

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
      depression_score: "특별한 우울 표현은 없었습니다.",
      anxiety_score: "내일 발표가 있어 약간 긴장했습니다.",
      stress_score: "업무량이 많지 않았습니다.",
      achievement_score: "회의에서 좋은 피드백을 받았습니다.",
      meaning_score: "하는 일에 의미를 느꼈습니다.",
      energy_score: "아침에 운동해서 활력이 넘쳤습니다.",
      relationship_score: null,
      gratitude_score: "동료의 도움에 감사했습니다.",
      self_acceptance_score: "스스로를 크게 비난하지 않았습니다.",
    },
  };

  test("유효한 JSON 파싱", () => {
    const result = parseClassifyResponse(JSON.stringify(samplePayload));
    expect(result.happiness_score).toBe(73);
    expect(result.energy_score).toBe(67);
    expect(result.relationship_score).toBeNull();
    expect(result.summary).toBe(samplePayload.summary);
    expect(result.score_reasons.energy_score).toContain("운동");
    expect(result.daily_wellbeing_score).toBe(computeDailyWellbeing(result));
  });

  test("JSON 블록 추출", () => {
    const raw = `분석:\n${JSON.stringify(samplePayload)}`;
    const result = parseClassifyResponse(raw);
    expect(result.happiness_score).toBe(73);
  });
});
