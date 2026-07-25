import { describe, expect, test } from "@jest/globals";
import { buildDailyInsightContext } from "@/lib/journal/insight/buildContext";
import {
  normalizeTenPointScore,
  scoreFortuneDomains,
} from "@/lib/journal/fortune/score";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

type Score10 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

function entry(date: string, level: number): JournalEntry {
  const codes: CategoryCode[] = [
    "emotional_balance",
    "energy",
    "recovery_sleep",
    "focus_execution",
  ];
  return {
    id: `e-${date}`,
    userId: "u",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "",
    overallSatisfaction: level as JournalEntry["overallSatisfaction"],
    happinessScore: level,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores: codes.map((code) => ({
      id: `s-${date}-${code}`,
      entryId: `e-${date}`,
      userId: "u",
      categoryCode: code,
      userScore: level as Score10,
      aiScore: null,
      finalScore: level,
      rawScore: level as Score10,
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

const ENABLED: CategoryCode[] = [
  "emotional_balance",
  "energy",
  "recovery_sleep",
  "focus_execution",
];

function overallAt(level: number) {
  const entries = [1, 2, 3].map((i) => entry(`2026-07-2${i}`, level));
  const ctx = buildDailyInsightContext({
    eventDate: "2026-07-25",
    entries,
    enabledCodes: ENABLED,
  });
  return scoreFortuneDomains(ctx).find((d) => d.domain === "overall")!;
}

describe("fortune score scale contract (F-1 fix)", () => {
  test("normalizeTenPointScore maps 1-10 to 0-1", () => {
    expect(normalizeTenPointScore(1)).toBeCloseTo(0.1, 5);
    expect(normalizeTenPointScore(5)).toBeCloseTo(0.5, 5);
    expect(normalizeTenPointScore(10)).toBe(1);
    expect(normalizeTenPointScore(0)).toBe(0);
  });

  test("overall fortune differentiates levels 1,2,5,10 without saturating at 1.0", () => {
    const s1 = overallAt(1);
    const s2 = overallAt(2);
    const s5 = overallAt(5);
    const s10 = overallAt(10);

    expect(s1.score).toBeGreaterThanOrEqual(0);
    expect(s1.score).toBeLessThanOrEqual(1);
    expect(s10.score).toBeLessThanOrEqual(1);

    expect(s2.score).toBeGreaterThanOrEqual(s1.score);
    expect(s5.score).toBeGreaterThan(s2.score);
    expect(s10.score).toBeGreaterThan(s5.score);

    expect(s1.score).toBeLessThan(0.85);
    expect(s2.score).toBeLessThan(0.9);
    expect(s5.score).toBeLessThan(1);
    expect([s1, s2, s5].every((d) => d.score === 1)).toBe(false);

    expect(s1.tone).toBe("caution");
    expect(s5.tone).toBe("balanced");
    expect(s10.tone).toBe("supportive");
  });

  test("caution copy focuses on recovery pacing, not disaster prophecy", () => {
    const s1 = overallAt(1);
    const blob = `${s1.headline} ${s1.summary} ${s1.caution} ${s1.action}`;
    expect(blob.includes("accident")).toBe(false);
    expect(blob.length).toBeGreaterThan(10);
    expect(s1.tone).toBe("caution");
  });

  // ?? ??: ??? ?? ??? "??? ? ??"? ?????
  // ??? ???? ???. ?? ??? ??? ??? ????.
  test("keyword salience from deficit signals does not inflate the score", () => {
    const s1 = overallAt(1);
    const s10 = overallAt(10);
    expect(s10.score).toBeGreaterThan(s1.score);
    // ??(1?) ???? ???? ??(0.5)? ???? ? ??
    expect(s1.score).toBeLessThan(0.5);
  });

  test("scores stay monotonic across the whole 1..10 range", () => {
    const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (lv) => overallAt(lv).score
    );
    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});
