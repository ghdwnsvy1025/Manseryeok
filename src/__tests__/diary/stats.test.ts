import { describe, expect, test } from "@jest/globals";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import { createEmptyScoreReasons } from "@/lib/diary/dimensions";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  aggregateByDayPillar,
  aggregateByGroup,
  getDaysUntilInsight,
  getGroupLabel,
  getOverallAvgWellbeing,
  getStatsForGroup,
  getStatsForPillar,
  getUniqueEntryDays,
  getWellbeingInsightCards,
  resolveMonthPillarKo,
  resolveYearPillarKo,
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
  analysis: DiaryAnalysis | null,
  overrides: Partial<DiaryEntry> = {}
): DiaryEntry {
  const pillars = getPillarsForDate(date);
  const stemKo = ganjiKo[0] ?? "?";
  const branchKo = ganjiKo[1] ?? "?";
  return {
    id: `id-${date}`,
    date,
    content: "test",
    dayPillar: {
      ...pillars.dayPillar,
      ganjiKo,
      stem: { ...pillars.dayPillar.stem, ko: stemKo },
      branch: { ...pillars.dayPillar.branch, ko: branchKo },
    },
    monthPillarKo: pillars.monthPillarKo,
    yearPillarKo: pillars.yearPillarKo,
    analysis,
    createdAt: date,
    updatedAt: date,
    ...overrides,
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

  test("getUniqueEntryDays는 서로 다른 날짜 수", () => {
    expect(getUniqueEntryDays(entries)).toBe(3);
  });

  test("getDaysUntilInsight는 7일 기준 남은 일수", () => {
    expect(getDaysUntilInsight(entries, 7)).toBe(4);
  });

  test("getWellbeingInsightCards는 2회 이상 기록 일주만", () => {
    const cards = getWellbeingInsightCards(entries, 3);
    expect(cards).toHaveLength(1);
    expect(cards[0].key).toBe("임오");
  });
});

describe("aggregateByGroup", () => {
  const entries: DiaryEntry[] = [
    makeEntry("2026-01-01", "임오", makeAnalysis({ daily_wellbeing_score: 80 })),
    makeEntry("2026-03-02", "임오", makeAnalysis({ daily_wellbeing_score: 60 })),
    makeEntry("2026-02-01", "갑자", makeAnalysis({ daily_wellbeing_score: 50 })),
  ];

  test("천간별 집계", () => {
    const stems = aggregateByGroup(entries, "stem");
    const imStem = stems.find((s) => s.key === "임");
    expect(imStem?.entryCount).toBe(2);
    expect(imStem?.label).toBe("임");
  });

  test("지지별 집계", () => {
    const branches = aggregateByGroup(entries, "branch");
    const oBranch = branches.find((s) => s.key === "오");
    expect(oBranch?.entryCount).toBe(2);
  });

  test("년운별 집계", () => {
    const years = aggregateByGroup(entries, "year");
    expect(years.length).toBeGreaterThan(0);
    expect(years[0].label).toMatch(/년$/);
  });

  test("월운별 집계", () => {
    const months = aggregateByGroup(entries, "month");
    expect(months.length).toBeGreaterThan(0);
    expect(months[0].label).toMatch(/월$/);
  });

  test("deltaFromOverall 계산", () => {
    const overall = getOverallAvgWellbeing(entries);
    const stats = getStatsForGroup("임오", "ganji", entries, overall);
    expect(stats.deltaFromOverall).toBe(stats.avgDailyWellbeing - overall);
  });

  test("기분 분포에는 사용자가 직접 선택한 기분만 포함", () => {
    const moodEntries = [
      makeEntry("2026-01-01", "임오", makeAnalysis({ emotion_label: "positive" }), {
        emotionSource: "selected",
      }),
      makeEntry("2026-03-02", "임오", makeAnalysis({ emotion_label: "negative" }), {
        emotionSource: "inferred",
      }),
      makeEntry("2026-04-01", "임오", makeAnalysis({ emotion_label: "mixed" }), {
        emotionSource: "ai",
      }),
    ];

    const stats = getStatsForGroup("임오", "ganji", moodEntries);
    expect(stats.explicitMoodCount).toBe(1);
    expect(stats.moodCounts).toEqual({ positive: 1 });
  });
});

describe("resolveYearPillarKo", () => {
  test("저장된 값 우선", () => {
    const entry = makeEntry("2026-01-01", "임오", null, { yearPillarKo: "병오" });
    expect(resolveYearPillarKo(entry)).toBe("병오");
  });

  test("없으면 날짜로 재계산", () => {
    const entry = makeEntry("2026-01-01", "임오", null, { yearPillarKo: undefined });
    expect(resolveYearPillarKo(entry)).toBe(getPillarsForDate("2026-01-01").yearPillarKo);
    expect(resolveMonthPillarKo(entry)).toBe(getPillarsForDate("2026-01-01").monthPillarKo);
  });
});

describe("getGroupLabel", () => {
  test("그룹 타입별 라벨", () => {
    expect(getGroupLabel("병오", "year")).toBe("병오년");
    expect(getGroupLabel("갑인", "month")).toBe("갑인월");
    expect(getGroupLabel("임오", "ganji")).toBe("임오일");
    expect(getGroupLabel("임", "stem")).toBe("임");
  });
});
