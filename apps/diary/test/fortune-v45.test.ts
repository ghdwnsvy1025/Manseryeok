import { describe, expect, it } from "vitest";
import { buildBrief, ABSTRACT_LABELS } from "@/lib/fortune/brief";
import { computeCoreFortune, toScore01 } from "@/lib/fortune/core";
import { SYSTEM, SYSTEM_EXAMPLES } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { validateFortuneText } from "@/lib/fortune/validate";
import { visibleAreas } from "@/lib/fortune/visible";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const P: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };

function briefFor(date: string, bandOverride?: "좋음" | "무난" | "주의") {
  const prof = computeProfile({ ...P, name: "t" });
  if (!prof.ok) throw new Error(prof.error);
  const g = dayGanji(date);
  const core = computeCoreFortune({ pillars: prof.value.pillars, profile: P, date, todayHanja: g.hanja });
  const personal = adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
  const score10 = toTenPoint(personal.score);
  const band = bandOverride ?? bandOf(score10);
  return buildBrief({ core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: "토요일", score10, band });
}

describe("v4.5 점수 곡선", () => {
  it("0.5 위는 예전 직선, 아래는 tanh — 순서 유지, 바닥 1.2에 붙지 않음", () => {
    expect(toScore01(0)).toBe(0.5);
    expect(toScore01(2.4)).toBeCloseTo(0.7, 6);
    expect(toScore01(100)).toBe(0.92);
    const xs = [-8, -6, -5, -4, -2, -1, 0];
    const ys = xs.map(toScore01);
    for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
    expect(toScore01(-5.75)).toBeGreaterThan(0.17);
    expect(toScore01(-100)).toBeGreaterThanOrEqual(0.12);
  });
});

describe("v4.5 사실 문장 — 구조 말 없음", () => {
  it("facts·areas.why에 글자·부딪혀·아랫글자·기울지 않고·치우침이 없다", () => {
    for (const date of ["2026-10-05", "2026-10-10", "2026-10-13", "2027-03-01"]) {
      const b = briefFor(date);
      const all = [...b.facts, ...b.areas.map((a) => a.why)].join(" ");
      for (const w of ["글자", "부딪혀", "아랫글자", "기울지 않고", "치우침"]) expect(all.includes(w), `${date} ${w}`).toBe(false);
    }
  });
});

describe("v4.5 SYSTEM 예시", () => {
  it("예시 세 편(좋음·무난·주의)이 들어 있고 모두 검사기를 통과한다", () => {
    expect(SYSTEM_EXAMPLES.map((e) => e.band)).toEqual(["좋음", "무난", "주의"]);
    for (const e of SYSTEM_EXAMPLES) {
      const b = { ...briefFor("2026-10-10", e.band), areas: [] };
      expect(validateFortuneText(e.text, b).filter((i) => !i.startsWith("예시")), e.band).toEqual([]);
      expect(validateFortuneText(e.text, b).some((i) => i.startsWith("예시 headline")), "예시를 그대로 쓰면 걸린다").toBe(true);
    }
    expect(SYSTEM).toContain("직장 장면");
  });
});

describe("v4.5 검사 항목", () => {
  const base = { ...SYSTEM_EXAMPLES[1]!.text, headline: "해야 할 일이 보이는 날", do: "미뤄 둔 답장을 오늘 정리해요.", dont: "남의 몫까지 먼저 떠맡지 않아요.", body: "오늘은 할 일이 하나둘 눈에 밟히는 날이에요. 책임감이 커지는 만큼 마음이 조금 무거울 수 있어요. 미뤄 둔 정리를 하나 끝내면 한결 가벼워져요. 할 수 있는 만큼만 맡으면 무리 없이 지나가요." };
  const b = () => ({ ...briefFor("2026-10-10", "무난"), areas: [] });
  it("직장 장면", () => {
    expect(validateFortuneText({ ...base, do: "거래처에 먼저 연락해요." }, b()).some((i) => i.includes("직장 장면"))).toBe(true);
  });
  it("주의인 날 반전 말", () => {
    const care = { ...briefFor("2026-10-10", "주의"), areas: [] };
    const t = { ...base, body: base.body.replace("무리 없이 지나가요", "일이 술술 풀려요") };
    expect(validateFortuneText(t, care).some((i) => i.includes("반전 말"))).toBe(true);
    // 위로("긴장이 풀려요")는 괜찮다
    const ok = { ...base, body: base.body.replace("무리 없이 지나가요", "긴장이 조금 풀려요") };
    expect(validateFortuneText(ok, care).some((i) => i.includes("반전 말"))).toBe(false);
  });
  it("시간대 나열", () => {
    const t = { ...base, body: "아침에 일어나 차를 마셔요. 점심엔 산책을 해요. 저녁엔 책을 읽어요. 하루가 차분해요." };
    expect(validateFortuneText(t, b()).some((i) => i.includes("시간대 나열"))).toBe(true);
  });
  it("추상 이름 그대로", () => {
    expect(ABSTRACT_LABELS).toContain("경쟁과 추진");
    const t = { ...base, body: `오늘은 경쟁과 추진의 성격이 센 날이에요. ${base.body}` };
    expect(validateFortuneText(t, b()).some((i) => i.includes("추상 이름"))).toBe(true);
  });
  it("절기 첫날이 아니면 절기 이름 금지 (2026-10-10 = 한로 사흘째)", () => {
    const br = b();
    expect(br.today.useSolarTerm).toBe(false);
    const t = { ...base, body: `${br.today.solarTermName} 무렵이라 공기가 서늘해요. ${base.body}` };
    expect(validateFortuneText(t, br).some((i) => i.includes("절기 이름"))).toBe(true);
  });
});

describe("v4.5 이달·올해 줄은 그 운 문장이 있는 날만", () => {
  it("visibleAreas", () => {
    const areas = [{ period: "오늘" as const }, { period: "이달" as const }, { period: "올해" as const }];
    expect(visibleAreas(areas, []).map((a) => a.period)).toEqual(["오늘"]);
    expect(visibleAreas(areas, ["이달 운 戊戌은 힘이 드는 편이에요."]).map((a) => a.period)).toEqual(["오늘", "이달"]);
    expect(visibleAreas(areas, ["올해 운 丙午은 보통이에요."]).map((a) => a.period)).toEqual(["오늘", "올해"]);
  });
});

describe("v4.6 오늘의 짜임", () => {
  it("충이나 운 문장이 있으면 change, 오늘 영역 신호가 뚜렷하면 focus, 아니면 calm", async () => {
    const { angleOf } = await import("@/lib/fortune/brief");
    const base = { relations: { hits: [], flags: [] }, areas: [], facts: [] } as never;
    expect(angleOf(base)).toEqual({ angle: "calm", focus: null });
    expect(angleOf({ relations: { hits: [], flags: [] }, areas: [{ period: "오늘", area: "재물", signal: "↑", why: "" }], facts: [] } as never)).toEqual({ angle: "focus", focus: "재물" });
    expect(angleOf({ relations: { hits: [], flags: [] }, areas: [{ period: "오늘", area: "재물", signal: "↑", why: "" }], facts: ["이달 운 戊戌은 힘이 드는 편이에요."] } as never).angle).toBe("change");
    expect(angleOf({ relations: { hits: [{ kind: "충" }], flags: [] }, areas: [], facts: [] } as never).angle).toBe("change");
  });
  it("brief에 angle·focusArea·chain이 들어간다", () => {
    const b = briefFor("2026-10-13");
    expect(["change", "focus", "calm"]).toContain(b.angle);
    expect(b.chain.length).toBeGreaterThan(0);
  });
});
