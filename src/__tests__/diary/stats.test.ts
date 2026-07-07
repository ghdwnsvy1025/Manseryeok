import { describe, expect, test } from "@jest/globals";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import { createEmptyScoreReasons } from "@/lib/diary/dimensions";
import {
  aggregateByDayPillar,
  getStatsForPillar,
} from "@/lib/diary/stats";
import type { DiaryEntry } from "@/lib/diary/types";

function makeAnalysis(overrides: Partial<DiaryAnalysis> = {}): DiaryAnalysis {
  const base: DiaryAnalysis = {
    happiness_score: 75,
    depression_score: 25,
    anxiety_score: 25,
    stress_score: 25,
    achievement_score: 50,
    meaning_score: 50,
    energy_score: 50,
    relationship_score: null,
    gratitude_score: 50,
    self_acceptance_score: 50,
    daily_wellbeing_score: 70,
    emotion_label: "positive",
    dominant_emotions: [],
    summary: "test",
    key_events: [],
    reason: "test",
    confidence: 80,
    score_reasons: createEmptyScoreReasons(),
  };
  return { ...base, ...overrides };
}

function makeEntry(
  date: string,
  ganjiKo: string,
  analysis: DiaryAnalysis | null
): DiaryEntry {
  return {
    id: `id-${date}`,
    date,
    content: "test",
    dayPillar: {
      ganji: "test",
      ganjiKo,
      ganjiIndex: 0,
      stem: { hanja: "甲", ko: "갑" },
      branch: { hanja: "子", ko: "자" },
    },
    analysis,
    createdAt: date,
    updatedAt: date,
  };
}

describe("getStatsForPillar", () => {
  const entries: DiaryEntry[] = [
    makeEntry("2026-01-01", "임오", makeAnalysis({ daily_wellbeing_score: 80, depression_score: 30 })),
    makeEntry("2026-03-02", "임오", makeAnalysis({ daily_wellbeing_score: 60, depression_score: 50 })),
    makeEntry("2026-02-01", "갑자", makeAnalysis({ daily_wellbeing_score: 50 })),
  ];

  test("임오일 통계 집계", () => {
    const stats = getStatsForPillar("임오", entries);
    expect(stats.entryCount).toBe(2);
    expect(stats.analyzedCount).toBe(2);
    expect(stats.dates).toEqual(["2026-01-01", "2026-03-02"]);
    expect(stats.avgDailyWellbeing).toBe(70);
    expect(stats.avgScores.depression_score).toBe(40);
  });

  test("aggregateByDayPillar는 기록 수 내림차순", () => {
    const all = aggregateByDayPillar(entries);
    expect(all[0].ganjiKo).toBe("임오");
    expect(all[0].entryCount).toBe(2);
  });
});
