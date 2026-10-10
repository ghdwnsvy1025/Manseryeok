import { describe, expect, it } from "vitest";
import { dailyMetrics, kstDay, retention, type MetricRows } from "@/lib/metrics";

const rows: MetricRows = {
  visits: [
    { user_id: "a", day: "2026-10-01" },
    { user_id: "a", day: "2026-10-02" },
    { user_id: "a", day: "2026-10-08" },
    { user_id: "b", day: "2026-10-01" },
    { user_id: "c", day: "2026-10-09" },
  ],
  signups: [
    { user_id: "a", day: "2026-10-01" },
    { user_id: "b", day: "2026-10-01" },
    { user_id: "c", day: "2026-10-09" },
  ],
  records: [
    { user_id: "a", day: "2026-10-01" },
    { user_id: "a", day: "2026-10-01" },
    { user_id: "b", day: "2026-10-01" },
  ],
  votes: [{ day: "2026-10-01" }],
  shares: [{ day: "2026-10-02" }],
};

describe("dailyMetrics", () => {
  it("날짜별 방문·신규·기록·투표율·공유", () => {
    const m = dailyMetrics(rows, "2026-10-10", 10);
    expect(m[0]!.day).toBe("2026-10-10");
    const d1 = m.find((x) => x.day === "2026-10-01")!;
    expect(d1).toEqual({ day: "2026-10-01", visitors: 2, newUsers: 2, recorders: 2, records: 3, votes: 1, voteRate: 50, shares: 0 });
    expect(m.find((x) => x.day === "2026-10-02")!.shares).toBe(1);
    expect(m.find((x) => x.day === "2026-10-05")!.voteRate).toBeNull();
  });
});

describe("retention", () => {
  it("D1·D7 — 아직 그 날이 안 온 사람은 분모에서 뺀다", () => {
    // a: 10-01 가입 → 10-02 옴(D1), 10-08 옴(D7). b: 안 옴. c: 10-09 가입 → 10-10 안 옴, D7 아직
    expect(retention(rows, "2026-10-10")).toEqual({ cohort: 3, d1: 33, d7: 50 });
  });
});

describe("kstDay", () => {
  it("UTC 15시 = 한국 다음 날 0시", () => {
    expect(kstDay("2026-10-09T15:00:00Z")).toBe("2026-10-10");
    expect(kstDay("2026-10-09T14:59:59Z")).toBe("2026-10-09");
  });
});
