import { computeJournalStreak } from "@/lib/journal/streak";

describe("computeJournalStreak", () => {
  test("오늘 포함 연속이면 오늘부터 센다", () => {
    const s = computeJournalStreak(
      ["2026-07-24", "2026-07-25", "2026-07-26"],
      "2026-07-26"
    );
    expect(s.days).toBe(3);
    expect(s.recordedToday).toBe(true);
    expect(s.atRisk).toBe(false);
  });

  test("오늘만 비고 어제까지면 유지·위험", () => {
    const s = computeJournalStreak(["2026-07-24", "2026-07-25"], "2026-07-26");
    expect(s.days).toBe(2);
    expect(s.recordedToday).toBe(false);
    expect(s.atRisk).toBe(true);
  });

  test("이틀 이상 비면 0", () => {
    const s = computeJournalStreak(["2026-07-20", "2026-07-21"], "2026-07-26");
    expect(s.days).toBe(0);
    expect(s.recordedToday).toBe(false);
    expect(s.atRisk).toBe(false);
  });

  test("오늘만 있으면 1", () => {
    const s = computeJournalStreak(["2026-07-26"], "2026-07-26");
    expect(s.days).toBe(1);
    expect(s.recordedToday).toBe(true);
  });
});
