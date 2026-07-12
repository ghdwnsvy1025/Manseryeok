import { describe, expect, test } from "@jest/globals";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  buildGanjiCollection,
  getCollectionSummary,
  getCollectedGanjiIndices,
} from "@/lib/diary/collection";
import { getNextSameGanjiDate } from "@/lib/diary/nextGanjiDay";
import { getSeason1Quests, getStreakDays } from "@/lib/diary/quests";
import { computeSaveCelebration } from "@/lib/diary/saveCelebration";
import { getTodayVibe } from "@/lib/diary/todayVibe";
import type { DiaryEntry } from "@/lib/diary/types";

function makeEntry(date: string, ganjiKo: string): DiaryEntry {
  const pillars = getPillarsForDate(date);
  return {
    id: `id-${date}`,
    date,
    content: "test",
    dayPillar: {
      ...pillars.dayPillar,
      ganjiKo,
      stem: { ...pillars.dayPillar.stem, ko: ganjiKo[0] },
      branch: { ...pillars.dayPillar.branch, ko: ganjiKo[1] ?? "자" },
    },
    monthPillarKo: pillars.monthPillarKo,
    yearPillarKo: pillars.yearPillarKo,
    analysis: {
      happiness_score: 70,
      depression_score: 30,
      anxiety_score: 30,
      stress_score: 30,
      achievement_score: 50,
      meaning_score: 50,
      energy_score: 50,
      relationship_score: null,
      gratitude_score: 50,
      self_acceptance_score: 50,
      daily_wellbeing_score: 72,
      emotion_label: "positive",
      dominant_emotions: [],
      summary: "test",
      key_events: [],
      reason: "test",
      confidence: 80,
      score_reasons: {
        depression_score: "",
        anxiety_score: "",
        stress_score: "",
        achievement_score: "",
        meaning_score: "",
        energy_score: "",
        relationship_score: null,
        gratitude_score: "",
        self_acceptance_score: "",
      },
    },
    createdAt: date,
    updatedAt: date,
  };
}

describe("collection", () => {
  test("수집 요약", () => {
    const entries = [
      makeEntry("2026-01-01", "임오"),
      makeEntry("2026-02-01", "갑자"),
    ];
    const summary = getCollectionSummary(entries);
    expect(summary.ganjiCollected).toBe(2);
    expect(summary.stemCollected).toBe(2);
  });

  test("도감 상태 pattern은 2회 이상", () => {
    const entries = [
      makeEntry("2026-01-01", "임오"),
      makeEntry("2026-03-02", "임오"),
    ];
    const collection = buildGanjiCollection(entries);
    const imo = collection.find((c) => c.ganjiKo === "임오");
    expect(imo?.status).toBe("pattern");
    expect(imo?.entryCount).toBe(2);
  });
});

describe("nextGanjiDay", () => {
  test("다음 같은 간지는 약 60일 후", () => {
    const entry = makeEntry("2026-01-01", "임오");
    const next = getNextSameGanjiDate("2026-01-01", entry.dayPillar.ganjiIndex);
    expect(next).not.toBeNull();
    expect(next!.daysUntil).toBeGreaterThan(50);
    expect(next!.daysUntil).toBeLessThanOrEqual(62);
  });
});

describe("quests", () => {
  test("시즌1 퀘스트 진행", () => {
    const entries = [
      makeEntry("2026-01-01", "임오"),
      makeEntry("2026-01-02", "갑자"),
    ];
    const season = getSeason1Quests(entries);
    expect(season.quests[0].completed).toBe(true);
    expect(season.completedCount).toBeGreaterThanOrEqual(1);
  });
});

describe("saveCelebration", () => {
  test("첫 기록 축하", () => {
    const saved = makeEntry("2026-01-01", "임오");
    const result = computeSaveCelebration([], saved);
    expect(result?.type).toBe("first_ever");
  });

  test("새 간지 축하", () => {
    const existing = [makeEntry("2026-01-01", "임오")];
    const saved = makeEntry("2026-02-01", "갑자");
    const result = computeSaveCelebration(existing, saved);
    expect(result?.type).toBe("new_ganji");
  });
});

describe("todayVibe", () => {
  test("생년 없으면 오행 조합", () => {
    const entry = makeEntry("2026-01-01", "임오");
    const vibe = getTodayVibe(entry.dayPillar, null);
    expect(vibe.headline).toContain("임오");
  });
});
