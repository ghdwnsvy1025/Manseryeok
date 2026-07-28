import { describe, expect, test } from "@jest/globals";
import {
  buildCollectionMission,
  buildMonthCells,
  buildWeeklyReport,
  buildWeekSummaryInsight,
  computeRecordStreak,
  describeCharacterHappiness,
  aggregateHappinessByCharacters,
} from "@/lib/journal/statsInsight";
import type { JournalEntry } from "@/lib/journal/types";

function entry(
  date: string,
  happiness: number,
  scores: Array<{ code: string; score: number }> = []
): JournalEntry {
  return {
    id: `e-${date}`,
    entryDate: date,
    content: "",
    scores: scores.map((s) => ({
      categoryCode: s.code as JournalEntry["scores"][0]["categoryCode"],
      userScore: s.score,
      aiScore: null,
      finalScore: s.score,
      isNotApplicable: false,
    })),
    overallSatisfaction: happiness as JournalEntry["overallSatisfaction"],
    moodLabels: [],
    eventTags: [],
    checkinVersion: 2,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
    xpAwarded: 10,
    xpGranted: true,
  } as unknown as JournalEntry;
}

function daysBack(today: string, count: number, happiness: number): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(`${today}T12:00:00+09:00`);
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(entry(`${y}-${m}-${day}`, happiness));
  }
  return out;
}

describe("statsInsight", () => {
  test("buildMonthCells keeps 7 columns", () => {
    const cells = buildMonthCells(2024, 7);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((c) => c.date)).toHaveLength(31);
  });

  test("week summary compares last 7 vs previous 7", () => {
    const today = "2026-07-26";
    const entries: JournalEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(`2026-07-26T12:00:00+09:00`);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      entries.push(
        entry(`${y}-${m}-${day}`, 7, [
          { code: "energy", score: 8 },
          { code: "focus_execution", score: 7 },
          { code: "physical_condition", score: 7 },
          { code: "emotional_balance", score: 7 },
        ])
      );
    }
    for (let i = 7; i < 14; i++) {
      const d = new Date(`2026-07-26T12:00:00+09:00`);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      entries.push(
        entry(`${y}-${m}-${day}`, 5, [
          { code: "energy", score: 4 },
          { code: "focus_execution", score: 5 },
          { code: "physical_condition", score: 5 },
          { code: "emotional_balance", score: 5 },
        ])
      );
    }
    const insight = buildWeekSummaryInsight(entries, today);
    expect(insight.delta).toBe(2);
    expect(insight.headline).toContain("지난주보다");
    expect(insight.recordedToday).toBe(true);
  });

  test("cta when today missing", () => {
    const insight = buildWeekSummaryInsight([], "2026-07-26");
    expect(insight.cta?.label).toBe("오늘 기록하기");
    expect(insight.recordedToday).toBe(false);
  });

  test("collection mission uses today ganji", () => {
    const mission = buildCollectionMission([], "2026-07-26", [
      { ganjiKo: "갑진", status: "locked", entryCount: 0 },
    ]);
    expect(mission.title).toMatch(/오늘은 .+일/);
    expect(mission.ctaLabel).toBeTruthy();
  });

  test("character happiness aggregates stems", () => {
    const rows = aggregateHappinessByCharacters([
      entry("2026-07-26", 8),
      entry("2026-07-25", 6),
    ]);
    expect(rows.stems.some((s) => s.count > 0)).toBe(true);
    expect(rows.branches.some((s) => s.count > 0)).toBe(true);
  });

  test("character description needs 2+ records per key", () => {
    const rows = aggregateHappinessByCharacters([entry("2026-07-26", 8)]);
    const insight = describeCharacterHappiness(rows.stems);
    expect(insight.label).toBeNull();
    expect(insight.text).toContain("2회");
  });

  test("character description is compact deltas", () => {
    const insight = describeCharacterHappiness([
      {
        key: "을",
        average: 8,
        count: 2,
        deltaFromOverall: 1.2,
        element: "wood",
      },
      {
        key: "계",
        average: 4,
        count: 2,
        deltaFromOverall: -0.8,
        element: "water",
      },
    ]);
    expect(insight.label).toBe("평균 대비");
    expect(insight.text).toBe("을 +1.2 · 계 -0.8");
  });

  test("streak counts consecutive days ending today", () => {
    const streak = computeRecordStreak(daysBack("2026-07-26", 4, 7), "2026-07-26");
    expect(streak.current).toBe(4);
    expect(streak.longest).toBe(4);
    expect(streak.recordedToday).toBe(true);
  });

  test("streak keeps yesterday chain when today missing", () => {
    const entries = daysBack("2026-07-25", 3, 7);
    const streak = computeRecordStreak(entries, "2026-07-26");
    expect(streak.recordedToday).toBe(false);
    expect(streak.current).toBe(3);
  });

  test("weekly report spans monday to today", () => {
    // 2026-07-26 은 일요일 → 월요일은 2026-07-20
    const report = buildWeeklyReport(daysBack("2026-07-26", 3, 8), "2026-07-26");
    expect(report.from).toBe("2026-07-20");
    expect(report.to).toBe("2026-07-26");
    expect(report.totalDays).toBe(7);
    expect(report.days).toHaveLength(7);
    expect(report.recordedDays).toBe(3);
    expect(report.avg).toBe(8);
    expect(report.shareText).toContain("주간 기록 리포트");
  });

  test("weekly report handles empty week", () => {
    const report = buildWeeklyReport([], "2026-07-26");
    expect(report.recordedDays).toBe(0);
    expect(report.avg).toBeNull();
    expect(report.bestDay).toBeNull();
  });
});
