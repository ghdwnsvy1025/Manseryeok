import { describe, expect, test } from "@jest/globals";
import {
  assessRecall,
  recallLagDays,
  recallConfidenceFromLag,
  summarizeRecall,
  MIN_STATS_RECALL_CONFIDENCE,
  RECALL_CONFIDENCE_FLOOR,
  RECALL_CONFIDENCE_VERSION,
} from "@/lib/journal/recallConfidence";
import { buildDayPillarHierarchy } from "@/lib/journal/stats/dayPillarHierarchy";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

describe("recall lag", () => {
  test("same-day evening entry is lag 0, not lag 1", () => {
    expect(recallLagDays("2026-07-25", "2026-07-25T23:30:00Z")).toBe(0);
  });

  test("next-morning entry is lag 1", () => {
    expect(recallLagDays("2026-07-25", "2026-07-26T07:00:00Z")).toBe(1);
  });

  test("backfilled three weeks later", () => {
    expect(recallLagDays("2026-07-01", "2026-07-22T10:00:00Z")).toBe(21);
  });

  test("missing or malformed timestamps default to no lag", () => {
    expect(recallLagDays("2026-07-25", null)).toBe(0);
    expect(recallLagDays("2026-07-25", undefined)).toBe(0);
    expect(recallLagDays("2026-07-25", "not-a-date")).toBe(0);
    expect(recallLagDays("bad-date", "2026-07-25T00:00:00Z")).toBe(0);
  });

  test("recording ahead of the entry date clamps to zero", () => {
    expect(recallLagDays("2026-07-25", "2026-07-20T00:00:00Z")).toBe(0);
  });
});

describe("recall confidence curve", () => {
  test("same day and next day are treated as fresh", () => {
    expect(recallConfidenceFromLag(0)).toBe(1);
    expect(recallConfidenceFromLag(1)).toBe(1);
  });

  test("confidence decays monotonically after the grace period", () => {
    let prev = 1.1;
    for (const lag of [1, 2, 3, 5, 7, 14, 30, 90]) {
      const c = recallConfidenceFromLag(lag);
      expect(c).toBeLessThanOrEqual(prev);
      prev = c;
    }
  });

  test("confidence never falls below the floor", () => {
    expect(recallConfidenceFromLag(3650)).toBeGreaterThanOrEqual(
      RECALL_CONFIDENCE_FLOOR
    );
  });

  test("tiers and stats usability", () => {
    expect(assessRecall("2026-07-25", "2026-07-25T09:00:00Z").tier).toBe(
      "same_day"
    );
    expect(assessRecall("2026-07-25", "2026-07-26T09:00:00Z").tier).toBe(
      "next_day"
    );
    expect(assessRecall("2026-07-25", "2026-07-29T09:00:00Z").tier).toBe(
      "recent_recall"
    );
    expect(assessRecall("2026-07-01", "2026-07-25T09:00:00Z").tier).toBe(
      "distant_recall"
    );

    expect(assessRecall("2026-07-25", "2026-07-25T09:00:00Z").usableForStats).toBe(
      true
    );
    // 3주 뒤 몰아 쓴 기록은 통계에서 빠진다
    const distant = assessRecall("2026-07-01", "2026-07-22T09:00:00Z");
    expect(distant.confidence).toBeLessThan(MIN_STATS_RECALL_CONFIDENCE);
    expect(distant.usableForStats).toBe(false);
    expect(distant.version).toBe(RECALL_CONFIDENCE_VERSION);
  });
});

describe("recall summary", () => {
  test("counts tiers and excluded rows", () => {
    const s = summarizeRecall([
      { entryDate: "2026-07-25", firstRecordedAt: "2026-07-25T10:00:00Z" },
      { entryDate: "2026-07-24", firstRecordedAt: "2026-07-25T10:00:00Z" },
      { entryDate: "2026-07-01", firstRecordedAt: "2026-07-25T10:00:00Z" },
    ]);
    expect(s.total).toBe(3);
    expect(s.byTier.same_day).toBe(1);
    expect(s.byTier.next_day).toBe(1);
    expect(s.byTier.distant_recall).toBe(1);
    expect(s.excluded).toBe(1);
    expect(s.usable).toBe(2);
    expect(s.averageConfidence).toBe(1);
  });

  test("empty input is safe", () => {
    const s = summarizeRecall([]);
    expect(s.total).toBe(0);
    expect(s.averageConfidence).toBe(0);
  });
});

const CATEGORY: CategoryCode = "energy";

function entry(
  date: string,
  value: number,
  firstRecordedAt: string
): JournalEntry {
  return {
    id: `e-${date}`,
    userId: "u",
    sajuProfileId: "p1",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: "",
    overallSatisfaction: null,
    happinessScore: null,
    moodLabel: null,
    moodLabels: [],
    mainEventText: null,
    source: "new_diary",
    scores: [
      {
        id: `s-${date}`,
        entryId: `e-${date}`,
        userId: "u",
        categoryCode: CATEGORY,
        userScore: null,
        aiScore: null,
        finalScore: value,
        rawScore: null,
        isNotApplicable: false,
        normalizedZ: null,
        normalizationVersion: null,
        createdAt: "",
        updatedAt: "",
      },
    ],
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: null,
    xpGranted: true,
    xpAwarded: 10,
    schemaVersion: 4,
    firstRecordedAt,
    createdAt: firstRecordedAt,
    updatedAt: `${date}T00:00:00Z`,
  };
}

function dates(n: number, startIso = "2026-01-01"): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    out.push(
      new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10)
    );
  }
  return out;
}

describe("recall filtering in day pillar statistics", () => {
  test("same-day records are all kept", () => {
    const entries = dates(40).map((d) => entry(d, 5, `${d}T20:00:00Z`));
    const h = buildDayPillarHierarchy(entries, CATEGORY);
    expect(h.totalObservations).toBe(40);
    expect(h.excludedByRecall).toBe(0);
  });

  test("bulk backfill is excluded from the statistics", () => {
    // 40일치를 마지막 날 하루에 몰아서 입력
    const ds = dates(40);
    const entries = ds.map((d) => entry(d, 5, "2026-02-20T10:00:00Z"));
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    expect(h.excludedByRecall).toBeGreaterThan(30);
    expect(h.totalObservations).toBeLessThan(10);
    expect(h.sufficient).toBe(false);
  });

  test("legacy entries without firstRecordedAt fall back to createdAt", () => {
    const entries = dates(30).map((d) => {
      const e = entry(d, 5, `${d}T20:00:00Z`);
      delete (e as { firstRecordedAt?: string | null }).firstRecordedAt;
      return e;
    });
    const h = buildDayPillarHierarchy(entries, CATEGORY);
    expect(h.excludedByRecall).toBe(0);
    expect(h.totalObservations).toBe(30);
  });
});
