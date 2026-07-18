import { describe, expect, test } from "@jest/globals";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { normalizeDiaryEntry } from "@/lib/diary/migrate";

describe("normalizeDiaryEntry", () => {
  test("0–100 행복도를 1–5로 역산하고 분석 점수는 유지", () => {
    const raw = {
      id: "e1",
      date: "2024-06-15",
      content: "테스트",
      dayPillar: {
        ganji: "甲子",
        ganjiKo: "갑자",
        ganjiIndex: 0,
        stem: { hanja: "甲", ko: "갑" },
        branch: { hanja: "子", ko: "자" },
      },
      analysis: {
        emotion_label: "positive",
        happiness_score: 100,
        daily_wellbeing_score: 100,
        pleasure: 80,
        engagement: 80,
        relationships: 80,
        meaning: 80,
        accomplishment: 80,
        autonomy: 80,
        competence: 80,
        relatedness: 80,
        dominant_emotions: ["기쁨"],
        summary: "좋음",
        score_reasons: {},
        psychological_analysis: null,
      },
      createdAt: "2024-06-15T00:00:00.000Z",
      updatedAt: "2024-06-15T00:00:00.000Z",
    };

    const normalized = normalizeDiaryEntry(raw);
    expect(normalized.happinessRating).toBe(5);
    expect(normalized.analysis?.daily_wellbeing_score).toBe(100);
    expect(normalized.schemaVersion).toBe(2);
  });

  test("구버전 단일 감정 라벨을 emotions로 승격", () => {
    const raw = {
      id: "e2",
      date: "2024-01-02",
      content: "피곤",
      dayPillar: {
        ganji: "乙丑",
        ganjiKo: "을축",
        ganjiIndex: 1,
        stem: { hanja: "乙", ko: "을" },
        branch: { hanja: "丑", ko: "축" },
      },
      analysis: {
        emotion_label: "negative",
        happiness_score: 30,
        daily_wellbeing_score: 30,
        pleasure: 30,
        engagement: 30,
        relationships: 30,
        meaning: 30,
        accomplishment: 30,
        autonomy: 30,
        competence: 30,
        relatedness: 30,
        dominant_emotions: [],
        summary: "힘듦",
        score_reasons: {},
        psychological_analysis: null,
      },
      createdAt: "2024-01-02T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
    };

    const normalized = normalizeDiaryEntry(raw);
    expect(normalized.happinessRating).toBe(2);
    expect(normalized.emotions?.length).toBeGreaterThan(0);
    expect(typeof normalized.weekday).toBe("number");
    expect(typeof normalized.isWeekend).toBe("boolean");
    expect(normalized.heavenlyStem).toBeTruthy();
    expect(normalized.earthlyBranch).toBeTruthy();
  });

  test("createDiaryEntry는 새 스키마 필드를 채운다", () => {
    const entry = createDiaryEntry("2024-07-18", "메모", {
      happinessRating: 4,
      emotions: ["기쁨"],
      tags: ["일"],
    });
    expect(entry.schemaVersion).toBe(2);
    expect(entry.happinessRating).toBe(4);
    expect(entry.emotions).toEqual(["기쁨"]);
    expect(entry.tags).toEqual(["일"]);
    expect(entry.weekday).toBeDefined();
    expect(entry.heavenlyStem).toBeTruthy();
  });
});
