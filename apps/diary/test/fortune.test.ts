import { describe, expect, test } from "vitest";
import { STEMS, getTenGod } from "@saju/engine";
import { branchRelation, computeBaseFortune, FAMILY_OF } from "@/lib/fortune/base";
import { buildUserPrompt, MAX_PROMPT_CHARS } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, fitPercent, happinessToScore, toTenPoint } from "@/lib/fortune/personal";
import { findBanned, templateText } from "@/lib/fortune/text";
import type { PillarsSnapshot } from "@/lib/profile";

// 1990-01-01 12:00 서울 → 己巳 丙子 丙寅 甲午 (일간 丙, 일지 寅, 월지 子)
const ME: PillarsSnapshot = {
  year: { stem: "己", branch: "巳", ko: "기사" },
  month: { stem: "丙", branch: "子", ko: "병자" },
  day: { stem: "丙", branch: "寅", ko: "병인" },
  hour: { stem: "甲", branch: "午", ko: "갑오" },
};

describe("지지 관계", () => {
  test("육합·충·삼합·복음", () => {
    expect(branchRelation("子", "丑")).toBe("육합");
    expect(branchRelation("寅", "申")).toBe("충");
    expect(branchRelation("寅", "午")).toBe("삼합");
    expect(branchRelation("寅", "寅")).toBe("복음");
    expect(branchRelation("寅", "酉")).toBeNull();
  });
});

describe("기본 점수", () => {
  test("십신 가족 매핑", () => {
    expect(FAMILY_OF[getTenGod("丙", "戊")]).toBe("식상");
    expect(FAMILY_OF[getTenGod("丙", "庚")]).toBe("재성");
    expect(FAMILY_OF[getTenGod("丙", "壬")]).toBe("관성");
  });

  test("충인 날은 합인 날보다 낮다", () => {
    const clash = computeBaseFortune(ME, { stem: "庚", branch: "申", ko: "경신" }); // 寅申충
    const union = computeBaseFortune(ME, { stem: "辛", branch: "亥", ko: "신해" }); // 寅亥육합
    expect(clash.relation).toBe("충");
    expect(union.relation).toBe("육합");
    expect(clash.score).toBeLessThan(union.score);
  });

  test("점수는 0.15~0.9 안이고 근거가 있다", () => {
    for (const stem of STEMS) {
      const r = computeBaseFortune(ME, { stem, branch: "子", ko: "x" });
      expect(r.score).toBeGreaterThanOrEqual(0.15);
      expect(r.score).toBeLessThanOrEqual(0.9);
      expect(r.facts.length).toBeGreaterThan(0);
    }
  });

  test("용신 판정이 붙는다 (丙 일간 사주는 화가 많아 수가 용신)", () => {
    const water = computeBaseFortune(ME, { stem: "壬", branch: "子", ko: "임자" });
    expect(water.yongsin).toBe("용신");
    const fire = computeBaseFortune(ME, { stem: "丁", branch: "巳", ko: "정사" });
    expect(fire.yongsin).toBe("기신");
  });
});

describe("내 기록 보정", () => {
  const today = { index: 47, stemKo: "신", branchKo: "해" };
  test("기록이 없으면 사주 점수 그대로", () => {
    const r = adjustWithEntries(0.62, [], today);
    expect(r).toMatchObject({ n: 0, mean: null, weight: 0, score: 0.62 });
  });

  test("같은 성분 5일이면 반반, 행복도 10은 1.0", () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ day_ganji_index: i, day_stem: "신", day_branch: "자", happiness: 10 }));
    const r = adjustWithEntries(0.4, entries, today);
    expect(r.n).toBe(5);
    expect(r.weight).toBe(0.5);
    expect(r.score).toBeCloseTo(0.4 * 0.5 + 1 * 0.5, 5);
  });

  test("같은 60갑자 날은 따로 센다", () => {
    const entries = [
      { day_ganji_index: 47, day_stem: "신", day_branch: "해", happiness: 8 },
      { day_ganji_index: 23, day_stem: "정", day_branch: "해", happiness: 4 },
    ];
    const r = adjustWithEntries(0.5, entries, today);
    expect(r.n).toBe(2);
    expect(r.sameGanjiCount).toBe(1);
    expect(r.sameGanjiMean).toBe(8);
  });

  test("눈금", () => {
    expect(happinessToScore(5.5)).toBeCloseTo(0.5);
    expect(toTenPoint(0.655)).toBe(6.6);
    expect(bandOf(7)).toBe("좋음");
    expect(bandOf(5)).toBe("무난");
    expect(bandOf(4)).toBe("주의");
    expect(fitPercent(0)).toBe(0);
    expect(fitPercent(20)).toBe(50);
  });
});

describe("템플릿 문장", () => {
  test("모든 십신 × 관계 × 용신 조합에 금지어·전문용어가 없다", () => {
    const relations = [null, "육합", "삼합", "충", "복음"] as const;
    const yongsins = [null, "용신", "기신"] as const;
    const personal = { n: 3, mean: 7.3, sameGanjiCount: 1, sameGanjiMean: 8, weight: 0.38, score: 0.6 };
    for (const stem of STEMS) {
      const base = computeBaseFortune(ME, { stem, branch: "子", ko: "x" });
      for (const relation of relations) {
        for (const yongsin of yongsins) {
          const t = templateText({ ...base, relation, yongsin }, personal, { ko: "신해", stemKo: "신", branchKo: "해" });
          const all = [t.headline, t.body, t.do, t.dont].join(" ");
          expect(findBanned(all), all).toEqual([]);
          expect(all).toMatch(/(어요|해요|돼요|예요)\.?/);
          expect(t.headline.length).toBeLessThanOrEqual(22);
        }
      }
    }
  });

  test("기록이 있으면 본문에 내 기록 문장이 들어간다", () => {
    const base = computeBaseFortune(ME, { stem: "辛", branch: "亥", ko: "신해" });
    const t = templateText(base, { n: 2, mean: 6.5, sameGanjiCount: 0, sameGanjiMean: null, weight: 0.29, score: 0.6 }, { ko: "신해", stemKo: "신", branchKo: "해" });
    expect(t.body).toContain("2번 기록");
  });
});

describe("모델 프롬프트", () => {
  test("입력 크기 제한 안", () => {
    const base = computeBaseFortune(ME, { stem: "庚", branch: "申", ko: "경신" });
    const user = buildUserPrompt({
      base,
      personal: { n: 12, mean: 6.8, sameGanjiCount: 2, sameGanjiMean: 7.5, weight: 0.71, score: 0.6 },
      today: { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" },
      weekday: "일요일",
      score10: 5.9,
    });
    expect(user.length).toBeLessThan(MAX_PROMPT_CHARS / 2);
    expect(user).toContain("기록했고");
  });
});
