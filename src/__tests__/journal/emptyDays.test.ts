import { describe, expect, test } from "@jest/globals";
import {
  countEmptyDaysInMonth,
  entryDateSet,
  listRecentEmptyDays,
  yesterdayOf,
} from "@/lib/journal/emptyDays";

describe("emptyDays", () => {
  test("yesterdayOf", () => {
    expect(yesterdayOf("2026-07-31")).toBe("2026-07-30");
  });

  test("countEmptyDaysInMonth ignores future", () => {
    const dates = entryDateSet([
      { entryDate: "2026-07-01" },
      { entryDate: "2026-07-02" },
    ]);
    const n = countEmptyDaysInMonth({
      year: 2026,
      month: 7,
      todayIso: "2026-07-05",
      dates,
    });
    // 7/1,7/2 filled → empty 7/3,7/4,7/5 = 3
    expect(n).toBe(3);
  });

  test("listRecentEmptyDays newest first", () => {
    const dates = entryDateSet([{ entryDate: "2026-07-30" }]);
    const gaps = listRecentEmptyDays({
      todayIso: "2026-07-31",
      dates,
      lookback: 3,
    });
    expect(gaps[0]).toBe("2026-07-29");
    expect(gaps).not.toContain("2026-07-30");
  });
});
