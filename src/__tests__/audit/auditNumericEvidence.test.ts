/**
 * Audit-only numeric evidence printer.
 * Run: npx jest src/__tests__/audit/auditNumericEvidence.test.ts --verbose
 */
import { describe, expect, test } from "@jest/globals";
import { fuseTextAndUserScore } from "@/lib/journal/textAlphaFusion";
import { computeBlendWeights } from "@/lib/journal/insight/dynamicWeights";
import {
  recallConfidenceFromLag,
  assessRecall,
} from "@/lib/journal/recallConfidence";
import {
  buildDayPillarHierarchy,
} from "@/lib/journal/stats/dayPillarHierarchy";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";

const LONG = [
  "아침부터 회의가 세 개나 잡혀서 정신이 하나도 없었다.",
  "점심은 근처 국숫집에서 혼자 먹었는데 국물이 생각보다 짰다.",
  "오후에는 다음 분기 기획서를 붙잡고 씨름했지만 방향이 잘 잡히지 않았다.",
  "퇴근길 지하철에서 예전에 듣던 노래를 다시 들었더니 기분이 조금 풀렸다.",
  "집에 와서 설거지를 미뤄둔 걸 보고 한숨이 나왔지만 그래도 정리하고 씻었다.",
  "내일은 조금 일찍 일어나서 산책이라도 해볼 생각이다.",
].join(" ");

const CATEGORY: CategoryCode = "energy";

function entry(date: string, value: number): JournalEntry {
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
    createdAt: "",
    updatedAt: "",
    firstRecordedAt: `${date}T12:00:00Z`,
  };
}

function datesWithStem(stem: string, n: number): string[] {
  const out: string[] = [];
  const start = new Date(Date.UTC(2024, 0, 1));
  for (let i = 0; out.length < n && i < 800; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (getPillarsForDate(iso).dayPillar.stem.ko === stem) out.push(iso);
  }
  return out;
}

describe("AUDIT numeric evidence", () => {
  test("user5 ai7 long text → fused ≈ 5.3", () => {
    const f = fuseTextAndUserScore({
      userScore: 5,
      aiScore: 7,
      aiConfidence: 0.85,
      content: LONG,
    });
    // eslint-disable-next-line no-console
    console.log("FUSED_EVIDENCE", JSON.stringify(f));
    expect(f.finalScore).not.toBeNull();
    expect(f.finalScore!).toBeGreaterThanOrEqual(5.0);
    expect(f.finalScore!).toBeLessThanOrEqual(5.6);
  });

  test("dynamic weights at 0/180/800/2043/10000 XP", () => {
    const rows = [0, 180, 800, 2043, 10000].map((xp) => ({
      xp,
      ...computeBlendWeights({ totalXp: xp }),
    }));
    // eslint-disable-next-line no-console
    console.log("WEIGHTS_EVIDENCE", JSON.stringify(rows));
    expect(rows[0]!.natal).toBeGreaterThan(rows[4]!.natal);
    expect(rows[4]!.recent).toBeGreaterThan(rows[0]!.recent);
  });

  test("recall confidence at lag 0/1/3/7/8", () => {
    const rows = [0, 1, 3, 7, 8].map((lag) => {
      const entryDate = "2026-07-01";
      const recorded = new Date(Date.UTC(2026, 6, 1 + lag, 12));
      return {
        lag,
        c: recallConfidenceFromLag(lag),
        assessed: assessRecall(entryDate, recorded.toISOString()),
      };
    });
    // eslint-disable-next-line no-console
    console.log("RECALL_EVIDENCE", JSON.stringify(rows));
    expect(rows[0]!.c).toBe(1);
    expect(rows[1]!.c).toBe(1);
    expect(rows[2]!.c).toBeLessThan(1);
    expect(rows[4]!.c).toBeLessThanOrEqual(rows[3]!.c);
  });

  test("day-pillar shrinkage: small n vs larger n for same stem", () => {
    const stemDates = datesWithStem("갑", 12);
    const n1 = buildDayPillarHierarchy(
      [
        ...stemDates.slice(0, 1).map((d) => entry(d, 8)),
        ...datesWithStem("을", 30).map((d) => entry(d, 5)),
      ],
      CATEGORY
    );
    const n2 = buildDayPillarHierarchy(
      [
        ...stemDates.slice(0, 2).map((d) => entry(d, 8)),
        ...datesWithStem("을", 30).map((d) => entry(d, 5)),
      ],
      CATEGORY
    );
    const n10 = buildDayPillarHierarchy(
      [
        ...stemDates.slice(0, 10).map((d) => entry(d, 8)),
        ...datesWithStem("을", 30).map((d) => entry(d, 5)),
      ],
      CATEGORY
    );
    const e1 = n1.effects.find((e) => e.level === "stem" && e.code === "갑");
    const e2 = n2.effects.find((e) => e.level === "stem" && e.code === "갑");
    const e10 = n10.effects.find((e) => e.level === "stem" && e.code === "갑");
    // eslint-disable-next-line no-console
    console.log(
      "SHRINK_EVIDENCE",
      JSON.stringify({
        n1: e1,
        n2: e2,
        n10: e10,
      })
    );
    expect(e10?.n ?? 0).toBeGreaterThanOrEqual(e1?.n ?? 0);
    if (e1 && e10) {
      // 표본이 늘면 축소 계수가 커지거나(덜 축소) 효과가 더 선명해짐
      expect(e10.shrinkage).toBeGreaterThanOrEqual(e1.shrinkage);
    }
  });
});
