import { describe, expect, test } from "@jest/globals";
import {
  runSajuRuleEngine,
  SAJU_RULE_VERSION,
  type RulePillarInput,
} from "@/lib/saju/rules";
import { isCanonicalKeywordCode } from "@/lib/journal/keywords/canonical";

/**
 * 골든 명식 fixture — 생년월일이 아니라 원국 간지로 고정한다.
 * LLM 응답을 정답으로 쓰지 않는다. 기대값은 규칙(통근·월령·신강약)에서 유도.
 */
const FIXTURES: Array<{
  id: string;
  chart: RulePillarInput;
  expect: {
    dayMasterStem: string;
    dayMasterElement: string;
    seasonCommanding: string;
    tZoneHasMonthStem: boolean;
  };
}> = [
  {
    id: "gap-mok-spring-rooted",
    chart: {
      year: { stem: "甲", branch: "子" },
      month: { stem: "乙", branch: "卯" },
      day: { stem: "甲", branch: "寅" },
      hour: { stem: "丙", branch: "寅" },
    },
    expect: {
      dayMasterStem: "甲",
      dayMasterElement: "wood",
      seasonCommanding: "wood",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "byeong-hwa-summer",
    chart: {
      year: { stem: "戊", branch: "午" },
      month: { stem: "丙", branch: "午" },
      day: { stem: "丙", branch: "巳" },
      hour: { stem: "己", branch: "巳" },
    },
    expect: {
      dayMasterStem: "丙",
      dayMasterElement: "fire",
      seasonCommanding: "fire",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "gyeong-geum-autumn",
    chart: {
      year: { stem: "庚", branch: "申" },
      month: { stem: "辛", branch: "酉" },
      day: { stem: "庚", branch: "申" },
      hour: { stem: "壬", branch: "申" },
    },
    expect: {
      dayMasterStem: "庚",
      dayMasterElement: "metal",
      seasonCommanding: "metal",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "im-su-winter",
    chart: {
      year: { stem: "壬", branch: "子" },
      month: { stem: "癸", branch: "亥" },
      day: { stem: "壬", branch: "子" },
      hour: { stem: "甲", branch: "子" },
    },
    expect: {
      dayMasterStem: "壬",
      dayMasterElement: "water",
      seasonCommanding: "water",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "mu-to-transition",
    chart: {
      year: { stem: "戊", branch: "辰" },
      month: { stem: "己", branch: "辰" },
      day: { stem: "戊", branch: "戌" },
      hour: { stem: "庚", branch: "辰" },
    },
    expect: {
      dayMasterStem: "戊",
      dayMasterElement: "earth",
      seasonCommanding: "earth",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "eul-mok-no-hour",
    chart: {
      year: { stem: "乙", branch: "亥" },
      month: { stem: "甲", branch: "寅" },
      day: { stem: "乙", branch: "卯" },
      hour: null,
    },
    expect: {
      dayMasterStem: "乙",
      dayMasterElement: "wood",
      seasonCommanding: "wood",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "jeong-hwa-winter-weak-season",
    chart: {
      year: { stem: "丁", branch: "丑" },
      month: { stem: "壬", branch: "子" },
      day: { stem: "丁", branch: "亥" },
      hour: { stem: "癸", branch: "丑" },
    },
    expect: {
      dayMasterStem: "丁",
      dayMasterElement: "fire",
      seasonCommanding: "water",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "sin-geum-spring",
    chart: {
      year: { stem: "辛", branch: "卯" },
      month: { stem: "乙", branch: "卯" },
      day: { stem: "辛", branch: "酉" },
      hour: { stem: "丁", branch: "酉" },
    },
    expect: {
      dayMasterStem: "辛",
      dayMasterElement: "metal",
      seasonCommanding: "wood",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "gi-to-summer",
    chart: {
      year: { stem: "己", branch: "未" },
      month: { stem: "丁", branch: "巳" },
      day: { stem: "己", branch: "未" },
      hour: { stem: "戊", branch: "午" },
    },
    expect: {
      dayMasterStem: "己",
      dayMasterElement: "earth",
      seasonCommanding: "fire",
      tZoneHasMonthStem: true,
    },
  },
  {
    id: "gye-su-autumn",
    chart: {
      year: { stem: "癸", branch: "酉" },
      month: { stem: "庚", branch: "申" },
      day: { stem: "癸", branch: "亥" },
      hour: { stem: "辛", branch: "酉" },
    },
    expect: {
      dayMasterStem: "癸",
      dayMasterElement: "water",
      seasonCommanding: "metal",
      tZoneHasMonthStem: true,
    },
  },
];

describe("saju rule engine", () => {
  test("exposes a version string", () => {
    expect(SAJU_RULE_VERSION).toMatch(/^saju-rules-v/);
  });

  test.each(FIXTURES)(
    "$id — day master, season, T-zone, strategy blocks",
    (fx) => {
      const out = runSajuRuleEngine(fx.chart, {
        relationsScoringEnabled: false,
      });

      expect(out.ruleVersion).toBe(SAJU_RULE_VERSION);
      expect(out.dayMaster.stem).toBe(fx.expect.dayMasterStem);
      expect(out.dayMaster.element).toBe(fx.expect.dayMasterElement);
      expect(out.season.commandingElement).toBe(fx.expect.seasonCommanding);
      expect(out.tZone.monthStem).toBeTruthy();
      expect(out.tZone.dayBranch).toBeTruthy();
      expect(out.tZone.labels.length).toBeGreaterThanOrEqual(2);

      // 용희기신 + 전략 블록은 항상 채워진다
      expect(out.yongHeeGi.yong).toBeTruthy();
      expect(out.yongHeeGi.hee).toBeTruthy();
      expect(out.yongHeeGi.gi).toBeTruthy();
      expect(out.defaultStrategy.element).toBe(out.yongHeeGi.yong);
      expect(out.overuseRisk.element).toBe(out.yongHeeGi.gi);
      expect(out.regulationResource.element).toBe(out.yongHeeGi.hee);

      // 힘과 가시성은 분리된 필드
      for (const s of out.stems) {
        expect(s.strengthScore).toBeGreaterThanOrEqual(0);
        expect(s.strengthScore).toBeLessThanOrEqual(1);
        expect(s.behaviorVisibilityScore).toBeGreaterThanOrEqual(0);
        expect(s.behaviorVisibilityScore).toBeLessThanOrEqual(1);
      }

      // 증거 코드가 비어 있지 않다
      expect(out.evidence.length).toBeGreaterThan(5);
      expect(out.evidence.some((e) => e.code === "day_master")).toBe(true);
      expect(out.evidence.some((e) => e.code === "t_zone")).toBe(true);
      expect(out.evidence.some((e) => e.code === "yong")).toBe(true);

      // 키워드는 canonical만
      for (const k of out.keywords) {
        expect(isCanonicalKeywordCode(k.code)).toBe(true);
      }

      // 합충 점수 반영 OFF면 delta 0
      expect(out.relations.scoringEnabled).toBe(false);
      expect(out.relations.scoreDelta).toBe(0);
    }
  );

  test("same chart is deterministic", () => {
    const chart = FIXTURES[0]!.chart;
    const a = runSajuRuleEngine(chart);
    const b = runSajuRuleEngine(chart);
    expect(a).toEqual(b);
  });

  test("relations scoring flag can turn on score delta without inventing relations", () => {
    // 子午 충이 있는 명식
    const chart: RulePillarInput = {
      year: { stem: "甲", branch: "子" },
      month: { stem: "丙", branch: "午" },
      day: { stem: "戊", branch: "辰" },
      hour: { stem: "庚", branch: "申" },
    };
    const off = runSajuRuleEngine(chart, { relationsScoringEnabled: false });
    const on = runSajuRuleEngine(chart, { relationsScoringEnabled: true });
    expect(off.relations.detected.length).toBe(on.relations.detected.length);
    expect(off.relations.scoreDelta).toBe(0);
    expect(on.relations.scoringEnabled).toBe(true);
    // 충이 있으면 delta가 음수 쪽으로
    if (on.relations.detected.some((r) => r.kind === "chung")) {
      expect(on.relations.scoreDelta).toBeLessThan(0);
    }
  });

  test("accepts Korean stem/branch labels", () => {
    const out = runSajuRuleEngine({
      year: { stem: "갑", branch: "자" },
      month: { stem: "을", branch: "묘" },
      day: { stem: "갑", branch: "인" },
      hour: { stem: "병", branch: "인" },
    });
    expect(out.dayMaster.stem).toBe("甲");
    expect(out.dayMaster.element).toBe("wood");
  });

  test("yong is never treated as unconditional good luck in notes", () => {
    const out = runSajuRuleEngine(FIXTURES[0]!.chart);
    expect(
      out.yongHeeGi.notes.some((n) => n.includes("무조건"))
    ).toBe(true);
  });
});
