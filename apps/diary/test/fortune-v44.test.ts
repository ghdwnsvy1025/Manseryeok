// v4.4 운세 글 — 오늘만 (00-톤.md v3.6): 대운·세운·월운 문장은 바뀌는 날·충인 날에만 facts에, 근거용 contextFacts에는 항상.
// 요일·절기(24절기)가 brief 재료로, 금지어 "특별한·남다른·다른 날과 달리·차별", 맥락 없는 날 운 언급은 검사 탈락. 모델 호출 없음.
import { describe, expect, test } from "vitest";
import { fromBirth, monthGanjiList } from "@saju/core-rules";
import { computeCoreFortune, ipchunDate, toBirthInput } from "@/lib/fortune/core";
import { buildBrief, hasContextFact } from "@/lib/fortune/brief";
import { SYSTEM } from "@/lib/fortune/llm";
import { solarTermOf, solarTermsOfYear, termDayWord } from "@/lib/fortune/solarTerms";
import { CONTEXT_MENTION_RE, validateFortuneText, type ModelText } from "@/lib/fortune/validate";
import { BANNED, findBanned, templateInputFromCore, templateText } from "@/lib/fortune/text";
import type { CoreFortune } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile, type PillarsSnapshot } from "@/lib/profile";

// fortune.test.ts와 같은 세 사주
const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" }; // 己巳 丙子 丙寅 甲午
const PROFILE_B: BirthProfile = { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1994, birthMonth: 1, birthDay: 28, birthHour: 12, birthMinute: 0, city: "seoul" }; // 癸酉 乙丑 甲寅 庚午
const PROFILE_C: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1995, birthMonth: 10, birthDay: 25, birthHour: 14, birthMinute: 0, city: "seoul" }; // 乙亥 丙戌 己丑 辛未

function pillarsOf(p: BirthProfile): PillarsSnapshot {
  const c = computeProfile({ ...p, name: "x" });
  if (!c.ok) throw new Error(c.error);
  return c.value.pillars;
}
function v4(p: BirthProfile, date: string, pillars = pillarsOf(p)): CoreFortune {
  return computeCoreFortune({ pillars, profile: p, date, todayHanja: dayGanji(date).hanja });
}
const onlyContext = (c: CoreFortune) => c.facts.filter((f) => hasContextFact([f]));

describe("v4.4 24절기 (solarTerms)", () => {
  test("2026년 입절일 24개: 12절입은 엔진 getSolarTermKSTIso(ipchunDate·monthGanjiList와 같은 날), 12중기는 같은 방식 — 입춘 2/4, 춘분 3/20, 한로 10/8, 동지 12/22", () => {
    const list = solarTermsOfYear(2026);
    expect(list).toHaveLength(24);
    const y = Object.fromEntries(list.map((t) => [t.ko, t.date]));
    expect(y.입춘).toBe(ipchunDate(2026));
    expect(y).toMatchObject({ 소한: "2026-01-05", 대한: "2026-01-20", 입춘: "2026-02-04", 춘분: "2026-03-20", 하지: "2026-06-21", 추분: "2026-09-23", 한로: "2026-10-08", 상강: "2026-10-23", 입동: "2026-11-07", 동지: "2026-12-22" });
    for (let i = 1; i < list.length; i++) expect(list[i]!.date > list[i - 1]!.date, list[i]!.ko).toBe(true);
    // 절입(월운 경계)은 코어 monthGanjiList의 시작일과 같은 날
    for (const d of ["2026-02-04", "2026-10-08", "2026-11-07", "2027-02-04"]) expect(monthGanjiList(d, 1)[0]!.시작.slice(0, 10)).toBe(d);
  });

  test("solarTermOf: 이름·며칠째·입절일 여부 (10-07 추분 보름째 / 10-08 한로 첫날 / 10-09 한로 이틀째 / 01-20 대한 첫날 / 01-02는 전해 동지)", () => {
    expect(solarTermOf("2026-10-07")).toEqual({ name: "추분", dayIndex: 15, isTermDay: false, label: "추분 보름째" });
    expect(solarTermOf("2026-10-08")).toEqual({ name: "한로", dayIndex: 1, isTermDay: true, label: "한로 첫날" });
    expect(solarTermOf("2026-10-09")).toMatchObject({ name: "한로", dayIndex: 2, label: "한로 이틀째" });
    expect(solarTermOf("2026-01-20")).toMatchObject({ name: "대한", isTermDay: true, label: "대한 첫날" });
    expect(solarTermOf("2026-01-02")).toMatchObject({ name: "동지", dayIndex: 12, label: "동지 열이틀째" });
    expect(solarTermOf("2026-06-15").label).toBe("망종 열흘째");
    // 라벨에 숫자가 없고(허용 숫자 날조 방지) 금지어가 없다
    for (const d of ["2026-01-01", "2026-03-09", "2026-07-22", "2026-11-23", "2026-12-31"]) {
      const s = solarTermOf(d);
      expect(s.label, d).not.toMatch(/\d/);
      expect(findBanned(s.label)).toEqual([]);
      expect(s.dayIndex).toBeGreaterThanOrEqual(1);
      expect(s.dayIndex).toBeLessThanOrEqual(17);
    }
  });

  test("termDayWord: 첫날·사흘째·열흘째·보름째, 표 밖은 숫자", () => {
    expect([1, 2, 3, 7, 10, 15, 16].map(termDayWord)).toEqual(["첫날", "이틀째", "사흘째", "이레째", "열흘째", "보름째", "열엿새째"]);
    expect(termDayWord(20)).toBe("20일째");
  });
});

describe("v4.4 facts — 대운·세운·월운 문장은 바뀌는 날·충인 날에만, contextFacts에는 항상", () => {
  const C_1007 = v4(PROFILE_C, "2026-10-07");
  const C_1008 = v4(PROFILE_C, "2026-10-08");
  const C_1009 = v4(PROFILE_C, "2026-10-09");

  test("(a) 절기 입절일 2026-10-08(乙卯, 한로 = 월운 丁酉 → 戊戌)엔 이달 운 1문장. 전날 10-07(甲寅)엔 없음", () => {
    expect(dayGanji("2026-10-08").hanja).toBe("乙卯");
    expect(C_1007.context.wolun?.간지).toBe("丁酉");
    expect(C_1008.context.wolun?.간지).toBe("戊戌");
    expect(onlyContext(C_1007)).toEqual([]);
    expect(onlyContext(C_1008)).toEqual(["이달 운 戊戌은 힘이 드는 편이에요."]);
    // 오늘 문장(십신 성격·역할·합계)은 그대로 앞에
    expect(C_1008.facts.slice(0, 3)).toEqual(["오늘은 '압박과 책임'(편관)의 성격이 아주 강해요.", "'압박과 책임' 쪽은 모자란 부분에 힘을 보태 줘요.", "둘을 합치면 오늘은 수월한 편이에요."]);
    // contextFacts는 두 날 모두 대운(+플래그)·세운·월운 전부
    expect(C_1008.contextFacts).toEqual([
      "지금 10년 단위 운 癸未은 수월한 편이에요.",
      "지금 10년 단위 운이 내게 모자란 쪽을 누르고 있어요.",
      "지금 10년 단위 운은 겉과 속이 달라요.",
      "올해 운 丙午은 조심할 편이에요.",
      "이달 운 戊戌은 힘이 드는 편이에요.",
    ]);
    expect(C_1007.contextFacts[4]).toBe("이달 운 丁酉은 조심할 편이에요.");
    // 점수·영역은 맥락 문장과 무관 (10-07은 v4.1 ③의 0.69 그대로)
    expect(C_1007.parts.score01).toBe(0.69);
  });

  test("중기(2026-01-20 대한 첫날)는 월운이 안 바뀌니 맥락 문장 없음 — 절기이되 입절일이 아니다", () => {
    expect(solarTermOf("2026-01-20").isTermDay).toBe(true);
    expect(monthGanjiList("2026-01-20", 1)[0]!.시작.slice(0, 10)).toBe("2026-01-05");
    expect(onlyContext(v4(PROFILE_A, "2026-01-20"))).toEqual([]);
    expect(onlyContext(v4(PROFILE_B, "2026-01-20"))).toEqual([]);
  });

  test("(b) 입춘일 2026-02-04엔 올해 운 1문장 (입절일이기도 해서 이달 운도 1문장). 전날엔 없음", () => {
    expect(onlyContext(v4(PROFILE_A, "2026-02-04"))).toEqual(["올해 운 丙午은 힘이 드는 편이에요.", "이달 운 庚寅은 수월한 편이에요."]);
    expect(onlyContext(v4(PROFILE_B, "2026-02-04")).map((f) => f.slice(0, 4))).toEqual(["올해 운", "이달 운"]);
    expect(onlyContext(v4(PROFILE_B, "2026-02-03"))).toEqual([]);
  });

  test("(c) 대운 교체일(B 2026-05-09 戊辰 → 己巳)엔 10년 운 1문장, 전날엔 없음. 대운 플래그 문장은 facts에 없다", () => {
    const day = v4(PROFILE_B, "2026-05-09");
    const eve = v4(PROFILE_B, "2026-05-08");
    expect(fromBirth(toBirthInput(PROFILE_B)).대운.목록.find((d) => d.순서 === 4)?.시작일?.slice(0, 10)).toBe("2026-05-09");
    expect(day.context.daeun).toMatchObject({ 순서: 4, 간지: "己巳" });
    expect(eve.context.daeun).toMatchObject({ 순서: 3, 간지: "戊辰" });
    expect(onlyContext(day)).toEqual(["지금 10년 단위 운 己巳은 꽤 수월한 편이에요."]);
    expect(onlyContext(eve)).toEqual([]);
    // 대운 플래그 문장(모자란 쪽을 누르고 / 겉과 속)은 어느 날이든 facts에 없고 contextFacts에만 (C는 대운 癸未에 플래그 둘)
    for (const r of [day, eve, C_1007, C_1008, C_1009, v4(PROFILE_C, "2026-03-20")]) {
      expect(r.facts.some((f) => f.includes("10년 단위 운이 내게") || f.includes("10년 단위 운은 겉과 속"))).toBe(false);
    }
    expect(C_1009.contextFacts.filter((f) => f.includes("10년 단위"))).toHaveLength(3);
  });

  test("(d) 운↔일진 충: 대운 충(A 2027-03-01 최고경보) · 세운 충(A 2026-10-05) · 월운 충(C 2026-10-09)인 날엔 그 운 1문장만", () => {
    const daeunClash = v4(PROFILE_A, "2027-03-01");
    expect(daeunClash.context.daeun?.clash?.최고경보).toBe(true);
    expect(onlyContext(daeunClash)).toEqual(["지금 10년 단위 운 癸酉은 꽤 수월한 편이고, 오늘과 어긋나 변동이 커지기 쉬운 날이에요."]);
    const seunClash = v4(PROFILE_A, "2026-10-05");
    expect(seunClash.context.seun.clash).toBeDefined();
    expect(onlyContext(seunClash)).toEqual(["올해 운 丙午은 힘이 드는 편이고, 오늘과 어긋나 변동이 생기기 쉬워요."]);
    expect(C_1009.context.wolun?.clash).toBeDefined();
    expect(C_1009.context.seun.clash ?? C_1009.context.daeun?.clash).toBeUndefined();
    expect(onlyContext(C_1009)).toEqual(["이달 운 戊戌은 힘이 드는 편이고, 오늘과 어긋나 변동이 생기기 쉬워요."]);
    // 충 없는 평일(A·B 2026-06-15, C 2026-10-07)은 0문장
    for (const r of [v4(PROFILE_A, "2026-06-15"), v4(PROFILE_B, "2026-06-15"), C_1007]) expect(onlyContext(r)).toEqual([]);
  });

  test("맥락 문장은 facts에 종류별 최대 1문장이고 contextFacts의 문장과 글자까지 같다. contextFacts엔 올해·이달 운이 늘 있다", () => {
    for (const prof of [PROFILE_A, PROFILE_B, PROFILE_C]) {
      const pillars = pillarsOf(prof);
      for (const date of ["2026-10-05", "2026-10-07", "2026-10-08", "2026-10-09", "2026-01-20", "2026-02-04", "2026-05-09", "2026-06-15", "2027-03-01", "2026-03-09", "2026-11-23"]) {
        const r = v4(prof, date, pillars);
        const ctx = onlyContext(r);
        expect(ctx.length, date).toBeLessThanOrEqual(3);
        expect(new Set(ctx.map((f) => f.slice(0, 4))).size).toBe(ctx.length);
        for (const f of ctx) expect(r.contextFacts, `${date} ${f}`).toContain(f);
        expect(r.contextFacts.some((f) => f.startsWith("올해 운"))).toBe(true);
        expect(r.contextFacts.some((f) => f.startsWith("이달 운"))).toBe(true);
      }
    }
  });
});

describe("v4.4 brief·SYSTEM·검사 — 요일·절기 재료, 금지어, 맥락 없는 운 언급", () => {
  const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
  const plain = buildBrief({ core: v4(PROFILE_C, "2026-10-07"), personal: NONE, today: { ko: "갑인", hanja: "甲寅", stemKo: "갑", branchKo: "인" }, date: "2026-10-07", weekday: "수요일", score10: 6.9, band: "무난" });
  const termDay = buildBrief({ core: v4(PROFILE_C, "2026-10-08"), personal: NONE, today: { ko: "을묘", hanja: "乙卯", stemKo: "을", branchKo: "묘" }, date: "2026-10-08", weekday: "목요일", score10: 6.9, band: "무난" });
  /** C 2026-10-07 brief(오늘 직업↑ / 이달 가족↓ / 올해 학업↓)에 맞는 통과 글 — 요일·절기를 한 번씩 */
  const OKC: ModelText = {
    headline: "역할이 또렷해지는 수요일",
    body: "아침에 할 일을 다시 적어 보면 순서가 또렷해져요. 오늘은 맡은 역할이 아주 세지는 날이라 정해진 틀 안에서 움직이면 일이 순해요. 저녁 공기가 서늘해 일찍 들어가는 쪽이 편해요. 자기 전엔 내일 약속을 한 번 확인하고 쉬어요.",
    areas: [
      { period: "오늘", area: "직업", line: "맡은 일에 힘이 실려요." },
      { period: "이달", area: "가족", line: "이달엔 가족 사이 사소한 말에 걸리기 쉬워요." },
      { period: "올해", area: "학업", line: "올해는 새 내용보다 복습이 맞아요." },
    ],
    do: "정해진 시간과 절차를 지켜요.",
    dont: "체면 때문에 억지로 떠맡지 않아요.",
  };

  test("today.solarTerm·weekday가 재료로 들어가고 rules.scene·rules.context가 날에 따라 다르다", () => {
    expect(plain.areas.map((a) => `${a.period}:${a.area}${a.signal}`)).toEqual(["오늘:직업↑", "이달:가족↓", "올해:학업↓"]);
    // v4.5: useSolarTerm(절기 첫날만 글에 씀)·solarTermName이 더해졌다
    expect(plain.today).toEqual({ date: "2026-10-07", weekday: "수요일", ganji: "갑인일", solarTerm: "추분 보름째", useSolarTerm: false, solarTermName: "추분" });
    expect(termDay.today.useSolarTerm).toBe(true);
    expect(termDay.today.solarTerm).toBe("한로 첫날");
    expect(plain.rules.scene).toContain("수요일");
    // v4.5: 첫날이 아니면 절기 이름을 쓰지 말라고 한다
    expect(plain.rules.scene).toContain("절기 이름(추분)은 쓰지 않기");
    expect(termDay.rules.scene).toContain("한로가 시작하는 날");
    expect(hasContextFact(plain.facts)).toBe(false);
    expect(hasContextFact(termDay.facts)).toBe(true);
    expect(plain.rules.context).toContain("말하지 않기");
    expect(termDay.rules.context).toContain("있는 날");
    expect(plain.rules.body).toContain("오늘의 성격·장면·내 기록");
    expect(plain.rules.body).not.toMatch(/10년|올해/);
    // 맥락 문장이 없는 날 facts에 "10년"이 없고, 절기 라벨은 숫자를 더하지 않는다 (7·10·2026은 날짜)
    expect(plain.allowedNumbers).toEqual([7, 10, 2026]);
    expect(plain.facts.some((f) => f.includes("10년"))).toBe(false);
    expect(termDay.facts).toContain("이달 운 무술은 힘이 드는 편이에요.");
  });

  test("금지어 추가: 특별한·남다른·다른 날과 달리·차별 — BANNED·brief.banned·검사", () => {
    expect(BANNED).toEqual(expect.arrayContaining(["특별한", "남다른", "다른 날과 달리", "차별"]));
    expect(plain.banned).toEqual(expect.arrayContaining(["특별한", "남다른", "다른 날과 달리", "차별"]));
    expect(validateFortuneText(OKC, plain)).toEqual([]);
    expect(validateFortuneText({ ...OKC, headline: "특별한 수요일" }, plain)).toEqual(['금지어 "특별한"']);
    expect(validateFortuneText({ ...OKC, dont: "남다른 욕심을 내지 않아요." }, plain)).toEqual(['금지어 "남다른"']);
    expect(validateFortuneText({ ...OKC, body: OKC.body.replace("오늘은 맡은", "다른 날과 달리 오늘은 맡은") }, plain)).toEqual(['금지어 "다른 날과 달리"']);
    expect(validateFortuneText({ ...OKC, do: "차별 없이 대해요." }, plain)).toEqual(['금지어 "차별"']);
    expect(findBanned("오늘은 특별한 날이에요")).toEqual(["특별한"]);
  });

  test("SYSTEM: 요일·절기 한 번 규칙과 금지어가 있고, '올해·이달·지금 10년 단위의 운과 어떻게 겹치는지' 요구는 없다", () => {
    expect(SYSTEM).toContain("brief.today.solarTerm");
    expect(SYSTEM).toContain("절기 첫날");
    expect(SYSTEM).toContain("오늘의 성격·장면·내 기록");
    expect(SYSTEM).toContain("brief.facts에 그 문장이 있는 날에만");
    expect(SYSTEM).toMatch(/"특별한", "남다른", "다른 날과 달리", "차별"/);
    expect(SYSTEM).not.toContain("어떻게 겹치는지");
    expect(SYSTEM).not.toContain("올해 운과 겹쳐");
  });

  test("검사: 맥락 문장 없는 날 올해·이달·10년 단위 운을 말하면 탈락, 영역 줄 '이달엔/올해는'은 예외. 맥락 문장 있는 날은 통과", () => {
    expect(CONTEXT_MENTION_RE.test("올해 운과 겹쳐 조급해지기 쉬워요")).toBe(true);
    expect(CONTEXT_MENTION_RE.test("지금 10년 단위 운은 수월해요")).toBe(true);
    expect(CONTEXT_MENTION_RE.test("이달엔 가족 사이 말에 걸리기 쉬워요")).toBe(false);
    for (const extra of ["올해 운과 겹쳐 조급해지기 쉬워요.", "이달 운은 힘이 드는 쪽이라 서두르지 않아요.", "지금 10년 단위 운이 받쳐 줘요."]) {
      const r = validateFortuneText({ ...OKC, body: OKC.body + " " + extra }, plain);
      expect(r, extra).toEqual(["오늘만: facts에 없는 올해·이달·10년 단위 운을 말함"]);
    }
    expect(validateFortuneText({ ...OKC, dont: "올해 운만 믿고 벌이지 않아요." }, plain)).toEqual(["오늘만: facts에 없는 올해·이달·10년 단위 운을 말함"]);
    // 절기일(이달 운 문장이 facts에 있음)엔 같은 글이 이 사유로는 걸리지 않는다
    const onTermDay = validateFortuneText({ ...OKC, body: OKC.body + " 이달 운은 힘이 드는 쪽이라 서두르지 않아요." }, termDay);
    expect(onTermDay.filter((x) => x.startsWith("오늘만"))).toEqual([]);
    // 템플릿(모델 실패 대체)은 새 금지어에 걸리지 않는다
    const fallback = templateText(templateInputFromCore(v4(PROFILE_C, "2026-10-07")), NONE, { ko: "갑인", stemKo: "갑", branchKo: "인" });
    expect(findBanned([fallback.headline, fallback.body, fallback.do, fallback.dont].join(" "))).toEqual([]);
  });
});
