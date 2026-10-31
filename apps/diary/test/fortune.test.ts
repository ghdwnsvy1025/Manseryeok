import { describe, expect, test } from "vitest";
import { STEMS, getTenGod, solarTermsOfYear } from "@saju/engine";
import { fromBirth, toCorePillars } from "@saju/core-rules";
import { branchRelation, computeBaseFortune, FAMILY_OF } from "@/lib/fortune/base";
import { COEF, computeCoreFortune, ipchunDate, resolveYongsin, seunOf, toBirthInput, UNKNOWN_HOUR_MIN } from "@/lib/fortune/core";
import { buildBrief, hanjaToKo, hasContextFact, plainFact, renderBrief, type BriefInput } from "@/lib/fortune/brief";
import { ownerFilter, saveFortuneCache } from "@/lib/fortune/cache";
import { REGEN_LIMIT, TRANSIENT_RETRY_MS, regenCountOf, regenPolicy, retryAfterFor, usableCachedContent } from "@/lib/fortune/policy";
import { solarTermOf, termDayWord } from "@/lib/fortune/solarTerms";
import { ABSTRACT_RE, AREA_OVERLAP_MAX, SHENG_KE_RE, STRUCTURE_WORDS, tokenOverlap, validateFortuneText, type Draft } from "@/lib/fortune/validate";
import { adjustWithEntries, bandOf, fitPercent, happinessToScore, toTenPoint } from "@/lib/fortune/personal";
import { BANNED, findBanned, templateInputFromCore, templateText } from "@/lib/fortune/text";
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
// v4.1 보강의 계기가 된 사주: 1995-10-25 14:00 남 → 乙亥 丙戌 己丑 辛未. 2026-10-07 甲寅일은 천간·지지 모두 정관 = 한신
// v4.2 (코어 240c91d 동기화): 비겁 중심 신강이라 Y-12로 관성 운이 희신급 → 甲寅일은 "유리"(코어 규칙 우선)
// v4.18 (코어 4f795ca 동기화): 원국 지지에 비겁(丑·未·戌)이 셋이라 Y-15로 지지 寅(관성) 점수 절반 1 → 0.5. 판정 "유리"는 그대로
const PROFILE_C: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 10, birthDay: 25, birthHour: 14, birthMinute: 0, city: "seoul" };

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
  // 2026-10-07 v4.1 갱신: ③ ctx에 대운·세운 판정(×0.2, ×0.15)이 더해져 점수가 움직였고(B는 대운 戊辰/己巳이 유리라 +1), ① 한·한 일진(A 壬子 = 편관·정관, B 庚申 = 편관·편관)은 판정 "보통",
  // ② 한신 영역이 "→"로 올라왔다(A 壬子 직업→, B 庚申 직업→·연애→, B 己酉 직업→).
  // 2026-10-10 v4.5: 0.5 아래는 tanh 곡선(lowAmp 0.38) — 낮은 점수만 조금 올라간다(A 甲午 3.5→3.6, B 壬子 2.6→2.9). 위쪽은 그대로.
  // 2026-10-07 v4.2 갱신(코어 240c91d): Y-12 — A(己巳 丙子 丙寅 甲午, 비겁 중심 신강)의 관성(수) 운이 한신 0.5 → 희신급 1. A 壬子 한·한이 "유리"·직업↑, A 대운 癸酉 2.75 → 3.5, 세운 乙巳 등 수 글자 점수 ↑. B(중화)는 변화 없음.
  // 2026-10-07 v4.2 합 점수 삭제: rel에는 충만 남고 합(육합·삼합·반합)·운 지지 합(union)은 0 → A 甲午 3.3→3.5(반합 寅午 제거), A 己酉 8.1→7.9(반합 巳酉 +0.25 제거), B 壬子 3.1→2.6(육합 子丑 +0.5·월운 합 제거), B 甲午 4.1→3.9, B 己酉 9.2→9.1, B 庚申 8.5→8.3.
  //   영역은 오늘(일운 ≤2) → 이달(월운 1) → 올해(세운 1)로 최대 4개, period가 붙는다.
  // 2026-10-31 v4.18 갱신(코어 4f795ca + 세력 방식 정기연속80엔진20): B 庚申 8.3→8 — 운 천간 庚이 원국 월간 乙(비겁)과 乙庚합이라 카드 013으로 천간 점수 절반(0.75 → 0.375). 나머지 9건은 그대로.
  const CASES: { prof: BirthProfile; date: string; ganji: string; score: number; band: string; total: string; areas: string[] }[] = [
    { prof: PROFILE_A, date: "2026-10-05", ganji: "壬子", score: 7.5, band: "좋음", total: "유리", areas: ["오늘:직업↑", "이달:연애↑", "올해:대인↓"] },
    { prof: PROFILE_A, date: "2026-01-20", ganji: "甲午", score: 3.6, band: "주의", total: "어려움", areas: ["오늘:대인↓", "오늘:재물↓", "이달:직업↑", "올해:대인↓"] },
    { prof: PROFILE_A, date: "2026-02-04", ganji: "己酉", score: 7.9, band: "좋음", total: "매우 유리", areas: ["오늘:재물↑", "오늘:연애↑", "이달:재물↑", "올해:대인↓"] },
    { prof: PROFILE_A, date: "2026-06-15", ganji: "庚申", score: 9.2, band: "좋음", total: "매우 유리", areas: ["오늘:재물↑", "오늘:연애↑", "이달:대인↓", "올해:대인↓"] },
    { prof: PROFILE_A, date: "2027-03-01", ganji: "己卯", score: 4.8, band: "무난", total: "유리", areas: ["오늘:직업↑", "오늘:가족↓", "이달:직업↑", "올해:대인↓"] },
    { prof: PROFILE_B, date: "2026-10-05", ganji: "壬子", score: 2.9, band: "주의", total: "주의", areas: ["오늘:학업↓", "오늘:가족↓", "이달:직업↑", "올해:직업↑"] },
    { prof: PROFILE_B, date: "2026-01-20", ganji: "甲午", score: 3.9, band: "주의", total: "주의", areas: ["오늘:대인↓", "오늘:재물↓", "이달:재물↑", "올해:대인↓"] },
    { prof: PROFILE_B, date: "2026-02-04", ganji: "己酉", score: 9.1, band: "좋음", total: "매우 유리", areas: ["오늘:재물↑", "오늘:대인↑", "이달:대인↓", "올해:직업↑"] },
    { prof: PROFILE_B, date: "2026-06-15", ganji: "庚申", score: 8, band: "좋음", total: "보통", areas: ["오늘:직업→", "오늘:연애→", "이달:대인↓", "올해:직업↑"] },
    { prof: PROFILE_B, date: "2027-03-01", ganji: "己卯", score: 7.4, band: "좋음", total: "유리", areas: ["오늘:재물↑", "오늘:대인↑", "이달:대인↓", "올해:재물↑"] },
  ];
  for (const c of CASES) {
    test(`${c.prof === PROFILE_A ? "A" : "B"} ${c.date} ${c.ganji} → ${c.score} ${c.band}`, () => {
      expect(dayGanji(c.date).hanja).toBe(c.ganji);
      const r = v4(c.prof, c.date);
      expect(score10(r)).toBe(c.score);
      expect(bandOf(score10(r))).toBe(c.band);
      expect(r.dayLuck.total).toBe(c.total);
      expect(r.areas.map((a) => `${a.period}:${a.area}${a.signal}`)).toEqual(c.areas);
      expect(r.areas.length).toBeLessThanOrEqual(4);
      expect(r.areas.filter((a) => a.period === "오늘").length).toBeLessThanOrEqual(2);
      expect(r.areas.filter((a) => a.period === "이달").length).toBeLessThanOrEqual(1);
      expect(r.areas.filter((a) => a.period === "올해").length).toBeLessThanOrEqual(1);
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

  test("대운 충 플래그: A의 대운 癸酉 × 己卯일 → 최고경보, ctx −1.2 (+ v4.1 판정 몫: 대운 3.5×0.2, 세운 −2×0.15) — v4.2: 酉 아닌 癸(관성)가 Y-12로 희신급이라 2.75 → 3.5", () => {
    const r = v4(PROFILE_A, "2027-03-01");
    expect(r.context.daeun).toMatchObject({ 간지: "癸酉", 합계: 3.5, clash: { 강도: 3, 최고경보: true } });
    expect(r.context.daeun?.플래그).toEqual(expect.arrayContaining([expect.stringContaining("(Y-12)")]));
    expect(r.context.seun.합계).toBe(-2);
    expect(r.parts.ctx).toBe(-0.8);
    expect(r.facts.some((f) => f.includes("10년 단위 운") && f.includes("어긋나"))).toBe(true);
  });

  test("세운 충: 丙午년 × 壬子일 → 세운 clash, ctx −0.5 (+ v4.1 판정 몫: 대운 3.5×0.2, 세운 −5×0.15)", () => {
    const r = v4(PROFILE_A, "2026-10-05");
    expect(r.context.seun).toMatchObject({ 간지: "丙午", 합계: -5, clash: { 강도: 3, 최고경보: true } });
    expect(r.parts.ctx).toBe(-0.55);
  });

  test("점수 분해: score01 = 0.5 + (raw + rel + ctx) / 12 (범위 안)", () => {
    for (const c of CASES) {
      const r = v4(c.prof, c.date);
      const expected = Math.max(0.12, Math.min(0.92, 0.5 + (r.parts.raw + r.parts.rel + r.parts.ctx) / 12));
      expect(r.parts.score01).toBeCloseTo(expected, 1); // parts는 소수 2자리로 반올림돼 있다
    }
  });
});

describe("v4.1 보강 (乙亥 丙戌 己丑 辛未 × 2026-10-07 甲寅: 천간·지지 모두 정관 = 한신) + v4.2 코어 Y-12(비겁 중심 신강의 관성 운 = 희신급)", () => {
  const r = v4(PROFILE_C, "2026-10-07");

  test("원국·일진 전제 — 라벨은 한신 그대로, 점수는 코어가 희신급(천간 1×1.5, 지지 1)으로 올림 (Y-12)", () => {
    expect(toCorePillars(pillarsOf(PROFILE_C))).toEqual(["乙亥", "丙戌", "己丑", "辛未"]);
    expect(dayGanji("2026-10-07").hanja).toBe("甲寅");
    expect(r.dayLuck.stem).toMatchObject({ tenGod: "정관", label: "한", score: 1.5 });
    expect(r.dayLuck.branch).toMatchObject({ tenGod: "정관", label: "한", score: 0.5 }); // v4.18: Y-15 지지 비겁 셋을 누르느라 절반
    expect(r.relations.flags).toContain("운 寅 관성: 지지 비겁 3개를 누르느라 부담 — 극당하는 재성보단 덜 위험, 점수 절반 (Y-15)");
    expect(r.dayLuck.method).toBe("라벨 점수");
    expect(r.relations.flags).toContain("관성은 보조 용신 — 희신급으로 셈 (Y-12)");
  });

  test("① 한·한이어도 코어가 올린(Y-12) 한신이면 코어 판정 그대로(유리) — 문장은 희신 말. 순수 한·한(B 庚申)은 여전히 보통", () => {
    expect(r.dayLuck.raw).toBe(2); // v4.18: 1.5 + 0.5 (Y-15)
    expect(r.dayLuck.total).toBe("유리");
    expect(r.facts).toContain("둘을 합치면 오늘은 수월한 편이에요.");
    // v4.2: "위아래" 문장은 없다. 같은 십신이면 구조 없는 한 문장 — v4.3: "두 번 겹쳐요" → "아주 강해요"
    expect(r.facts[0]).toBe("오늘은 '약속과 역할'(정관)의 성격이 아주 강해요.");
    expect(r.facts.some((f) => f.includes("겹"))).toBe(false);
    expect(r.facts.some((f) => f.includes("위아래"))).toBe(false);
    expect(r.facts.filter((f) => f.includes("을 옆에서 거들어 줘요"))).toHaveLength(1); // v4.9: 무엇이 부족한지 이름을 댄다
    expect(r.facts.some((f) => f.includes("기울지 않고"))).toBe(false);
    expect(r.facts.some((f) => f.includes("크게 영향을 주지 않아요"))).toBe(false);
    // 코어가 올리지 않은 한·한(B 중화 사주, 2026-06-15 庚申 편관·편관)은 v4.1 ① 그대로 "보통"
    const pure = v4(PROFILE_B, "2026-06-15");
    expect([pure.dayLuck.stem.label, pure.dayLuck.branch.label]).toEqual(["한", "한"]);
    expect(pure.dayLuck.raw).toBe(0.875); // v4.18: 천간 庚이 월간 乙(비겁)과 합 → 카드 013 절반 (0.75 → 0.375) + 지지 0.5
    expect(pure.dayLuck.total).toBe("보통");
    // v4.5: 한신("기울지 않고 그 성격대로") 문장은 글 재료에서 뺐다
    expect(pure.facts.some((f) => f.includes("기울지 않고"))).toBe(false);
    // 한쪽만 한신이면 판정은 코어 그대로 (B 2026-02-04 己酉: 정재 용 + 정관 한 → 매우 유리)
    const half = v4(PROFILE_B, "2026-02-04");
    expect([half.dayLuck.stem.label, half.dayLuck.branch.label].filter((l) => l === "한")).toHaveLength(1);
    expect(half.dayLuck.total).toBe("매우 유리");
  });

  test("② 한신도 영역에 오르고 신호는 → (직업) — 코어가 올린(Y-12) 한신은 점수 그대로라 ↑. v4.2: 오늘 줄 뒤에 이달·올해 줄", () => {
    // v4.13: why도 무엇이 모자란지 이름을 댄다
    expect(r.areas[0]).toEqual({ period: "오늘", area: "직업", signal: "↑", why: expect.stringMatching(/^'약속과 역할'\(정관\) 쪽이 내게 모자란 .+힘을 거들어요$/) });
    expect(r.areas.map((a) => `${a.period}:${a.area}${a.signal}`)).toEqual(["오늘:직업↑", "이달:가족↓", "올해:학업↓"]);
    const todayOf = (c: CoreFortune) => c.areas.filter((a) => a.period === "오늘").map((a) => a.area + a.signal);
    expect(todayOf(v4(PROFILE_B, "2026-06-15"))).toEqual(["직업→", "연애→"]);
    // 한신은 합산에 0으로 들어가 ↑·↓를 만들지 않는다: B 2026-02-04 己酉(용 + 한) → 재물↑ 대인↑ (오늘은 최대 2라 직업→는 빠진다)
    expect(todayOf(v4(PROFILE_B, "2026-02-04"))).toEqual(["재물↑", "대인↑"]);
  });

  test("③ ctx = 대운 판정 × 0.2 + 세운 판정 × 0.15 (월운은 0), 월운·대운 플래그 문장은 contextFacts에 항상 (v4.4: facts에는 평일엔 없음)", () => {
    expect(COEF.daeunVerdict).toBe(0.2);
    expect(COEF.seunVerdict).toBe(0.15);
    expect(r.context.daeun).toMatchObject({ 간지: "癸未", 판정: "유리", 합계: 1 });
    expect(r.context.seun).toMatchObject({ 간지: "丙午", 판정: "주의", 합계: -2.5 });
    expect(r.context.wolun).toMatchObject({ 간지: "丁酉", 판정: "주의", 합계: -0.5 });
    expect(r.context.daeun?.clash ?? r.context.seun.clash ?? r.context.wolun?.clash).toBeUndefined();
    expect(r.parts.ctx).toBe(-0.17); // 1×0.2 + (−2.5)×0.15 = −0.175 → 소수 2자리 (월운 −0.5는 0)
    expect(r.parts.score01).toBe(0.65); // v4.2: raw 1.25 → 2.5 (Y-12), 寅亥 육합 +0.5는 합 점수 삭제로 0 (0.74 → 0.69). v4.18: raw 2 (Y-15) → 0.65
    expect(r.context.daeun?.플래그).toEqual(expect.arrayContaining([expect.stringContaining("용신 손상"), expect.stringContaining("개두")]));
    // v4.4: 2026-10-07(추분 보름째, 충 없음)은 평일 — 맥락 문장은 contextFacts에만
    expect(r.contextFacts).toEqual([
      "지금 10년 단위 운 癸未은 수월한 편이에요.",
      expect.stringMatching(/^지금 10년 단위 운은 내게 모자란 .+힘이 더 약해지는 때예요\.$/), // v4.13: "누르고"(생·극 말) 대신
      "지금 10년 단위 운은 겉과 속이 달라요.",
      "올해 운 丙午은 조심할 편이에요.",
      "이달 운 丁酉은 조심할 편이에요.",
    ]);
    expect(hasContextFact(r.facts)).toBe(false);
    expect(r.facts.some((f) => f.includes("10년 단위 운"))).toBe(false);
    expect(r.facts.length).toBeLessThanOrEqual(10);
    // 월운 플래그(절각)는 문장이 되지 않는다
    expect(r.contextFacts.some((f) => f.includes("이달") && f.includes("겉과 속"))).toBe(false);
    // v4.12: 시간 모름(1985-05-03, 금 7/12)은 다수결 용신으로 판정 몫을 내되 일치율 7/12만큼 줄인다 (충 몫은 그대로)
    const lowY = v4({ ...PROFILE_A, birthYear: 1985, birthMonth: 5, birthDay: 3, birthHour: null, birthMinute: null }, "2026-06-15");
    expect(lowY.context.seun.합계).toBeDefined();
    const clashCtx = (lowY.context.daeun?.clash ? (lowY.context.daeun.clash.최고경보 ? COEF.daeunClashAlert : COEF.daeunClash) : 0) + (lowY.context.seun.clash ? COEF.seunClash : 0) + (lowY.context.wolun?.clash ? COEF.wolunClash : 0);
    const verdictCtx = ((lowY.context.daeun?.합계 ?? 0) * COEF.daeunVerdict + (lowY.context.seun.합계 ?? 0) * COEF.seunVerdict) * (7 / 12);
    expect(lowY.parts.ctx).toBeCloseTo(clashCtx + verdictCtx, 2);
  });
});

describe("v4.2 합은 점수 없이 플래그만 · 위아래 문장 없음 · 영역 기간", () => {
  // 1995-10-25 14:00 남 (乙亥 丙戌 己丑 辛未, 용신 수) × 2026-10-07 甲寅: 오늘 寅이 연지 亥(수 = 용신)와 육합 — v4.3: hits에만 남고 플래그·문장은 없다
  const c = v4(PROFILE_C, "2026-10-07");

  test("합(육합·삼합·반합)은 hits에 direction '중립'으로 남고 rel에는 들어가지 않는다 — 충만 rel", () => {
    expect(c.relations.hits).toEqual([{ pos: "연", kind: "육합", direction: "중립", strength: 1, chars: "寅亥" }]);
    expect(c.parts.rel).toBe(0);
    // 반합(A 2026-02-04 巳酉)도 0, 충이 있으면 충만 (A 2026-10-05: 子午충 유리 ×2 = +1, 월지 복음 0)
    const half = v4(PROFILE_A, "2026-02-04");
    expect(half.relations.hits.map((h) => h.kind)).toEqual(["반합"]);
    expect(half.parts.rel).toBe(0);
    const clash = v4(PROFILE_A, "2026-10-05");
    expect(clash.relations.hits.map((h) => [h.kind, h.direction])).toEqual([["충", "유리"], ["복음", "중립"]]);
    expect(clash.parts.rel).toBe(COEF.rel * 2);
    for (const r of [c, half, clash, v4(PROFILE_B, "2026-10-05")]) for (const h of r.relations.hits) if (h.kind !== "충") expect(h.direction).toBe("중립");
    // v4.12 시간 모름(일치율 7/12): 충은 방향 있는 값 × 7/12 + 방향 없는 값(강도 × −0.25) × 5/12
    const lowY = v4({ ...PROFILE_A, birthYear: 1985, birthMonth: 5, birthDay: 3, birthHour: null, birthMinute: null }, "2026-06-15");
    const ch = lowY.relations.hits.find((h) => h.kind === "충")!;
    const dir = ch.direction === "유리" ? COEF.rel * ch.strength : ch.direction === "불리" ? -COEF.rel * ch.strength : 0;
    expect(lowY.parts.rel).toBeCloseTo((7 / 12) * dir + (5 / 12) * -COEF.relNoYongsin * ch.strength, 2);
    // 운 지지 ↔ 오늘 지지 합(union)도 점수에 없다: ctx는 충 + 판정 몫뿐
    expect(c.parts.ctx).toBe(-0.17);
    expect("union" in COEF).toBe(false);
  });

  test("v4.3 (a) 합 묶임 판정 삭제: 오늘 寅 × 연지 亥(용신) 육합이어도 '용신 손상 … 묶음' 플래그와 '묶여…' 문장이 없다 (hits에는 남는다)", () => {
    expect(c.relations.hits.some((h) => h.kind === "육합")).toBe(true);
    expect(c.relations.flags.some((f) => f.includes("묶음"))).toBe(false);
    expect(c.facts.some((f) => /묶여|묶음/.test(f))).toBe(false); // 키워드 채움 문장의 '틀에 묶임'(KW)은 합 문장이 아니다
    // 용신 글자가 아닌 합(A 2026-06-15 申巳 육합)도 마찬가지
    const other = v4(PROFILE_A, "2026-06-15");
    expect(other.relations.hits.some((h) => h.kind === "육합")).toBe(true);
    expect(other.relations.flags.some((f) => f.includes("묶음"))).toBe(false);
    expect(other.facts.some((f) => /묶여|묶음/.test(f))).toBe(false);
  });

  test("v4.3 (b) 코어 '긴장이 풀리는 시기' 플래그는 flags에 남되 '누그러져요' 문장은 없다 (C 원국 丑未충 × 午일: 午가 未와 육합)", () => {
    const r = computeCoreFortune({ pillars: pillarsOf(PROFILE_C), profile: PROFILE_C, date: "2026-10-07", todayHanja: "丙午" });
    expect(r.relations.flags).toContain("긴장이 풀리는 시기: 운 午이 未와 합해 원국 丑未충을 늦춤");
    expect(r.facts.some((f) => f.includes("누그러"))).toBe(false);
    expect(r.parts.rel).toBe(0); // 육합은 점수 없음
    // 오늘 플래그 문장(절각 = 운 내부 상충)은 맥락 문장보다 앞이라 10문장 상한에 잘리지 않는다
    const full = computeCoreFortune({ pillars: pillarsOf(PROFILE_C), profile: PROFILE_C, date: "2026-10-07", todayHanja: "壬午" });
    // v4.8: 겉과 속 문장은 천간·지지가 용·기로 맞붙을 때만 (oppositeParts). 아니면 나오지 않는다
    const opposite = (full.dayLuck.stem.label === "용" && full.dayLuck.branch.label === "기") || (full.dayLuck.stem.label === "기" && full.dayLuck.branch.label === "용");
    expect(full.facts.includes("오늘은 겉과 속이 달라 힘이 한곳에 모이지 않아요.")).toBe(opposite);
    expect(full.facts.length).toBeLessThanOrEqual(10);
  });

  test("그 밖의 합 문장('짝이 돼요/한편이 돼요/한편이에요')과 '위아래' 문장은 어디에도 없다", () => {
    for (const prof of [PROFILE_A, PROFILE_B, PROFILE_C]) {
      const pillars = pillarsOf(prof);
      for (const date of ["2026-10-05", "2026-10-07", "2026-01-20", "2026-02-04", "2026-06-15", "2027-03-01", "2026-03-09", "2026-11-23"]) {
        const r = v4(prof, date, pillars);
        const all = r.facts.join(" ");
        // v4.3: 합 관련 문장("묶여/누그러져요")과 "두 번 겹쳐요"도 없다 (대운 충의 "변동이 겹치는 날"은 그대로)
        expect(all, `${date} ${all}`).not.toMatch(/짝이 돼요|한편이 돼요|한편이에요|도움을 받기 쉬운|위아래|윗글자|묶여|누그러|두 번 겹쳐요/);
        expect(r.facts[0]).toMatch(/^오늘은 '.+'\(.+\)(의 성격이 아주 강해요|[과와] '.+'\(.+\)[이가] 함께 와요)\.$/);
      }
    }
    // 십신이 다르면 "함께 와요" (A 2026-10-05 壬子: 편관 + 정관)
    expect(v4(PROFILE_A, "2026-10-05").facts[0]).toBe("오늘은 '압박과 책임'(편관)과 '약속과 역할'(정관)이 함께 와요.");
    // 운 내부 상충 문장도 "위아래" 없이 (v4.4: 근거용 contextFacts에)
    expect(c.contextFacts).toContain("지금 10년 단위 운은 겉과 속이 달라요.");
  });

  test("영역 period: 오늘(일운 ≤2) → 이달(월운 1) → 올해(세운 1), 모두 코어 luckAreas. 시간 모름도 다수결 용신으로 나온다 (v4.12)", () => {
    expect(c.areas).toEqual([
      { period: "오늘", area: "직업", signal: "↑", why: expect.stringMatching(/^'약속과 역할'\(정관\) 쪽이 내게 모자란 .+힘을 거들어요$/) },
      { period: "이달", area: "가족", signal: "↓", why: "'혼자 생각'(편인) 쪽이 지금 나와 맞지 않아요" },
      { period: "올해", area: "학업", signal: "↓", why: "'배움과 쉼'(정인) 쪽이 지금 나와 맞지 않아요" },
    ]);
    expect(c.context.wolun?.간지).toBe("丁酉"); // 丁 = 편인(가족·건강 ↓), 酉 = 식신
    expect(c.context.seun.간지).toBe("丙午"); // 丙 = 정인(학업 ↓), 午 = 편인
    const ORDER = ["오늘", "이달", "올해"];
    const periods = c.areas.map((a) => a.period);
    expect(periods).toEqual([...periods].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)));
    const lowY = v4({ ...PROFILE_A, birthYear: 1985, birthMonth: 5, birthDay: 3, birthHour: null, birthMinute: null }, "2026-06-15");
    expect(lowY.areas.length).toBeGreaterThan(0);
    // 템플릿 영역 줄에도 period가 실리고 문장엔 기간 접두가 없다
    const t = templateText(templateInputFromCore(c), { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 }, { ko: "갑인", stemKo: "갑", branchKo: "인" });
    expect(t.areas!.map((a) => a.period)).toEqual(["오늘", "이달", "올해"]);
    for (const a of t.areas!) expect(a.line).not.toMatch(/^(오늘|이달|올해)/);
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

  test("v4.12 용신이 10/12 미만이어도 다수결 용신을 쓰고 유불리 폭을 일치율만큼 줄인다 (1985-05-03 시간 모름: 금 7 / 수 5)", () => {
    const prof: BirthProfile = { ...PROFILE_A, birthYear: 1985, birthMonth: 5, birthDay: 3, birthHour: null, birthMinute: null };
    const pillars = pillarsOf(prof);
    const p = toCorePillars(pillars);
    const res = resolveYongsin(p, balance(p));
    expect(res.y?.용신오행).toBe("금");
    expect(res.votes).toBe(7);
    expect(res.agreement).toBeCloseTo(7 / 12);
    const r = v4(prof, "2026-06-15", pillars); // 庚申
    expect(r.dayLuck.method).toBe("라벨 점수");
    expect(r.dayLuck.agreement).toBeCloseTo(7 / 12);
    expect(r.dayLuck.stem.label).not.toBeNull();
    expect(r.caveats.some((c) => c.startsWith("시간 모름") && c.includes("58%"))).toBe(true);
    // 점수 분해: score01 = toScore01(raw × 7/12 + rel + ctx) — parts.raw는 줄인 값
    expect(r.parts.raw).toBeCloseTo(r.dayLuck.raw * (7 / 12), 2);
    // 개운은 근거가 확실할 때만(10/12 이상) — 여기서는 권하지 않는다
    expect(r.luckEls).toBeNull();
    // 안내 한 줄은 그대로
    expect(templateInputFromCore(r).fitNote).toBe("태어난 시간을 모르면 운세의 폭이 넓어져요.");
    const t = templateText(templateInputFromCore(r), { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: r.parts.score01 }, { ko: "경신", stemKo: "경", branchKo: "신" });
    expect(t.body).toContain("운세의 폭이 넓어져요");
  });

  test("v4.12 시간 모름 사용자도 점수가 날마다 움직인다 (예전: 1984-11-03 시간 모름이 30일 중 21일 5.0)", () => {
    const prof: BirthProfile = { ...PROFILE_A, gender: "female", birthYear: 1984, birthMonth: 11, birthDay: 3, birthHour: null, birthMinute: null };
    const pillars = pillarsOf(prof);
    const scores = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 9, 15 + i)).toISOString().slice(0, 10);
      return toTenPoint(v4(prof, d, pillars).parts.score01);
    });
    const most = Math.max(...Object.values(scores.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})));
    expect(new Set(scores).size).toBeGreaterThanOrEqual(10);
    expect(most).toBeLessThanOrEqual(8);
  });
});

describe("v4 글 재료 (facts·keywords)", () => {
  test("facts는 4~10문장(v4.4: 맥락 문장이 빠져 하한 6 → 4), contextFacts 3~5문장, 금지어 없음, 어미는 ~어요", () => {
    for (const prof of [PROFILE_A, PROFILE_B, PROFILE_C, { ...PROFILE_A, birthHour: null, birthMinute: null }]) {
      const pillars = pillarsOf(prof);
      for (const date of ["2026-10-05", "2026-01-20", "2026-02-04", "2026-06-15", "2027-03-01", "2026-03-09", "2026-11-23", "2026-10-07", "2026-10-08"]) {
        const r = v4(prof, date, pillars);
        expect(r.facts.length, date).toBeGreaterThanOrEqual(4);
        expect(r.facts.length, date).toBeLessThanOrEqual(10);
        expect(r.contextFacts.length, date).toBeGreaterThanOrEqual(3);
        expect(r.contextFacts.length, date).toBeLessThanOrEqual(5);
        expect(findBanned([...r.facts, ...r.contextFacts].join(" ")), r.facts.join("\n")).toEqual([]);
        for (const f of [...r.facts, ...r.contextFacts]) expect(f, date).toMatch(/요\.?$/);
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

  test("v4.19: 같은 성분 5일이면 w 0.5 — 점수는 전체 평균 대비 편차만큼(±0.08 안), 절대값을 섞지 않는다", () => {
    const same = Array.from({ length: 5 }, (_, i) => ({ day_ganji_index: i, day_stem: "신", day_branch: "자", happiness: 10 }));
    const others = Array.from({ length: 10 }, (_, i) => ({ day_ganji_index: 10 + i, day_stem: "갑", day_branch: "오", happiness: 9 }));
    const r = adjustWithEntries(0.4, [...same, ...others], today);
    expect(r.n).toBe(5);
    expect(r.weight).toBe(0.5);
    expect(r.overallMean).toBe(9.3);
    expect(r.shift).toBeCloseTo((0.5 * (10 - 28 / 3)) / 9, 3);
    expect(r.score).toBeCloseTo(0.4 + r.shift!, 5);
    // 기록이 5개뿐이면(10개 미만) 보정 없음
    expect(adjustWithEntries(0.4, same, today)).toMatchObject({ shift: 0, score: 0.4 });
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
          // v4.13: 템플릿도 추상어·생극 금칙을 지킨다
          expect(all, all).not.toMatch(ABSTRACT_RE);
          expect(all, all).not.toMatch(SHENG_KE_RE);
        }
      }
    }
  });

  test("v4.13 템플릿이 라벨을 본다: '구'·'기'인 날은 headline·do를 뒤집고, 이달 한 줄·오늘 기운 이름·맞는지 문장이 들어가며, 같은 영역 줄은 두 번 쓰지 않는다", () => {
    const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
    // A 2026-10-17 甲子: 편인 '구' + 정관 '한', 합계 −0.5 → 검수 §10 (2)에서 "혼자 있는 시간을 만들어요"라고 권하던 날
    const gu = v4(PROFILE_A, "2026-10-17");
    expect([gu.dayLuck.stem.label, gu.dayLuck.raw < 0]).toEqual(["구", true]);
    const ti = templateInputFromCore(gu);
    expect(ti).toMatchObject({ tenGod: "편인", role: "구", yongsin: "기신" });
    const t = templateText(ti, NONE, { ko: "갑자", stemKo: "갑", branchKo: "자" });
    expect(t.headline).toBe("혼자 생각이 길어지기 쉬운 날이에요");
    expect(t.do).toBe("혼자 끙끙대기보다 한마디 묻고 넘어가요.");
    expect(t.body).not.toContain("이달 무술월");   // v4.15: 이달 한 줄은 영역의 이달 줄로
    expect(t.body).not.toMatch(/편인|정관|맞지 않는 쪽/);   // v4.16: 템플릿도 사주 용어·판정 문장 없이
    expect(t.body).not.toContain("지금 나와 맞지 않는 쪽");   // v4.16: 판정 문장 없음
    expect(t.body).not.toContain("이미 많은 쪽"); // 옛 text.ts:149-150은 '구'를 '기신' 줄("이미 많은 쪽이 더해지는")로 보냈다
    // A 2026-10-15 壬戌: 식신 '희' → 그대로 + 이름 있는 판정 문장. 오늘 직업↑과 이달 직업↑이 같은 줄이 아니다 (검수 §10 (1))
    const hui = v4(PROFILE_A, "2026-10-15");
    const t2 = templateText(templateInputFromCore(hui), NONE, { ko: "임술", stemKo: "임", branchKo: "술" });
    expect(t2.headline).toBe("책임이 무겁게 느껴지는 날이에요");
    expect(t2.body).not.toContain("내게 모자란 금");   // v4.16: 판정 문장 없음
    const lines = t2.areas!.map((a) => a.line);
    expect(new Set(lines).size).toBe(lines.length);
    expect(t2.areas!.filter((a) => a.area === "직업").map((a) => a.line)).toEqual(["하던 일을 마무리하기 좋아요.", "손에 든 일에 힘이 실려요."]);
    // 용신 없는(v3) 경로: names 없이도 돌아간다
    const v3 = templateText({ tenGod: "편인", relation: null, yongsin: "기신" }, NONE, { ko: "갑자", stemKo: "갑", branchKo: "자" });
    expect(v3.headline).toBe("혼자 생각이 길어지기 쉬운 날이에요");
    expect(v3.body).not.toContain("이달");
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

  test("v4.17: 기록이 있어도 본문에 내 기록 숫자 문장을 넣지 않는다", () => {
    const t = templateText({ tenGod: "정재", relation: "육합", yongsin: null }, { n: 2, mean: 6.5, sameGanjiCount: 0, sameGanjiMean: null, weight: 0.29, score: 0.6 }, todayKo);
    expect(t.body).not.toMatch(/기록했|평균/);
  });
});

describe("3단계 brief (v4.19: 계획을 건네는 얇은 묶음)", () => {
  const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
  const base = (personal: BriefInput["personal"]): BriefInput => ({ core: v4(PROFILE_A, "2026-06-15"), personal, today, date: "2026-06-15", weekday: "월요일", score10: 9.2, band: "좋음" });
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };

  test("한자를 한글로 바꾼 사실(검사기용), 계획의 영역·금지어·허용 숫자가 들어간다", () => {
    const b = buildBrief(base(NONE));
    expect(hanjaToKo("丙午")).toBe("병오");
    expect(plainFact("오늘 윗글자 庚은 나에게 '기회'(편재) 쪽이에요.")).toBe("오늘 윗글자 경은 나에게 '기회'(편재) 쪽이에요.");
    for (const f of b.facts) expect(f).not.toMatch(/[㐀-鿿]/);
    // brief 재료 자체가 추상어·생극 금칙을 쓰지 않는다
    const all = [...b.facts, ...b.caveats, ...b.context].join(" ");
    expect(all).not.toMatch(ABSTRACT_RE);
    expect(all).not.toMatch(SHENG_KE_RE);
    // v4.19: 영역은 계획이 고른 것(↑ 먼저, 최대 2). 이달·올해 신호는 맥락을 쓰는 날만 글로 푼다 (화면 신호는 content.areaSignals에 전부)
    expect(b.areas.map((a) => `${a.period}:${a.area}`)).toEqual(["오늘:재물", "오늘:연애"]);
    expect(b.areas[0]).toMatchObject({ period: "오늘", word: "돈", signal: "↑" });
    expect(b.month).toBeNull();   // 맥락을 쓰지 않는 날 — 이달 운 언급을 검사기가 막는다
    expect(b.banned).toContain("반드시");
    expect(b.jargon).toContain("용신");
    expect(b.jargon).toEqual(expect.arrayContaining(["일간", "일지", "천간", "지지", "삼합", "육합", "기신"]));
    // v4.2: 점수(9.2)는 허용 숫자에 없다
    expect(b.allowedNumbers).toEqual([6, 15, 2026]);
    expect(b.score.value).toBe(9.2);
    // v4.4: 요일·절기가 오늘 재료로
    expect(b.today).toEqual({ date: "2026-06-15", weekday: "월요일", ganji: "경신일", solarTerm: "망종 열흘째", useSolarTerm: false, solarTermName: "망종" });
  });

  test("v4.17: 기록이 있어도 내 숫자 문장 재료를 주지 않고 그 숫자도 허용하지 않는다", () => {
    const b = buildBrief(base({ n: 12, mean: 6.8, sameGanjiCount: 2, sameGanjiMean: 7.5, weight: 0.71, score: 0.6 }));
    expect(b.allowedNumbers).not.toContain(7.5);
    expect(b.allowedNumbers).not.toContain(6.8);
    const json = renderBrief(b);
    expect(json).not.toContain("기록");
    expect(json).not.toContain("6.8");
    expect(json.length).toBeLessThan(1500);
  });
});

describe("3단계 검사 (validate) — v4.19 Draft", () => {
  const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
  const core = v4(PROFILE_A, "2026-06-15"); // 庚申: 오늘 재물↑ 연애↑ / 이달 대인↓ / 올해 대인↓
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
  const brief = buildBrief({ core, personal: NONE, today, date: "2026-06-15", weekday: "월요일", score10: 9.2, band: "좋음" });
  const OK: Draft = {
    headline: "눈에 들어온 제안을 적어 두는 날",
    body: [
      "평소라면 그냥 넘겼을 할인 소식이나 제안이 오늘은 자꾸 눈에 들어와요.",
      "둘러보는 재미가 있어서 이것저것 알아보고 싶은 마음이 커질 수 있어요.",
      "가까운 사람과 미뤄 둔 이야기가 다시 나오면 피하지 말고 들어 봐요.",
      "다만 마음에 든 것을 그 자리에서 정하기보다 한 번 적어 두는 편이 좋아요.",
    ],
    areaLines: [
      { area: "재물", text: "필요한 물건은 미리 정한 가격 안에서만 골라 봐요." },
      { area: "연애", text: "가까운 사람에게 오늘 본 재미있는 것을 먼저 보여 줘요." },
    ],
    do: "눈에 띈 제안 하나를 메모장에 적어 둬요.",
    dont: "처음 본 상품을 그 자리에서 결제하지 않아요.",
  };
  const v = (d: Partial<Draft>) => validateFortuneText({ ...OK, ...d }, brief);
  const b3 = (s: string) => OK.body.map((x, i) => (i === 3 ? s : x));

  test("통과 예: 사유 없음", () => {
    expect(validateFortuneText(OK, brief)).toEqual([]);
  });

  test("금지어·전문용어·십신 이름·명령조·이모지, 일상어 오탐 없음", () => {
    expect(v({ body: b3("다만 흐름이 좋다고 그 자리에서 정하기보다 적어 두는 편이 좋아요.") }).some((x) => x.includes('금지어 "흐름"'))).toBe(true);
    expect(v({ headline: "용신이 들어오는 날" })).toEqual(['headline: 전문용어 "용신"']);
    expect(v({ headline: "일진이 좋은 날" }).some((x) => x.includes('전문용어 "일진"'))).toBe(true);
    expect(v({ dont: "편인 쪽으로 서두르지 않아요." }).some((x) => x.includes("십신 이름"))).toBe(true);
    expect(v({ do: "제안은 적어 두세요." }).some((x) => x.includes("명령조"))).toBe(true);
    expect(v({ headline: "좋은 날 ✨" }).some((x) => x.includes("이모지"))).toBe(true);
    // "상관없어요", "힘이 드는 편인 병오", "고른 편인데", "무슨 일지 모르는"은 일상어 (실제 샘플에서 걸렸던 거짓 양성)
    expect(v({ dont: "작은 실수는 상관없어요." })).toEqual([]);
    expect(v({ dont: "오늘 일은 힘이 드는 편인 병오라 서두르지 않아요." })).toEqual([]);
    expect(v({ dont: "속도가 고른 편인데 서두르지 않아요." })).toEqual([]);
    expect(v({ dont: "무슨 일지 모르는 연락에 바로 답하지 않아요." })).toEqual([]);
    expect(v({ dont: "오늘 일지와 맞는 날이라 서두르지 않아요." })).toEqual(expect.arrayContaining(['dont: 금지어 "일지"', 'dont: 전문용어 "일지"']));
  });

  test("v4.1 ⑤ 구조 서술: body·영역·do·dont에서 탈락, headline은 보지 않는다. '한편' 부사는 통과", () => {
    expect(STRUCTURE_WORDS).toEqual(["글자", "짝이 되", "짝이 맞", "부딪히", "맞서", "한편이", "위아래", "윗글", "아랫글"]);
    expect(v({ dont: "짝이 맞는 물건만 서둘러 사지 않아요." })).toEqual(['dont: 구조 서술 "짝이 맞"']);
    expect(v({ do: "위아래 서랍 하나만 정리해요." })).toEqual(['do: 구조 서술 "위아래"']);
    expect(v({ do: "천간 이야기는 접어 두고 하나만 해요." })).toEqual(['do: 전문용어 "천간"']);
    expect(v({ areaLines: [OK.areaLines[0]!, { area: "연애", text: "가까운 사람과 부딪히는 말은 아껴요." }] })).toEqual(['areaLines[1]: 구조 서술 "부딪히"']);
    expect(v({ headline: "글자가 또렷한 날" })).toEqual([]);
    expect(v({ dont: "한편 서두르지는 않아요." })).toEqual([]);
    expect(v({ dont: "그 사람과 한편이 되니 서두르지 않아요." })).toEqual(['dont: 구조 서술 "한편이"']);
    // v4.4·4.19: 계획에 맥락이 없는 날의 "올해 운"·"이달 운" 언급
    expect(v({ dont: "올해 운을 믿고 서두르지 않아요." })).toEqual(["dont: 오늘만: 계획에 없는 올해·10년 단위 운을 말함"]);
    expect(v({ dont: "이달 운을 믿고 서두르지 않아요." })).toEqual(["dont: 이달 운 재료가 없는데 이달 운을 말함"]);
  });

  test("v4.13 추상어·생극·판정·비유·성격 이름", () => {
    for (const bad of ["평소 아쉽던 부분이 채워지는 날이에요.", "원래 나에게 넘치는 힘이 더해져요.", "힘이 한곳에 모이지 않아요.", "지금 나와 박자가 안 맞아요.", "그 힘이 돈 쪽으로 작용해요."]) {
      expect(v({ dont: bad }).filter((x) => x.includes("추상어")), bad).toHaveLength(1);
    }
    for (const bad of ["오늘 수 기운이 내 화를 누르고 있어요.", "금이 목을 극해요.", "토가 금을 생해요."]) {
      expect(v({ dont: bad }).filter((x) => x.includes("생·극")), bad).toHaveLength(1);
    }
    expect(v({ dont: "문제가 발생해도 버튼을 눌러요." })).toEqual([]);
    expect(v({ body: b3("오늘은 내게 맞는 편이라 그 자리에서 정해도 괜찮아요.") }).some((x) => x.includes("판정 문장"))).toBe(true);
    expect(v({ body: b3("오늘은 일이 손에 잘 붙어서 적어 두기만 해도 정리가 돼요.") }).some((x) => x.includes("비유"))).toBe(true);
    expect(v({ body: b3("기회와 확장이 눈에 들어오니 그 자리에서 정하지 않는 편이 좋아요.") }).some((x) => x.includes('성격 이름 "기회와 확장"'))).toBe(true);
    // 주의인 날 반전 말은 오늘 문장만 (이달·올해 문장은 예외)
    const care = { ...brief, score: { ...brief.score, band: "주의" } };
    expect(validateFortuneText({ ...OK, body: b3("마음에 든 것을 고르는 일은 생각보다 수월하게 끝나요.") }, care).filter((x) => x.includes("반전 말"))).toEqual(['본문 4번째 문장: 주의인 날 반전 말 "수월"']);
  });

  test("숫자 날조 · 점수 숫자 · 기록 이야기", () => {
    expect(v({ do: "30분만 혼자 있는 시간을 만들어요." })).toEqual(expect.arrayContaining([expect.stringContaining("사실에 없는 숫자 30")]));
    expect(v({ body: b3("오늘은 9.2점짜리 날이라 그 자리에서 정하지 않는 편이 좋아요.") })).toEqual(["본문 4번째 문장: 점수 숫자 9.2 (점수는 화면에 있으니 글에 쓰지 않기)"]);
    expect(v({ headline: "10점 만점에 가까운 날" })).toEqual(expect.arrayContaining([expect.stringContaining('"N점 만점" 꼴')]));
    expect(v({ dont: "지난 3번 기록처럼 혼자 결정하지 않아요." }).some((x) => x.includes("기록·평균 이야기"))).toBe(true);
    expect(v({ body: b3("비슷한 날의 평균 행복도가 높았으니 그 자리에서 정하지 않아요.") }).some((x) => x.includes("기록·평균 이야기"))).toBe(true);
  });

  test("영역 줄: 1문장 · 본문 첫 문장과 겹침", () => {
    expect(v({ areaLines: [{ area: "재물", text: "한 문장이에요. 두 문장이에요." }, OK.areaLines[1]!] }).some((x) => x.includes("1문장"))).toBe(true);
    expect(AREA_OVERLAP_MAX).toBe(0.6);
    expect(v({ areaLines: [{ area: "재물", text: "평소라면 그냥 넘겼을 할인 소식이나 제안이 자꾸 눈에 들어와요." }, OK.areaLines[1]!] })).toEqual(["areaLines[0]: 본문 첫 문장과 겹침"]);
    expect(tokenOverlap("돈 쓰는 일은 계획대로 가요.", OK.body.join(" "))).toBe(0);
  });

  test("문장 수: 본문 3문장·7문장은 전체 이슈(다시 쓰기) / 기간 약속 · 한자", () => {
    expect(v({ body: OK.body.slice(0, 3) })).toEqual(["본문 3문장 (4~5문장)"]);
    expect(v({ body: [...OK.body, "하나 더 있는 문장이에요.", "또 하나 더 있는 문장이에요.", "셋째로 더 있는 문장이에요."] })).toEqual(expect.arrayContaining(["본문 7문장 (4~5문장)"]));
    expect(v({ dont: "3일 더 쓰면 달라지지 않아요." }).some((x) => x.includes("기간 약속"))).toBe(true);
    expect(v({ headline: "庚申의 아침" }).some((x) => x.includes("한자"))).toBe(true);
  });

  test("템플릿 문장은 금지어·전문용어 검사를 통과한다", () => {
    const t = templateText(templateInputFromCore(core), NONE, today);
    const r = validateFortuneText({ headline: t.headline, body: t.body, areas: [], do: t.do, dont: t.dont }, brief);
    expect(r.filter((x) => /금지어|전문용어|십신|판정|구조/.test(x))).toEqual([]);
  });
});

describe("3단계 캐시 정책 (A-3·B-H1)", () => {
  test("A-3: API 장애 템플릿은 retryAfter까지만 캐시로 쓰고, 지나면 다시 만든다", () => {
    const now = Date.now();
    const cached = { headline: "x", transient: "api", retryAfter: retryAfterFor(now) };
    expect(usableCachedContent(cached, now + 1000)).not.toBeNull();
    expect(usableCachedContent(cached, now + TRANSIENT_RETRY_MS + 1)).toBeNull();
    expect(usableCachedContent({ headline: "x", transient: "api" }, now)).toBeNull(); // retryAfter 없는 옛 형식은 다시 만든다
    expect(usableCachedContent({ headline: "정상", source: "llm" }, now)).not.toBeNull();
    expect(usableCachedContent(null, now)).toBeNull();
  });

  test("B-H1: 같은 날 재생성은 REGEN_LIMIT까지만 모델을 쓴다", () => {
    expect(regenPolicy(null)).toEqual({ regen: 0, useModel: true });
    expect(regenPolicy({ content: {} })).toEqual({ regen: 1, useModel: true });
    expect(regenPolicy({ content: { regen: REGEN_LIMIT - 1 } })).toEqual({ regen: REGEN_LIMIT, useModel: true });
    expect(regenPolicy({ content: { regen: REGEN_LIMIT } })).toEqual({ regen: REGEN_LIMIT + 1, useModel: false });
    expect(regenCountOf({ content: { regen: "x" } })).toBe(0);
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
