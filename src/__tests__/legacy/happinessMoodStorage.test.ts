/**
 * Phase 1 Legacy 회귀: 행복도·기분(감정) 저장 필드 생성·정규화·조회 형태 보존
 */
import { describe, expect, test } from "@jest/globals";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { normalizeDiaryEntry } from "@/lib/diary/migrate";
import {
  happinessRatingToScore,
  scoreToHappinessRating,
} from "@/lib/diary/happiness";
import { DIARY_SCHEMA_VERSION } from "@/lib/diary/types";

describe("Legacy 행복도·기분 저장/조회 회귀", () => {
  test("createDiaryEntry가 happiness·emotions·tags를 보존한다", () => {
    const entry = createDiaryEntry("2026-07-20", "오늘 메모", {
      happinessRating: 4,
      happinessSource: "selected",
      emotions: ["기쁨", "설렘"],
      tags: ["성취"],
      energyRating: 3,
      conditionRating: 4,
      primaryArea: "일",
    });

    expect(entry.happinessRating).toBe(4);
    expect(entry.happinessSource).toBe("selected");
    expect(entry.emotions).toEqual(["기쁨", "설렘"]);
    expect(entry.tags).toEqual(["성취"]);
    expect(entry.energyRating).toBe(3);
    expect(entry.conditionRating).toBe(4);
    expect(entry.primaryArea).toBe("일");
    expect(entry.schemaVersion).toBe(DIARY_SCHEMA_VERSION);
    expect(entry.dayPillar.ganjiKo).toBeTruthy();
    expect(entry.heavenlyStem).toBeTruthy();
    expect(entry.earthlyBranch).toBeTruthy();
  });

  test("정규화 round-trip: 저장 형태 → normalize → 동일 핵심 필드", () => {
    const created = createDiaryEntry("2026-07-19", "본문", {
      happinessRating: 2,
      emotions: ["불안"],
      tags: ["걱정"],
      focusRating: 3,
    });
    const reloaded = normalizeDiaryEntry(
      JSON.parse(JSON.stringify(created)) as Record<string, unknown>
    );

    expect(reloaded.happinessRating).toBe(2);
    expect(reloaded.emotions).toEqual(["불안"]);
    expect(reloaded.tags).toEqual(["걱정"]);
    expect(reloaded.focusRating).toBe(3);
    expect(reloaded.date).toBe("2026-07-19");
    expect(reloaded.dayPillar.ganjiKo).toBe(created.dayPillar.ganjiKo);
  });

  test("행복도 1–10 ↔ 점수 변환", () => {
    expect(happinessRatingToScore(1)).toBe(0);
    expect(happinessRatingToScore(10)).toBe(100);
    expect(scoreToHappinessRating(75)).toBe(8);
  });

  test("구버전: happiness 없이 wellbeing 점수만 있어도 행복도 복원", () => {
    const raw = {
      id: "legacy-mood-1",
      date: "2024-03-01",
      content: "피곤한 하루",
      dayPillar: {
        ganji: "甲子",
        ganjiKo: "갑자",
        ganjiIndex: 0,
        stem: { hanja: "甲", ko: "갑" },
        branch: { hanja: "子", ko: "자" },
      },
      analysis: {
        emotion_label: "negative",
        happiness_score: 25,
        daily_wellbeing_score: 25,
        depression_score: 40,
        anxiety_score: 40,
        stress_score: 40,
        achievement_score: 40,
        meaning_score: 40,
        energy_score: 40,
        relationship_score: null,
        gratitude_score: 40,
        self_acceptance_score: 40,
        dominant_emotions: [],
        summary: "지침",
        key_events: [],
        reason: "",
        confidence: 0.5,
        score_reasons: {},
        psychological_analysis: null,
      },
      createdAt: "2024-03-01T00:00:00.000Z",
      updatedAt: "2024-03-01T00:00:00.000Z",
    };

    const normalized = normalizeDiaryEntry(raw as Record<string, unknown>);
    expect(normalized.happinessRating).toBe(3);
    expect(normalized.emotions.length).toBeGreaterThan(0);
  });
});
