import { describe, expect, test } from "vitest";
import { STEMS, getTenGod } from "@saju/engine";
import { fromBirth, toCorePillars } from "@saju/core-rules";
import { branchRelation, computeBaseFortune, FAMILY_OF } from "@/lib/fortune/base";
import { computeCoreFortune, ipchunDate, resolveYongsin, seunOf, toBirthInput, UNKNOWN_HOUR_MIN } from "@/lib/fortune/core";
import { buildBrief, hanjaToKo, plainFact, type BriefInput } from "@/lib/fortune/brief";
import { ownerFilter, saveFortuneCache } from "@/lib/fortune/cache";
import { generateFortuneText, OUTPUT_SCHEMA } from "@/lib/fortune/llm";
import { validateFortuneText, type ModelText } from "@/lib/fortune/validate";
import { adjustWithEntries, bandOf, fitPercent, happinessToScore, toTenPoint } from "@/lib/fortune/personal";
import { findBanned, templateInputFromCore, templateText } from "@/lib/fortune/text";
import type { AreaName, AreaSignal, CoreFortune } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";
import { balance } from "@saju/core-rules";

// 1990-01-01 12:00 서울 → 己巳 丙子 丙寅 甲午 (일간 丙, 일지 寅, 월지 子)
const ME: PillarsSnapshot = {
  year: { stem: "己", branch: "巳", ko: "기사" },
  month: { stem: "丙", branch: "子", ko: "병자" },
  day: { stem: "丙", branch: "寅", ko: "병인" },
  hour: { stem: "甲", branch: "午", ko: "갑오" },
};
const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
// 코어 테스트(adapters.test.ts)의 사주: 1994-01-28 12:00 여 → 癸酉 乙丑 甲寅 庚午. 戊戌 매우 유리 / 壬寅 어려움
const PROFILE_B: BirthProfile = { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1994, birthMonth: 1, birthDay: 28, birthHour: 12, birthMinute: 0, city: "seoul" };

function pillarsOf(p: BirthProfile): PillarsSnapshot {
  const c = computeProfile({ ...p, name: "x" });
  if (!c.ok) throw new Error(c.error);
  return c.value.pillars;
}
function v4(p: BirthProfile, date: string, pillars = pillarsOf(p)): CoreFortune {
  return computeCoreFortune({ pillars, profile: p, date, todayHanja: dayGanji(date).hanja });
}
const score10 = (c: CoreFortune) => toTenPoint(c.parts.score01);

describe("v4 입력 변환", () => {
  test("ProfileInput → BirthInput (달력·성별·출생지 이름)", () => {
    expect(toBirthInput(PROFILE_A)).toEqual({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, 달력: "양력", 윤달: false, 성별: "남", 출생지: "서울" });
    const lunar = toBirthInput({ ...PROFILE_B, calendar: "lunar", isLeapMonth: true, birthHour: null, birthMinute: null, city: "busan" });
    expect(lunar).toEqual({ year: 1994, month: 1, day: 28, 달력: "음력", 윤달: true, 성별: "여", 출생지: "부산" });
    expect("hour" in lunar).toBe(false);
  });

  test("원국: 일기 앱 스냅샷과 코어 fromBirth가 같은 네 기둥을 낸다 (두 샘플)", () => {
    for (const prof of [PROFILE_A, PROFILE_B]) {
      expect(fromBirth(toBirthInput(prof)).pillars).toEqual(toCorePillars(pillarsOf(prof)));
    }
    expect(toCorePillars(pillarsOf(PROFILE_A))).toEqual(["己巳", "丙子", "丙寅", "甲午"]);
    expect(toCorePillars(pillarsOf(PROFILE_B))).toEqual(["癸酉", "乙丑", "甲寅", "庚午"]);
  });
});

describe("v4 세운 — 입춘 전은 전년", () => {
  test("2026년 입춘은 2월 4일. 전날까지 乙巳, 당일부터 丙午", () => {
    expect(ipchunDate(2026)).toBe("2026-02-04");
    expect(seunOf("2026-01-20")).toEqual({ 해: 2025, 간지: "乙巳", 입춘전: true });
    expect(seunOf("2026-02-03").입춘전).toBe(true);
    expect(seunOf("2026-02-04")).toEqual({ 해: 2026, 간지: "丙午", 입춘전: false });
    expect(seunOf("2026-12-31").간지).toBe("丙午");
  });

  test("파이프라인에도 반영되고 caveat가 붙는다", () => {
    const r = v4(PROFILE_A, "2026-01-20");
    expect(r.context.seun).toMatchObject({ 해: 2025, 간지: "乙巳" });
    expect(r.context.입춘전).toBe(true);
    expect(r.caveats).toContain("입춘 전이라 세운은 전년 글자로 봄");
    expect(v4(PROFILE_A, "2026-02-04").context.seun.간지).toBe("丙午");
  });
});

describe("v4 점수·밴드·영역 스냅샷 (사주 2 × 날짜 5)", () => {
  // 값은 2026-10-05 구현 시점의 실행 결과로 고정. 계수(core.ts COEF)나 코어 규칙이 바뀌면 함께 갱신한다.
  const CASES: { prof: BirthProfile; date: string; ganji: string; score: number; band: string; total: string; areas: string[] }[] = [
    { prof: PROFILE_A, date: "2026-10-05", ganji: "壬子", score: 6.5, band: "무난", total: "유리", areas: [] },
    { prof: PROFILE_A, date: "2026-01-20", ganji: "甲午", score: 3.1, band: "주의", total: "어려움", areas: ["대인↓", "재물↓", "학업↓"] },
    { prof: PROFILE_A, date: "2026-02-04", ganji: "己酉", score: 8.1, band: "좋음", total: "매우 유리", areas: ["재물↑", "연애↑", "대인↑"] },
    { prof: PROFILE_A, date: "2026-06-15", ganji: "庚申", score: 9.2, band: "좋음", total: "매우 유리", areas: ["재물↑", "연애↑", "대인↑"] },
    { prof: PROFILE_A, date: "2027-03-01", ganji: "己卯", score: 4.4, band: "주의", total: "유리", areas: ["직업↑", "가족↓", "건강↓"] },
    { prof: PROFILE_B, date: "2026-10-05", ganji: "壬子", score: 2.1, band: "주의", total: "주의", areas: ["학업↓", "가족↓", "건강↓"] },
    { prof: PROFILE_B, date: "2026-01-20", ganji: "甲午", score: 3.5, band: "주의", total: "주의", areas: ["대인↓", "재물↓", "직업↑"] },
    { prof: PROFILE_B, date: "2026-02-04", ganji: "己酉", score: 8.2, band: "좋음", total: "매우 유리", areas: ["재물↑", "대인↑"] },
    { prof: PROFILE_B, date: "2026-06-15", ganji: "庚申", score: 7.5, band: "좋음", total: "유리", areas: [] },
    { prof: PROFILE_B, date: "2027-03-01", ganji: "己卯", score: 6.3, band: "무난", total: "유리", areas: ["재물↑", "대인↑"] },
  ];
  for (const c of CASES) {
    test(`${c.prof === PROFILE_A ? "A" : "B"} ${c.date} ${c.ganji} → ${c.score} ${c.band}`, () => {
      expect(dayGanji(c.date).hanja).toBe(c.ganji);
      const r = v4(c.prof, c.date);
      expect(score10(r)).toBe(c.score);
      expect(bandOf(score10(r))).toBe(c.band);
      expect(r.dayLuck.total).toBe(c.total);
      expect(r.areas.map((a) => a.area + a.signal)).toEqual(c.areas);
      expect(r.areas.length).toBeLessThanOrEqual(3);
      expect(r.parts.score01).toBeGreaterThanOrEqual(0.12);
      expect(r.parts.score01).toBeLessThanOrEqual(0.92);
    });
  }

  test("코어 알려진 사례: 戊戌 매우 유리 > 壬寅 어려움 (1994-01-28 여)", () => {
    const pillars = pillarsOf(PROFILE_B);
    const good = computeCoreFortune({ pillars, profile: PROFILE_B, date: "2026-10-05", todayHanja: "戊戌" });
    const bad = computeCoreFortune({ pillars, profile: PROFILE_B, date: "2026-10-05", todayHanja: "壬寅" });
    expect(good.dayLuck.total).toBe("매우 유리");
    expect(bad.dayLuck.total).toBe("어려움");
    expect(bandOf(score10(good))).toBe("좋음");
    expect(bandOf(score10(bad))).toBe("주의");
    expect(score10(good)).toBeGreaterThan(score10(bad));
    expect(good.dayLuck.stem.label).toBe("용");
    expect(bad.dayLuck.branch.label).toBe("기");
  });

  test("대운 충 플래그: A의 대운 癸酉 × 己卯일 → 최고경보, ctx −1.2", () => {
    const r = v4(PROFILE_A, "2027-03-01");
    expect(r.context.daeun).toMatchObject({ 간지: "癸酉", clash: { 강도: 3, 최고경보: true } });
    expect(r.parts.ctx).toBe(-1.2);
    expect(r.facts.some((f) => f.includes("10년 단위 운") && f.includes("부딪혀"))).toBe(true);
  });

  test("세운 충: 丙午년 × 壬子일 → 세운 clash, ctx −0.5", () => {
    const r = v4(PROFILE_A, "2026-10-05");
    expect(r.context.seun).toMatchObject({ 간지: "丙午", clash: { 강도: 3, 최고경보: true } });
    expect(r.parts.ctx).toBe(-0.5);
  });

  test("점수 분해: score01 = 0.5 + (raw + rel + ctx) / 12 (범위 안)", () => {
    for (const c of CASES) {
      const r = v4(c.prof, c.date);
      const expected = Math.max(0.12, Math.min(0.92, 0.5 + (r.parts.raw + r.parts.rel + r.parts.ctx) / 12));
      expect(r.parts.score01).toBeCloseTo(expected, 1); // parts는 소수 2자리로 반올림돼 있다
    }
  });
});

describe("v4 시간 모름 (Y-10)", () => {
  test("용신이 12/12 모이면 그대로 계산하고 caveat만 붙는다 (1990-01-01 시간 모름)", () => {
    const prof = { ...PROFILE_A, birthHour: null, birthMinute: null };
    const pillars = pillarsOf(prof);
    expect(pillars.hour).toBeNull();
    const p = toCorePillars(pillars);
    const { y, votes } = resolveYongsin(p, balance(p));
    expect(y).not.toBeNull();
    expect(votes).toBeGreaterThanOrEqual(UNKNOWN_HOUR_MIN);
    const r = v4(prof, "2026-06-15", pillars);
    expect(r.dayLuck.method).toBe("라벨 점수");
    expect(r.caveats.some((c) => c.startsWith("시간 모름"))).toBe(true);
    expect(templateInputFromCore(r).fitNote).toBeUndefined();
  });

  test("용신이 10/12 미만이면 유불리 축을 빼고 십신·충합만 (1985-05-03 시간 모름: 금 7 / 수 5)", () => {
    const prof: BirthProfile = { ...PROFILE_A, birthYear: 1985, birthMonth: 5, birthDay: 3, birthHour: null, birthMinute: null };
    const pillars = pillarsOf(prof);
    const p = toCorePillars(pillars);
    expect(resolveYongsin(p, balance(p))).toEqual({ y: null, votes: 7 });
    const r = v4(prof, "2026-06-15", pillars); // 庚申
    expect(r.dayLuck.method).toBe("용신 없음");
    expect(r.dayLuck.raw).toBe(0);
    expect(r.dayLuck.stem.label).toBeNull();
    expect(r.dayLuck.total).toBe("보통");
    expect(r.areas).toEqual([]);
    expect(r.keywords).toEqual({ positive: [], negative: [] });
    expect(r.context.seun.판정).toBeNull();
    // 寅申충은 방향 없이 조금만 뺀다
    expect(r.relations.hits.some((h) => h.kind === "충" && h.direction === "중립")).toBe(true);
    expect(r.parts.rel).toBeLessThan(0);
    expect(templateInputFromCore(r).fitNote).toBe("태어난 시간을 모르면 운세의 폭이 넓어져요.");
    const t = templateText(templateInputFromCore(r), { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: r.parts.score01 }, { ko: "경신", stemKo: "경", branchKo: "신" });
    expect(t.body).toContain("운세의 폭이 넓어져요");
  });
});

describe("v4 글 재료 (facts·keywords)", () => {
  test("facts는 6~10문장, 금지어 없음, 어미는 ~어요", () => {
    for (const prof of [PROFILE_A, PROFILE_B, { ...PROFILE_A, birthHour: null, birthMinute: null }]) {
      const pillars = pillarsOf(prof);
      for (const date of ["2026-10-05", "2026-01-20", "2026-02-04", "2026-06-15", "2027-03-01", "2026-03-09", "2026-11-23"]) {
        const r = v4(prof, date, pillars);
        expect(r.facts.length, date).toBeGreaterThanOrEqual(6);
        expect(r.facts.length, date).toBeLessThanOrEqual(10);
        expect(findBanned(r.facts.join(" ")), r.facts.join("\n")).toEqual([]);
        for (const f of r.facts) expect(f).toMatch(/요\.?$/);
        for (const a of r.areas) expect(findBanned(a.why), a.why).toEqual([]);
      }
    }
  });

  test("keywords는 luckKeywords의 운_긍정/운_부정 칸에서 온다", () => {
    const r = v4(PROFILE_A, "2026-06-15"); // 庚申 = 편재·편재, 둘 다 용
    expect(r.keywords.positive).toEqual(["무대가 넓어짐", "재물 기회"]);
    expect(r.keywords.negative).toEqual([]);
  });

  test("영역 why와 연애 영역은 성별로 갈린다 (재성 ↔ 남, 관성 ↔ 여)", () => {
    const a = v4(PROFILE_A, "2026-06-15"); // 남, 편재 → 연애 포함
    expect(a.areas.map((x) => x.area)).toContain("연애");
    const asFemale = v4({ ...PROFILE_A, gender: "female" }, "2026-06-15", pillarsOf(PROFILE_A));
    expect(asFemale.areas.map((x) => x.area)).not.toContain("연애");
  });
});

describe("v3 기본 점수 (백테스트 비교용으로 남김)", () => {
  test("지지 관계 육합·충·삼합·복음", () => {
    expect(branchRelation("子", "丑")).toBe("육합");
    expect(branchRelation("寅", "申")).toBe("충");
    expect(branchRelation("寅", "午")).toBe("삼합");
    expect(branchRelation("寅", "寅")).toBe("복음");
    expect(branchRelation("寅", "酉")).toBeNull();
  });

  test("십신 가족 매핑", () => {
    expect(FAMILY_OF[getTenGod("丙", "戊")]).toBe("식상");
    expect(FAMILY_OF[getTenGod("丙", "庚")]).toBe("재성");
    expect(FAMILY_OF[getTenGod("丙", "壬")]).toBe("관성");
  });

  test("충인 날은 합인 날보다 낮다", () => {
    const clash = computeBaseFortune(ME, { stem: "庚", branch: "申", ko: "경신" });
    const union = computeBaseFortune(ME, { stem: "辛", branch: "亥", ko: "신해" });
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
  const personal = { n: 3, mean: 7.3, sameGanjiCount: 1, sameGanjiMean: 8, weight: 0.38, score: 0.6 };
  const todayKo = { ko: "신해", stemKo: "신", branchKo: "해" };

  test("모든 십신 × 관계 × 용신 조합에 금지어·전문용어가 없다", () => {
    const relations = [null, "육합", "삼합", "충", "복음"] as const;
    const yongsins = [null, "용신", "기신"] as const;
    for (const stem of STEMS) {
      const tenGod = getTenGod("丙", stem);
      for (const relation of relations) {
        for (const yongsin of yongsins) {
          const t = templateText({ tenGod, relation, yongsin }, personal, todayKo);
          const all = [t.headline, t.body, t.do, t.dont].join(" ");
          expect(findBanned(all), all).toEqual([]);
          expect(all).toMatch(/(어요|해요|돼요|예요)\.?/);
          expect(t.headline.length).toBeLessThanOrEqual(22);
        }
      }
    }
  });

  test("영역 줄: 7영역 × 3신호 모두 금지어 없음, 신호 있는 영역만 줄이 생긴다", () => {
    const areas: AreaName[] = ["대인", "재물", "직업", "학업", "연애", "가족", "건강"];
    const signals: AreaSignal[] = ["↑", "→", "↓"];
    const t = templateText({ tenGod: "정재", relation: null, yongsin: null, areas: areas.flatMap((area) => signals.map((signal) => ({ area, signal }))) }, personal, todayKo);
    expect(t.areas).toHaveLength(21);
    for (const a of t.areas!) {
      expect(findBanned(a.line), a.line).toEqual([]);
      expect(a.line).toMatch(/요\.$/);
    }
    expect(templateText({ tenGod: "정재", relation: null, yongsin: null }, personal, todayKo).areas).toBeUndefined();
  });

  test("v4 core → 템플릿 재료: 일지 관계와 합계 방향", () => {
    const r = v4(PROFILE_A, "2026-06-15"); // 庚申: 일지 寅申충(유리), 용·용 → 용신
    const ti = templateInputFromCore(r);
    expect(ti).toMatchObject({ tenGod: "편재", relation: "충", yongsin: "용신" });
    expect(ti.areas).toEqual(r.areas);
    const bad = computeCoreFortune({ pillars: pillarsOf(PROFILE_B), profile: PROFILE_B, date: "2026-10-05", todayHanja: "壬寅" });
    expect(templateInputFromCore(bad)).toMatchObject({ relation: "복음", yongsin: "기신" });
    const t = templateText(ti, personal, todayKo);
    expect(t.areas!.map((a) => a.area)).toEqual(r.areas.map((a) => a.area));
  });

  test("기록이 있으면 본문에 내 기록 문장이 들어간다", () => {
    const t = templateText({ tenGod: "정재", relation: "육합", yongsin: null }, { n: 2, mean: 6.5, sameGanjiCount: 0, sameGanjiMean: null, weight: 0.29, score: 0.6 }, todayKo);
    expect(t.body).toContain("2번 기록");
  });
});

describe("3단계 brief", () => {
  const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
  const base = (personal: BriefInput["personal"]): BriefInput => ({ core: v4(PROFILE_A, "2026-06-15"), personal, today, date: "2026-06-15", weekday: "월요일", score10: 9.2, band: "좋음" });
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };

  test("한자·십신 괄호를 뗀 사실, 영역·키워드·금지어·허용 숫자가 들어간다", () => {
    const b = buildBrief(base(NONE));
    expect(hanjaToKo("丙午")).toBe("병오");
    expect(plainFact("오늘 윗글자 庚은 나에게 '기회'(편재) 쪽이에요.")).toBe("오늘 윗글자 경은 나에게 '기회' 쪽이에요.");
    for (const f of b.facts) {
      expect(f).not.toMatch(/[㐀-鿿]/);
      expect(f).not.toMatch(/\((비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)\)/);
    }
    expect(b.areas.map((a) => a.area)).toEqual(["재물", "연애", "대인"]);
    expect(b.areas[0]).toMatchObject({ word: "돈", signal: "↑" });
    expect(b.keywords.positive).toContain("무대가 넓어짐");
    expect(b.banned).toContain("기운");
    expect(b.banned).toContain("반드시");
    expect(b.jargon).toContain("용신");
    expect(b.allowedNumbers).toEqual(expect.arrayContaining([2026, 6, 15, 9.2, 10]));
    expect(b.today).toEqual({ date: "2026-06-15", weekday: "월요일", ganji: "경신일" });
  });

  test("기록이 없으면 mine이 null이고 기록 이야기를 금지한다", () => {
    const b = buildBrief(base(NONE));
    expect(b.personal).toBeNull();
    expect(b.mine).toBeNull();
    expect(b.rules.mine).toContain("하지 않기");
  });

  test("기록이 있으면 내 숫자 한 문장 재료가 들어가고 그 숫자가 허용된다 (같은 60갑자 우선)", () => {
    const b = buildBrief(base({ n: 12, mean: 6.8, sameGanjiCount: 2, sameGanjiMean: 7.5, weight: 0.71, score: 0.6 }));
    expect(b.mine).toBe("지난 경신일에 2번 기록했고 평균 7.5점이었어요");
    expect(b.rules.mine).toContain("꼭 넣기");
    expect(b.allowedNumbers).toEqual(expect.arrayContaining([2, 7.5]));
    const b2 = buildBrief(base({ n: 5, mean: 8, sameGanjiCount: 0, sameGanjiMean: null, weight: 0.5, score: 0.6 }));
    expect(b2.mine).toBe("경이나 신이 든 날에 5번 기록했고 평균 8점이었어요");
    expect(b2.allowedNumbers).toEqual(expect.arrayContaining([5, 8]));
    expect(JSON.stringify(b2).length).toBeLessThan(4000);
  });
});

describe("3단계 검사 (validate)", () => {
  const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
  const core = v4(PROFILE_A, "2026-06-15"); // 庚申: 재물↑ 연애↑ 대인↑
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
  const briefOf = (personal: BriefInput["personal"]) => buildBrief({ core, personal, today, date: "2026-06-15", weekday: "월요일", score10: 9.2, band: "좋음" });
  const brief = briefOf({ n: 5, mean: 8, sameGanjiCount: 0, sameGanjiMean: null, weight: 0.5, score: 0.6 });
  const OK: ModelText = {
    headline: "제안이 눈에 들어오는 월요일",
    body: "아침에 메일함을 열면 미뤄 둔 제안 하나가 다시 눈에 들어와요. 오늘 글자는 내 사주에 모자란 쪽을 채워 주는 쪽이라 평소보다 힘이 덜 들어요. 경이나 신이 든 날에 5번 기록했고 평균 8점이었어요. 다만 내 태어난 날 글자와 부딪히는 날이라 예정이 한 번쯤 틀어질 수 있어요. 저녁엔 들어온 제안을 적어 두고 하루 묵히는 쪽이 편해요.",
    areas: [
      { area: "재물", line: "돈 쓰는 일은 계획대로 가요." },
      { area: "연애", line: "가까운 사람에게 마음을 보이기 좋아요." },
      { area: "대인", line: "먼저 연락해도 순하게 이어져요." },
    ],
    do: "들어온 제안은 적어 두고 하루 묵혀요.",
    dont: "충동 지출을 하지 않아요.",
  };

  test("통과 예: 사유 없음", () => {
    expect(validateFortuneText(OK, brief)).toEqual([]);
  });

  test("금지어·전문용어·명령조·이모지", () => {
    const r = validateFortuneText({ ...OK, body: OK.body.replace("힘이 덜 들어요", "기운이 좋아요") }, brief);
    expect(r.some((x) => x.includes('금지어 "기운"'))).toBe(true);
    expect(validateFortuneText({ ...OK, headline: "용신이 들어오는 날" }, brief).some((x) => x.includes("전문용어"))).toBe(true);
    expect(validateFortuneText({ ...OK, do: "제안은 적어 두세요." }, brief).some((x) => x.includes("명령조"))).toBe(true);
    expect(validateFortuneText({ ...OK, headline: "좋은 날 ✨" }, brief).some((x) => x.includes("이모지"))).toBe(true);
    // "상관없어요", "힘이 드는 편인 병오", "고른 편인데"는 일상어 (실제 샘플에서 걸렸던 거짓 양성)
    expect(validateFortuneText({ ...OK, dont: "작은 실수는 상관없어요." }, brief)).toEqual([]);
    expect(validateFortuneText({ ...OK, dont: "올해 운은 힘이 드는 편인 병오라 서두르지 않아요." }, brief)).toEqual([]);
    expect(validateFortuneText({ ...OK, dont: "속도가 고른 편인데 서두르지 않아요." }, brief)).toEqual([]);
    expect(validateFortuneText({ ...OK, dont: "편인 글자를 믿지 않아요." }, brief).some((x) => x.includes('전문용어 "편인"'))).toBe(true);
    expect(validateFortuneText({ ...OK, body: OK.body.replace("힘이 덜 들어요", "올해의 큰 흐름은 힘이 드는 쪽이에요") }, brief).some((x) => x.includes('금지어 "흐름"'))).toBe(true);
  });

  test("숫자 날조: brief에 없는 숫자 / 내 숫자 문장 빠짐", () => {
    const r = validateFortuneText({ ...OK, do: "30분만 혼자 있는 시간을 만들어요." }, brief);
    expect(r).toEqual(expect.arrayContaining([expect.stringContaining("사실에 없는 숫자 30")]));
    const r2 = validateFortuneText({ ...OK, body: OK.body.replace("경이나 신이 든 날에 5번 기록했고 평균 8점이었어요. ", "") }, brief);
    expect(r2.some((x) => x.includes("내 숫자 문장 없음"))).toBe(true);
  });

  test("영역 불일치: 개수·순서·줄 문장 수", () => {
    expect(validateFortuneText({ ...OK, areas: OK.areas.slice(0, 2) }, brief).some((x) => x.startsWith("areas 불일치"))).toBe(true);
    expect(validateFortuneText({ ...OK, areas: [OK.areas[1]!, OK.areas[0]!, OK.areas[2]!] }, brief).some((x) => x.startsWith("areas 불일치"))).toBe(true);
    expect(validateFortuneText({ ...OK, areas: OK.areas.map((a) => ({ ...a, line: "한 문장이에요. 두 문장이에요." })) }, brief).some((x) => x.includes("1문장"))).toBe(true);
  });

  test("문장 수: 본문 3문장 또는 7문장은 탈락", () => {
    const three = "아침에 메일함을 열어요. 경이나 신이 든 날에 5번 기록했고 평균 8점이었어요. 저녁엔 제안을 묵혀요.";
    expect(validateFortuneText({ ...OK, body: three }, brief)).toEqual(expect.arrayContaining([expect.stringContaining("본문 3문장")]));
    const seven = OK.body + " 하나 더요. 또 하나 더요.";
    expect(validateFortuneText({ ...OK, body: seven }, brief)).toEqual(expect.arrayContaining([expect.stringContaining("본문 7문장")]));
  });

  test("기간 약속 · 기록 없는데 기록 언급 · 한자", () => {
    expect(validateFortuneText({ ...OK, dont: "3일 더 쓰면 달라져요." }, brief).some((x) => x.includes("기간 약속"))).toBe(true);
    expect(validateFortuneText({ ...OK, headline: "庚申의 아침" }, brief).some((x) => x.includes("한자"))).toBe(true);
    const r = validateFortuneText(OK, briefOf(NONE));
    expect(r.some((x) => x.includes("기록이 없는데"))).toBe(true);
    expect(r.some((x) => x.includes("사실에 없는 숫자"))).toBe(true);
  });

  test("템플릿 문장은 금지어·전문용어 검사를 통과한다 (문장 수만 다름)", () => {
    const t = templateText(templateInputFromCore(core), NONE, today);
    const r = validateFortuneText({ headline: t.headline, body: t.body, areas: (t.areas ?? []).map((a) => ({ area: a.area, line: a.line })), do: t.do, dont: t.dont }, briefOf(NONE));
    expect(r.filter((x) => !x.startsWith("본문"))).toEqual([]);
  });
});

describe("3단계 파이프라인 (모델은 가짜)", () => {
  const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
  const input: BriefInput = { core: v4(PROFILE_A, "2026-06-15"), personal: NONE, today, date: "2026-06-15", weekday: "월요일", score10: 9.2, band: "좋음" };
  const fallback = templateText(templateInputFromCore(input.core), input.personal, today);
  const good: ModelText = {
    headline: "제안이 눈에 들어오는 월요일",
    body: "아침에 메일함을 열면 미뤄 둔 제안 하나가 다시 눈에 들어와요. 오늘 글자는 내 사주에 모자란 쪽을 채워 주는 쪽이라 평소보다 힘이 덜 들어요. 다만 내 태어난 날 글자와 부딪히는 날이라 예정이 한 번쯤 틀어질 수 있어요. 저녁엔 들어온 제안을 적어 두고 하루 묵히는 쪽이 편해요.",
    areas: [{ area: "재물", line: "돈 쓰는 일은 계획대로 가요." }, { area: "연애", line: "가까운 사람에게 마음을 보이기 좋아요." }, { area: "대인", line: "먼저 연락해도 순하게 이어져요." }],
    do: "들어온 제안은 적어 두고 하루 묵혀요.",
    dont: "충동 지출을 하지 않아요.",
  };
  const fakeClient = (answers: ModelText[]) => {
    const calls: unknown[] = [];
    const client = {
      messages: {
        create: async (params: unknown) => {
          calls.push(params);
          const a = answers[calls.length - 1]!;
          return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(a) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
        },
      },
    };
    return { client: client as never, calls };
  };

  test("첫 글이 통과하면 llm, attempts 1, 영역 줄은 모델 것 + brief의 신호, 요청 모양", async () => {
    const { client, calls } = fakeClient([good]);
    const r = await generateFortuneText(input, fallback, { client, model: "claude-sonnet-5" });
    expect(r.source).toBe("llm");
    expect(r.attempts).toBe(1);
    expect(r.model).toBe("claude-sonnet-5");
    expect(r.text.areas).toEqual([
      { area: "재물", signal: "↑", line: "돈 쓰는 일은 계획대로 가요." },
      { area: "연애", signal: "↑", line: "가까운 사람에게 마음을 보이기 좋아요." },
      { area: "대인", signal: "↑", line: "먼저 연락해도 순하게 이어져요." },
    ]);
    const p = calls[0] as { model: string; temperature?: unknown; max_tokens: number; thinking: unknown; output_config: { effort: string; format: { type: string; schema: unknown } }; system: { cache_control: unknown }[]; messages: { role: string }[] };
    expect(p.model).toBe("claude-sonnet-5");
    expect(p.max_tokens).toBe(2048);
    expect(p.temperature).toBeUndefined();
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p.output_config.effort).toBe("low");
    expect(p.output_config.format).toEqual({ type: "json_schema", schema: OUTPUT_SCHEMA });
    expect(p.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages.map((m) => m.role)).toEqual(["user"]); // prefill 없음
  });

  test("탈락 → 재작성 1회 통과: attempts 2, 재작성 요청에 이전 글과 사유가 붙는다", async () => {
    const bad = { ...good, headline: "기운이 좋은 날" };
    const { client, calls } = fakeClient([bad, good]);
    const r = await generateFortuneText(input, fallback, { client });
    expect(r.source).toBe("llm");
    expect(r.attempts).toBe(2);
    expect(r.issues[0]).toEqual(expect.arrayContaining([expect.stringContaining("기운")]));
    expect(r.issues[1]).toEqual([]);
    const second = calls[1] as { messages: { content: string }[] };
    expect(second.messages[0]!.content).toContain("[재작성]");
    expect(second.messages[0]!.content).toContain("기운이 좋은 날");
    expect(second.messages[0]!.content).toContain('금지어 "기운"');
  });

  test("두 번 탈락 → 템플릿, attempts 2, model null", async () => {
    const bad = { ...good, headline: "기운이 좋은 날" };
    const { client } = fakeClient([bad, bad]);
    const r = await generateFortuneText(input, fallback, { client });
    expect(r.source).toBe("template");
    expect(r.attempts).toBe(2);
    expect(r.model).toBeNull();
    expect(r.text).toEqual(fallback);
  });

  test("refusal이면 바로 템플릿", async () => {
    const client = { messages: { create: async () => ({ stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }) } } as never;
    const r = await generateFortuneText(input, fallback, { client });
    expect(r).toMatchObject({ source: "template", attempts: 1, model: null });
    expect(r.issues[0]![0]).toContain("refusal");
  });

  test("키가 없으면 모델을 부르지 않고 템플릿", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await generateFortuneText(input, fallback);
      expect(r).toMatchObject({ source: "template", attempts: 0, model: null });
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});

describe("운세 캐시 쓰기 (중복 키)", () => {
  const row = { user_id: null, guest_key: "g1", fortune_date: "2026-10-05", profile_fingerprint: "fp2", score: 6.5, content: {}, model: null };
  const owner = { guestKey: "g1" } as const;
  /** 가짜 supabase: insert가 중복 키를 내게 할 수 있다 */
  const fakeDb = (opts: { dupOnInsert: boolean; existingId: string | null }) => {
    const log: string[] = [];
    const db = {
      from: () => ({
        insert: async () => { log.push("insert"); return opts.dupOnInsert ? { error: { code: "23505", message: 'duplicate key value violates unique constraint "night_fortunes_guest_date_uq"' } } : { error: null }; },
        update: () => ({ eq: async (_c: string, id: string) => { log.push(`update:${id}`); return { error: null }; } }),
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => { log.push("select"); return { data: opts.existingId ? { id: opts.existingId } : null, error: null }; } }) }) }),
      }),
    };
    return { db: db as never, log };
  };

  test("기존 행이 있으면(지문만 바뀜) update", async () => {
    const { db, log } = fakeDb({ dupOnInsert: false, existingId: "a" });
    expect(await saveFortuneCache(db, owner, row, "a")).toEqual({ path: "update", error: null });
    expect(log).toEqual(["update:a"]);
  });

  test("없으면 insert", async () => {
    const { db, log } = fakeDb({ dupOnInsert: false, existingId: null });
    expect(await saveFortuneCache(db, owner, row, null)).toEqual({ path: "insert", error: null });
    expect(log).toEqual(["insert"]);
  });

  test("insert가 중복 키면(동시 요청) 그 행을 찾아 update — 오류로 끝나지 않는다", async () => {
    const { db, log } = fakeDb({ dupOnInsert: true, existingId: "b" });
    expect(await saveFortuneCache(db, owner, row, null)).toEqual({ path: "insert→update", error: null });
    expect(log).toEqual(["insert", "select", "update:b"]);
  });

  test("ownerFilter: 사용자는 user_id, 게스트는 guest_key", () => {
    expect(ownerFilter({ userId: "u" })).toEqual({ col: "user_id", val: "u" });
    expect(ownerFilter({ guestKey: "g" })).toEqual({ col: "guest_key", val: "g" });
  });
});

import { validateFortuneText as _validateForJijiCheck } from "@/lib/fortune/validate";
test("검사기: '-지지 않' 꼴은 전문용어 '지지'로 잡지 않는다", () => {
  const anyIssues = (text: string) =>
    _validateForJijiCheck(
      { headline: "차분한 날", body: text, areas: [], do: "작게 시작해요.", dont: "서두르지 않아요." },
      { jargon: ["지지", "천간"], banned: [], allowedNumbers: [], areas: [], mine: null, maxBody: 420 } as never,
    ).filter((i: string) => i.includes("지지"));
  expect(anyIssues("오늘은 마음이 한곳으로 모이지지 않아요. 저녁엔 쉬어요. 밤엔 돌아봐요. 그래도 괜찮아요.")).toEqual([]);
  expect(anyIssues("오늘 지지가 내 글자와 부딪혀요. 저녁엔 쉬어요. 밤엔 돌아봐요. 그래도 괜찮아요.").length).toBeGreaterThan(0);
});
