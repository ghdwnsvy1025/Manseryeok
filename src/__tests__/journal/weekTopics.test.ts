import { describe, expect, test } from "@jest/globals";
import {
  extractTopicsFromText,
  buildWeekTopicSummary,
} from "@/lib/journal/topics/weekTopics";
import { collectTopicExcerpts } from "@/lib/journal/topics/topicSupport";
import type { JournalEntry } from "@/lib/journal/types";

function stubEntry(
  date: string,
  content: string,
  opts?: {
    mainEventText?: string | null;
    happiness?: number;
    scores?: Array<{ code: string; score: number }>;
  }
): JournalEntry {
  const happiness = opts?.happiness ?? 5;
  return {
    id: `e-${date}`,
    userId: "u",
    sajuProfileId: "p",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content,
    overallSatisfaction: happiness as JournalEntry["overallSatisfaction"],
    happinessScore: happiness,
    moodLabel: null,
    moodLabels: [],
    mainEventText: opts?.mainEventText ?? null,
    source: "new_diary",
    scores: (opts?.scores ?? []).map((s) => ({
      id: `s-${date}-${s.code}`,
      entryId: `e-${date}`,
      userId: "u",
      categoryCode: s.code as JournalEntry["scores"][0]["categoryCode"],
      userScore: s.score as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      aiScore: null,
      finalScore: s.score,
      rawScore: s.score as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
      isNotApplicable: false,
      normalizedZ: null,
      normalizationVersion: null,
      createdAt: "",
      updatedAt: "",
    })),
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: null,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    createdAt: "",
    updatedAt: "",
  };
}

describe("week topics from diary text", () => {
  test("extracts boss relation from free text", () => {
    const hits = extractTopicsFromText(
      "오늘 팀장님이랑 회의가 길어서 힘들었다. 상사 눈치가 보였다."
    );
    expect(hits.some((h) => h.topicId === "boss_relation")).toBe(true);
    expect(hits.some((h) => h.topicId === "work_pressure")).toBe(true);
  });

  test("weekly summary elevates repeated topics across days", () => {
    const entries = [
      stubEntry("2026-07-25", "팀장이 또 지적했다."),
      stubEntry("2026-07-26", "상사와 잠깐 대화를 나눴다."),
      stubEntry("2026-07-27", "부장 피드백을 받았다."),
      stubEntry("2026-07-28", "친구랑 저녁을 먹었다."),
      stubEntry("2026-07-30", "월급이 들어왔다.", {
        mainEventText: "카드값 결제",
      }),
    ];
    const summary = buildWeekTopicSummary(entries, {
      asOf: "2026-07-31",
      windowDays: 7,
    });
    expect(summary.topics[0]?.topicId).toBe("boss_relation");
    expect(summary.topics[0]?.dayCount).toBe(3);
    expect(summary.plainLine).toContain("상사와의 관계");
  });

  test("home top 2 with support lines from state on topic days", () => {
    const entries = [
      stubEntry("2026-07-25", "팀장이 또 지적했다.", {
        happiness: 3,
        scores: [
          { code: "emotional_balance", score: 3 },
          { code: "energy", score: 4 },
          { code: "focus_execution", score: 5 },
          { code: "physical_condition", score: 6 },
        ],
      }),
      stubEntry("2026-07-26", "상사와 잠깐 대화를 나눴다.", {
        happiness: 4,
        scores: [
          { code: "emotional_balance", score: 4 },
          { code: "energy", score: 5 },
          { code: "focus_execution", score: 5 },
          { code: "physical_condition", score: 6 },
        ],
      }),
      stubEntry("2026-07-28", "친구랑 저녁을 먹었다.", {
        happiness: 7,
        scores: [
          { code: "emotional_balance", score: 7 },
          { code: "energy", score: 7 },
          { code: "focus_execution", score: 6 },
          { code: "physical_condition", score: 7 },
        ],
      }),
    ];
    const summary = buildWeekTopicSummary(entries, {
      asOf: "2026-07-31",
      windowDays: 7,
      topN: 2,
      withSupport: true,
    });
    expect(summary.topics.length).toBeLessThanOrEqual(2);
    expect(summary.topics[0]?.supportLine).toBeTruthy();
    expect(summary.topics[0]?.state?.avgHappiness).toBeLessThan(5);
    expect(summary.topics[0]?.state?.sampleCount).toBe(2);
    // 홈 문구에는 수치를 넣지 않음
    expect(summary.topics[0]?.supportLine).not.toMatch(/\d+(\.\d+)?점/);
    expect(summary.topics[0]?.supportLine).toMatch(/,/);
  });

  test("collects one excerpt per occurrence day for support", () => {
    const entries = [
      stubEntry("2026-07-25", "친구랑 싸웠다. 마음이 복잡했다."),
      stubEntry("2026-07-26", "친구에게 메시지를 보냈다."),
      stubEntry("2026-07-28", "친구와 화해했다."),
    ];
    const summary = buildWeekTopicSummary(entries, {
      asOf: "2026-07-31",
      windowDays: 7,
      topN: 2,
      withSupport: true,
    });
    const friend = summary.topics.find((t) => t.topicId === "friend");
    expect(friend).toBeTruthy();
    const excerpts = collectTopicExcerpts(friend!, entries);
    expect(excerpts.length).toBe(friend!.dayCount);
    expect(excerpts.every((e) => e.text.length > 0)).toBe(true);
  });

  test("empty week has gentle plain line", () => {
    const summary = buildWeekTopicSummary([], { asOf: "2026-07-31" });
    expect(summary.topics).toHaveLength(0);
    expect(summary.entryDays).toBe(0);
    expect(summary.plainLine.length).toBeGreaterThan(5);
  });
});
