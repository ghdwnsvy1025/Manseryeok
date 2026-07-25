import { describe, expect, test } from "@jest/globals";
import {
  buildDayPillarHierarchy,
  predictDayPillarEffect,
  reliableEffects,
  MIN_TOTAL_OBSERVATIONS,
  DAY_PILLAR_STATS_VERSION,
} from "@/lib/journal/stats/dayPillarHierarchy";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

const CATEGORY: CategoryCode = "energy";

function entry(date: string, value: number): JournalEntry {
  return {
    id: `e-${date}`,
    userId: "u",
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
    createdAt: "",
    updatedAt: `${date}T00:00:00Z`,
  };
}

/** 2026-01-01부터 n일간 날짜 */
function dates(n: number, startIso = "2026-01-01"): string[] {
  const out: string[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe("day pillar hierarchical statistics", () => {
  test("below the observation floor nothing is claimed", () => {
    const entries = dates(MIN_TOTAL_OBSERVATIONS - 1).map((d) => entry(d, 5));
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    expect(h.version).toBe(DAY_PILLAR_STATS_VERSION);
    expect(h.sufficient).toBe(false);
    expect(h.effects).toHaveLength(0);

    const p = predictDayPillarEffect(h, "2026-03-01");
    expect(p.effect).toBe(0);
    expect(p.confidence).toBe(0);
    expect(p.predicted).toBe(h.personalBaseline);
  });

  test("pure noise collapses every effect toward zero", () => {
    // 결정적 의사난수 — 일주와 아무 관계 없는 값
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const entries = dates(180).map((d) => entry(d, 4 + rand() * 3));
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    expect(h.sufficient).toBe(true);
    // 신호가 없으면 축소계수가 낮아 효과가 거의 0
    const maxEffect = Math.max(
      ...h.effects.map((e) => Math.abs(e.shrunkEffect))
    );
    expect(maxEffect).toBeLessThan(0.3);
    // 일간·일지는 그룹당 표본이 충분해 잡음이 완전히 걸러진다
    for (const level of ["stem", "branch"] as const) {
      const summary = h.levels.find((l) => l.level === level)!;
      expect(summary.betweenVariance).toBe(0);
    }
    // 어떤 것도 "신뢰 가능한 발견"으로 승격되지 않는다
    expect(reliableEffects(h)).toHaveLength(0);
  });

  test("a real stem effect survives shrinkage and is attributed to the stem level", () => {
    // 특정 일간(갑)에서만 +3점
    const ds = dates(360);
    const entries = ds.map((d) => {
      const stem = getPillarsForDate(d).dayPillar.stem.ko;
      return entry(d, stem === "갑" ? 8 : 5);
    });
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    expect(h.sufficient).toBe(true);
    const gap = h.effects.find((e) => e.level === "stem" && e.code === "갑")!;
    expect(gap).toBeDefined();
    expect(gap.shrunkEffect).toBeGreaterThan(1.5);
    expect(gap.shrinkage).toBeGreaterThan(0.8);
    expect(gap.reliable).toBe(true);

    // 간지 계층은 일간 효과를 이미 뺀 잔차에서 추정되므로 중복 계산되지 않는다
    const ganjiWithGap = h.effects.filter(
      (e) => e.level === "ganji" && e.code.startsWith("갑")
    );
    for (const g of ganjiWithGap) {
      expect(Math.abs(g.shrunkEffect)).toBeLessThan(1);
    }
  });

  test("shrinkage is stronger for smaller groups", () => {
    const ds = dates(200);
    const entries = ds.map((d, i) => entry(d, 5 + (i % 3)));
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    // 간지(60그룹)는 일간(10그룹)보다 그룹당 표본이 적어 더 강하게 축소된다
    const stemAvg =
      h.effects
        .filter((e) => e.level === "stem")
        .reduce((a, e) => a + e.shrinkage, 0) /
      h.effects.filter((e) => e.level === "stem").length;
    const ganjiAvg =
      h.effects
        .filter((e) => e.level === "ganji")
        .reduce((a, e) => a + e.shrinkage, 0) /
      h.effects.filter((e) => e.level === "ganji").length;

    expect(ganjiAvg).toBeLessThanOrEqual(stemAvg);
  });

  test("prediction stays near the personal baseline and is deterministic", () => {
    const ds = dates(200);
    const entries = ds.map((d) => {
      const stem = getPillarsForDate(d).dayPillar.stem.ko;
      return entry(d, stem === "을" ? 7 : 5);
    });
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    const target = "2026-11-11";
    const a = predictDayPillarEffect(h, target);
    const b = predictDayPillarEffect(h, target);
    expect(a).toEqual(b);

    // 축소된 효과는 원본 편차(2점)보다 작아야 한다
    expect(Math.abs(a.effect)).toBeLessThan(2);
    expect(a.confidence).toBeGreaterThan(0);
    expect(a.confidence).toBeLessThanOrEqual(0.9);
  });

  test("constant scores produce zero effects and zero variance", () => {
    const entries = dates(120).map((d) => entry(d, 6));
    const h = buildDayPillarHierarchy(entries, CATEGORY);

    expect(h.personalBaseline).toBe(6);
    for (const e of h.effects) expect(e.shrunkEffect).toBe(0);
    expect(predictDayPillarEffect(h, "2026-06-06").effect).toBe(0);
  });

  test("duplicate dates keep only the latest entry", () => {
    const base = dates(20).map((d) => entry(d, 5));
    const dup = { ...entry("2026-01-01", 10), updatedAt: "2030-01-01T00:00:00Z" };
    const h = buildDayPillarHierarchy([...base, dup], CATEGORY);
    expect(h.totalObservations).toBe(20);
  });

  test("entries missing the category or marked N/A are ignored", () => {
    const entries = dates(20).map((d, i) => {
      const e = entry(d, 5);
      if (i % 2 === 0) e.scores[0]!.isNotApplicable = true;
      return e;
    });
    const h = buildDayPillarHierarchy(entries, CATEGORY);
    expect(h.totalObservations).toBe(10);
    expect(h.sufficient).toBe(false);
  });
});
