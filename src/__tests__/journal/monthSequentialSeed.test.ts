import { describe, expect, test } from "@jest/globals";
import {
  buildRandomMonthSeedInput,
  contiguousSeedEndDay,
  isMonthSeedEntry,
  MONTH_SEED_MARKER,
  planMonthSeed,
} from "@/lib/journal/seed/monthSequential";
import type { JournalEntry } from "@/lib/journal/types";

function seedEntry(date: string): JournalEntry {
  return {
    id: `id-${date}`,
    userId: "u",
    sajuProfileId: "p1",
    entryDate: date,
    userTimezone: "Asia/Seoul",
    content: `${MONTH_SEED_MARKER} hello`,
    overallSatisfaction: 5,
    happinessScore: 5,
    moodLabel: "평온",
    moodLabels: ["평온"],
    mainEventText: MONTH_SEED_MARKER,
    source: "new_diary",
    scores: [],
    tags: [],
    coreStates: null,
    domainScores: null,
    checkinVersion: null,
    xpGranted: true,
    xpAwarded: 0,
    schemaVersion: 4,
    firstRecordedAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

describe("monthSequential seed", () => {
  test("10개 추가 후 3개 추가 계획", () => {
    const first = planMonthSeed({
      yearMonth: "2026-07",
      count: 10,
      action: "add",
      entries: [],
    });
    expect("error" in first).toBe(false);
    if ("error" in first) return;
    expect(first.addDates[0]).toBe("2026-07-01");
    expect(first.addDates[9]).toBe("2026-07-10");

    const filled = first.addDates.map(seedEntry);
    const second = planMonthSeed({
      yearMonth: "2026-07",
      count: 3,
      action: "add",
      entries: filled,
    });
    expect("error" in second).toBe(false);
    if ("error" in second) return;
    expect(second.addDates).toEqual([
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
    ]);
    expect(contiguousSeedEndDay("2026-07", filled)).toBe(10);
  });

  test("월 최대 일수를 넘기면 마지막 날까지만 채우고 멈춘다", () => {
    // 7월 30일까지 이미 채운 상태에서 10개 추가 요청 → 31일 하나만
    const filled: JournalEntry[] = [];
    for (let d = 1; d <= 30; d += 1) {
      filled.push(seedEntry(`2026-07-${String(d).padStart(2, "0")}`));
    }
    const plan = planMonthSeed({
      yearMonth: "2026-07",
      count: 10,
      action: "add",
      entries: filled,
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.addDates).toEqual(["2026-07-31"]);
    expect(plan.clamped).toBe(true);
    expect(plan.resultingEnd).toBe(31);
    expect(plan.addBlockedReason).toMatch(/31일/);
  });

  test("이미 가득 찼으면 추가하지 않고 안내", () => {
    const filled: JournalEntry[] = [];
    for (let d = 1; d <= 31; d += 1) {
      filled.push(seedEntry(`2026-07-${String(d).padStart(2, "0")}`));
    }
    const plan = planMonthSeed({
      yearMonth: "2026-07",
      count: 5,
      action: "add",
      entries: filled,
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.addDates).toEqual([]);
    expect(plan.addBlockedReason).toMatch(/가득/);
  });

  test("남은 시드보다 많이 삭제 요청하면 0개까지만 지운다", () => {
    const entries = [
      seedEntry("2026-07-01"),
      seedEntry("2026-07-02"),
      seedEntry("2026-07-03"),
    ];
    const plan = planMonthSeed({
      yearMonth: "2026-07",
      count: 10,
      action: "delete",
      entries,
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.deleteDates).toEqual([
      "2026-07-03",
      "2026-07-02",
      "2026-07-01",
    ]);
    expect(plan.clamped).toBe(true);
    expect(plan.resultingEnd).toBe(0);
    expect(plan.deleteBlockedReason).toMatch(/0개/);
  });

  test("삭제할 시드 없으면 설명", () => {
    const plan = planMonthSeed({
      yearMonth: "2026-07",
      count: 3,
      action: "delete",
      entries: [],
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.deleteDates).toEqual([]);
    expect(plan.deleteBlockedReason).toMatch(/없습니다/);
  });

  test("끝에서부터 삭제", () => {
    const entries = [
      seedEntry("2026-07-01"),
      seedEntry("2026-07-02"),
      seedEntry("2026-07-03"),
    ];
    const plan = planMonthSeed({
      yearMonth: "2026-07",
      count: 2,
      action: "delete",
      entries,
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.deleteDates).toEqual(["2026-07-03", "2026-07-02"]);
  });

  test("랜덤 시드 입력에 마커·필수·선택 필드 포함", () => {
    const input = buildRandomMonthSeedInput("2026-07-05");
    expect(isMonthSeedEntry(input as never)).toBe(true);
    expect(input.content).toContain(MONTH_SEED_MARKER);
    expect(input.content.trim().length).toBeGreaterThan(MONTH_SEED_MARKER.length);
    expect(input.checkinVersion).toBe(2);
    expect(input.happinessScore).toBeGreaterThanOrEqual(0);
    expect(input.happinessScore).toBeLessThanOrEqual(10);
    expect(input.moodLabels?.length).toBeGreaterThanOrEqual(1);
    expect(input.moodLabels?.length).toBeLessThanOrEqual(3);
    expect(input.coreStates).toBeTruthy();
    for (const code of [
      "energy",
      "focus_execution",
      "physical_condition",
      "emotional_balance",
    ]) {
      const row = input.coreStates?.[code];
      expect(row?.isNotApplicable).toBe(false);
      expect(row?.ordinal).toBeGreaterThanOrEqual(1);
      expect(row?.ordinal).toBeLessThanOrEqual(5);
    }
    expect(input.scores.length).toBeGreaterThan(0);
    // DB에 없는 none_special / other 를 넣지 않는다
    expect(input.tagCodes).not.toContain("none_special");
    expect(input.tagCodes).not.toContain("other");
  });

  test("prefs에 physical_condition이 없어도 시드 enabledCodes에 핵심 4항목 포함", () => {
    const input = buildRandomMonthSeedInput("2026-07-05", {
      enabledCodes: [
        "emotional_balance",
        "energy",
        "recovery_sleep",
        "focus_execution",
        "work_study",
        "relationship",
      ],
    });
    expect(input.enabledCodes).toContain("physical_condition");
    expect(input.scores.some((s) => s.categoryCode === "physical_condition")).toBe(
      true
    );
    // prefs 전용 카테고리도 점수 행이 있어야 validateSaveScores 통과
    expect(input.scores.some((s) => s.categoryCode === "recovery_sleep")).toBe(
      true
    );
  });
});
