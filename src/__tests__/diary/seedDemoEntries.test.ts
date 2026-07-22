import { describe, expect, test } from "@jest/globals";
import {
  buildRealTestSeedEntries,
  buildTwoMonthDemoEntries,
} from "@/lib/diary/seedDemoEntries";

describe("buildRealTestSeedEntries", () => {
  test("20일 user 출처 연속 기록을 만든다", () => {
    const entries = buildRealTestSeedEntries(
      20,
      new Date("2026-07-22T12:00:00")
    );
    expect(entries).toHaveLength(20);
    expect(entries.every((e) => e.dataOrigin === "user")).toBe(true);
    expect(entries[0]?.date).toBe("2026-07-03");
    expect(entries[19]?.date).toBe("2026-07-22");
    for (const entry of entries) {
      expect(entry.happinessRating).toBeGreaterThanOrEqual(1);
      expect(entry.happinessRating).toBeLessThanOrEqual(10);
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    }
  });
});

describe("buildTwoMonthDemoEntries", () => {
  test("약 2개월치 기록을 만들고 필드를 채운다", () => {
    const entries = buildTwoMonthDemoEntries(new Date("2026-07-19T12:00:00"));
    expect(entries.length).toBeGreaterThan(40);
    expect(entries.length).toBeLessThanOrEqual(60);
    for (const entry of entries) {
      expect(entry.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(entry.happinessRating).toBeGreaterThanOrEqual(1);
      expect(entry.happinessRating).toBeLessThanOrEqual(10);
      expect(entry.analysis?.daily_wellbeing_score).toBeDefined();
      expect(entry.dayPillar.ganjiKo).toBeTruthy();
    }
  });
});
