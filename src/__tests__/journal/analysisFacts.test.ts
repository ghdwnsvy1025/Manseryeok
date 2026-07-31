/**
 * analysisFacts — 원국×일진 4계층 분석이 날짜·일간에 따라 갈라지는지
 */
import { describe, expect, test } from "@jest/globals";
import type { SajuProfile } from "@/lib/diary/types";
import { buildNatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { buildFortuneLuckMaterials } from "@/lib/journal/fortune/luckMaterials";
import { buildDayStructureBrief } from "@/lib/journal/fortune/dayStructureBrief";
import { buildFortuneAnalysisFacts } from "@/lib/journal/fortune/analysisFacts";
import { buildNatalSignatures } from "@/lib/journal/fortune/natalSignatures";

/** 예시: 신미 / 기축 / 병술 / 을해 (시→일→월→년) */
function giEarthProfile(): SajuProfile {
  return {
    id: "p-gi",
    isPrimary: true,
    birthDate: "1995-10-25",
    birthHour: 13,
    birthMinute: 57,
    birthTimeUnknown: false,
    calendarType: "solar",
    timezone: "Asia/Seoul",
    dayChangeRule: "ziHour",
    timeCorrection: "none",
    gender: "male",
    pillars: {
      hour: {
        stemHanja: "辛",
        branchHanja: "未",
        stemKo: "신",
        branchKo: "미",
        ganjiKo: "신미",
      },
      day: {
        stemHanja: "己",
        branchHanja: "丑",
        stemKo: "기",
        branchKo: "축",
        ganjiKo: "기축",
      },
      month: {
        stemHanja: "丙",
        branchHanja: "戌",
        stemKo: "병",
        branchKo: "술",
        ganjiKo: "병술",
      },
      year: {
        stemHanja: "乙",
        branchHanja: "亥",
        stemKo: "을",
        branchKo: "해",
        ganjiKo: "을해",
      },
    },
    calculationVersion: "test",
    createdAt: "",
    updatedAt: "",
    schemaVersion: 1,
  };
}

function woodDayMasterProfile(): SajuProfile {
  const p = giEarthProfile();
  return {
    ...p,
    id: "p-gap",
    pillars: {
      ...p.pillars,
      day: {
        stemHanja: "甲",
        branchHanja: "子",
        stemKo: "갑",
        branchKo: "자",
        ganjiKo: "갑자",
      },
    },
  };
}

describe("buildFortuneAnalysisFacts", () => {
  test("기토 일간은 일간 특징·T존을 추출한다", () => {
    const profile = giEarthProfile();
    const date = "2026-07-30";
    const natalDay = buildNatalDayInsight(date, profile);
    const luck = buildFortuneLuckMaterials(date, profile);
    const brief = buildDayStructureBrief(date, profile, natalDay, luck);
    const facts = buildFortuneAnalysisFacts({
      profile,
      natalDay,
      luck,
      dayBrief: brief,
    });

    expect(facts).not.toBeNull();
    expect(facts!.dayMasterKo).toBe("기");
    expect(facts!.calculationMode).toBe("native_with_luck");
    expect(facts!.natalFeatures.length).toBeGreaterThanOrEqual(2);
    expect(facts!.natalFeatures.some((f) => f.factor.includes("기토"))).toBe(
      true
    );
    expect(
      facts!.compressed.natalSummary.tZoneTenGods.length
    ).toBeGreaterThanOrEqual(1);
    expect(facts!.categoryEvidence.overall.length).toBeGreaterThanOrEqual(1);
    expect(facts!.categoryEvidence.health.join(" ")).toMatch(/진단|생활/);
  });

  test("같은 날짜라도 일간이 다르면 오늘 십신 해석이 달라진다", () => {
    const date = "2026-07-30";
    const gi = giEarthProfile();
    const gap = woodDayMasterProfile();

    const factsGi = buildFortuneAnalysisFacts({
      profile: gi,
      natalDay: buildNatalDayInsight(date, gi),
      luck: buildFortuneLuckMaterials(date, gi),
      dayBrief: buildDayStructureBrief(
        date,
        gi,
        buildNatalDayInsight(date, gi),
        buildFortuneLuckMaterials(date, gi)
      ),
    });
    const factsGap = buildFortuneAnalysisFacts({
      profile: gap,
      natalDay: buildNatalDayInsight(date, gap),
      luck: buildFortuneLuckMaterials(date, gap),
      dayBrief: buildDayStructureBrief(
        date,
        gap,
        buildNatalDayInsight(date, gap),
        buildFortuneLuckMaterials(date, gap)
      ),
    });

    expect(factsGi!.dayMasterKo).toBe("기");
    expect(factsGap!.dayMasterKo).toBe("갑");
    // 같은 일운 천간이어도 일간 기준 십신은 달라질 수 있음
    expect(factsGi!.compressed.todaySummary.mainTenGod).not.toEqual(
      factsGap!.compressed.todaySummary.mainTenGod
    );
  });

  test("날짜가 바뀌면 todayFeatures·dayContrast가 달라진다", () => {
    const profile = giEarthProfile();
    const d1 = "2026-07-30";
    const d2 = "2026-07-31";

    const facts1 = buildFortuneAnalysisFacts({
      profile,
      natalDay: buildNatalDayInsight(d1, profile),
      luck: buildFortuneLuckMaterials(d1, profile),
      dayBrief: buildDayStructureBrief(
        d1,
        profile,
        buildNatalDayInsight(d1, profile),
        buildFortuneLuckMaterials(d1, profile)
      ),
    });
    const facts2 = buildFortuneAnalysisFacts({
      profile,
      natalDay: buildNatalDayInsight(d2, profile),
      luck: buildFortuneLuckMaterials(d2, profile),
      dayBrief: buildDayStructureBrief(
        d2,
        profile,
        buildNatalDayInsight(d2, profile),
        buildFortuneLuckMaterials(d2, profile)
      ),
    });

    expect(facts1!.compressed.todaySummary.dayPillar).not.toEqual(
      facts2!.compressed.todaySummary.dayPillar
    );
  });

  test("natalSignatures에 T존·일간 사전이 반영된다", () => {
    const profile = giEarthProfile();
    const natalDay = buildNatalDayInsight("2026-07-30", profile);
    const sigs = buildNatalSignatures(profile, natalDay);
    expect(sigs.some((s) => s.id === "day_master")).toBe(true);
    expect(sigs.some((s) => s.id === "t_zone" || s.id === "dominant_god")).toBe(
      true
    );
    expect(sigs[0]!.body.length).toBeGreaterThan(10);
  });
});
