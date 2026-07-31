import { describe, expect, test } from "@jest/globals";
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import type { SajuProfile } from "@/lib/diary/types";

function profile(pillars: SajuProfile["pillars"]): SajuProfile {
  return {
    id: "p1",
    isPrimary: true,
    birthDate: "1990-05-15",
    birthTimeUnknown: true,
    calendarType: "solar",
    timezone: "Asia/Seoul",
    dayChangeRule: "ziHour",
    timeCorrection: "none",
    pillars,
    calculationVersion: "test",
    createdAt: "",
    updatedAt: "",
    schemaVersion: 1,
  };
}

describe("buildNatalDayInsight", () => {
  test("원국 재성 강할 때 영역별 키워드·긴장이 갈라진다", () => {
    // 일간 甲 — 년庚(정관), 월己(편재), 시戊(편재) → 재성·관성 쪽
    const p = profile({
      year: {
        stemHanja: "庚",
        branchHanja: "申",
        stemKo: "경",
        branchKo: "신",
        ganjiKo: "경신",
      },
      month: {
        stemHanja: "己",
        branchHanja: "巳",
        stemKo: "기",
        branchKo: "사",
        ganjiKo: "기사",
      },
      day: {
        stemHanja: "甲",
        branchHanja: "子",
        stemKo: "갑",
        branchKo: "자",
        ganjiKo: "갑자",
      },
      hour: {
        stemHanja: "戊",
        branchHanja: "辰",
        stemKo: "무",
        branchKo: "진",
        ganjiKo: "무진",
      },
    });

    const insight = buildNatalDayInsight("2026-07-26", p);
    expect(insight).not.toBeNull();
    expect(insight!.byDomain.work.keywordLabels.length).toBeGreaterThanOrEqual(2);
    expect(insight!.byDomain.money.tensionPlain.length).toBeGreaterThan(10);
    expect(insight!.byDomain.health.tensionPlain).not.toEqual(
      insight!.byDomain.money.tensionPlain
    );
    expect(insight!.overallTraitPlain.length).toBeGreaterThan(5);
  });

  test("프로필 없으면 null", () => {
    expect(buildNatalDayInsight("2026-07-26", null)).toBeNull();
  });
});
