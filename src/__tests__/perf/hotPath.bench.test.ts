/**
 * Gate C 16 — 핫패스 성능 스모크.
 * 100명×365 합성은 CI에 너무 무거워, 핵심 순수 함수의 상한을 고정한다.
 * 느려지면 회귀로 잡힌다.
 */
import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import { buildDayPillarHierarchy } from "@/lib/journal/stats/dayPillarHierarchy";
import { runSajuRuleEngine } from "@/lib/saju/rules";
import { rankCanonicalKeywords } from "@/lib/journal/keywords/rankCanonical";
import { computeBlendWeights } from "@/lib/journal/insight/dynamicWeights";
import type { JournalEntry } from "@/lib/journal/types";

function makeEntries(n: number): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2025, 0, 1 + i));
    const entryDate = d.toISOString().slice(0, 10);
    out.push({
      id: `e-${i}`,
      userId: "u-perf",
      sajuProfileId: "p-perf",
      entryDate,
      userTimezone: "Asia/Seoul",
      content: "",
      overallSatisfaction: ((5 + (i % 5)) as 5 | 6 | 7 | 8 | 9),
      happinessScore: ((5 + (i % 5)) as 5 | 6 | 7 | 8 | 9),
      moodLabel: null,
      moodLabels: [],
      mainEventText: null,
      source: "new_diary",
      scores: [
        {
          id: `s-${i}`,
          entryId: `e-${i}`,
          userId: "u-perf",
          categoryCode: "energy",
          userScore: ((4 + (i % 6)) as 4 | 5 | 6 | 7 | 8 | 9),
          aiScore: null,
          finalScore: ((4 + (i % 6)) as 4 | 5 | 6 | 7 | 8 | 9),
          rawScore: ((4 + (i % 6)) as 4 | 5 | 6 | 7 | 8 | 9),
          isNotApplicable: false,
          normalizedZ: null,
          normalizationVersion: null,
          createdAt: `${entryDate}T12:00:00Z`,
          updatedAt: `${entryDate}T12:00:00Z`,
        },
      ],
      tags: [],
      coreStates: null,
      domainScores: null,
      checkinVersion: 2,
      xpGranted: true,
      xpAwarded: 10,
      schemaVersion: 4,
      firstRecordedAt: `${entryDate}T12:00:00Z`,
      createdAt: `${entryDate}T12:00:00Z`,
      updatedAt: `${entryDate}T12:00:00Z`,
    });
  }
  return out;
}

function elapsedMs(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

describe("hot-path performance smoke", () => {
  // CI/Windows 편차 허용. O(n²) 회귀만 잡으면 된다.
  test("insight context for 90 days stays under 500ms", () => {
    const entries = makeEntries(90);
    const ms = elapsedMs(() => {
      buildDailyInsightContext({
        eventDate: "2025-04-01",
        entries,
        enabledCodes: ["energy", "emotional_balance", "focus_execution"],
      });
    });
    expect(ms).toBeLessThan(500);
  });

  test("day pillar hierarchy for 120 days stays under 400ms", () => {
    const entries = makeEntries(120);
    const ms = elapsedMs(() => {
      buildDayPillarHierarchy(entries, "energy");
    });
    expect(ms).toBeLessThan(400);
  });

  test("saju rule engine ×20 stays under 100ms", () => {
    const ms = elapsedMs(() => {
      for (let i = 0; i < 20; i++) {
        runSajuRuleEngine({
          year: { stem: "甲", branch: "子" },
          month: { stem: "乙", branch: "卯" },
          day: { stem: "丙", branch: "午" },
          hour: { stem: "丁", branch: "酉" },
        });
      }
    });
    expect(ms).toBeLessThan(100);
  });

  test("canonical rank + blend weights ×50 stays under 50ms", () => {
    const ms = elapsedMs(() => {
      for (let i = 0; i < 50; i++) {
        rankCanonicalKeywords({
          moods: ["지침", "불안"],
          lowCategories: ["energy"],
          tags: ["rest"],
        });
        computeBlendWeights({ totalXp: i * 40, onboardingCompleted: true });
      }
    });
    expect(ms).toBeLessThan(50);
  });
});
