import { describe, expect, test } from "@jest/globals";
import { buildTwoMonthDemoEntries } from "@/lib/diary/seedDemoEntries";

describe("buildTwoMonthDemoEntries", () => {
  test("약 2개월치 기록을 만들고 필드를 채운다", () => {
    const entries = buildTwoMonthDemoEntries(new Date("2026-07-19T12:00:00"));
    expect(entries.length).toBeGreaterThan(40);
    expect(entries.length).toBeLessThanOrEqual(60);
    for (const entry of entries) {
      expect(entry.id.startsWith("demo-")).toBe(true);
      expect(entry.happinessRating).toBeGreaterThanOrEqual(1);
      expect(entry.happinessRating).toBeLessThanOrEqual(5);
      expect(entry.analysis?.daily_wellbeing_score).toBeDefined();
      expect(entry.dayPillar.ganjiKo).toBeTruthy();
    }
  });
});
