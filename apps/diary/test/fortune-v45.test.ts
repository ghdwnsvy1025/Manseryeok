import { describe, expect, it } from "vitest";
import { buildBrief, ABSTRACT_LABELS } from "@/lib/fortune/brief";
import { computeCoreFortune, toScore01 } from "@/lib/fortune/core";
import { SYSTEM } from "@/lib/fortune/llm";
import { FORTUNE_EXAMPLES as SYSTEM_EXAMPLES } from "@/lib/fortune/examples";   // v4.19: 운영 SYSTEM에서 빠지고 베낌 검사·테스트에만 남았다
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
  const b = buildBrief({ core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: "토요일", score10, band });
  return { ...b, plan: { ...b.plan, coreStems: [] as string[] } };   // 이 파일의 글은 그날 핵심과 무관한 예시 글 — 핵심 누락 검사는 끈다
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
  it("facts·맥락 문장에 글자·부딪혀·아랫글자·기울지 않고·치우침이 없다", () => {
    for (const date of ["2026-10-05", "2026-10-10", "2026-10-13", "2027-03-01"]) {
      const b = briefFor(date);
      const all = [...b.facts, ...b.context].join(" ");
      for (const w of ["글자", "부딪혀", "아랫글자", "기울지 않고", "치우침"]) expect(all.includes(w), `${date} ${w}`).toBe(false);
    }
  });
});

describe("v4.5 예시 세 편 (v4.19: SYSTEM 밖, 베낌 검사용)", () => {
  it("예시 세 편(좋음·무난·주의)이 있고 모두 검사기를 통과한다. SYSTEM에는 없다", () => {
    expect(SYSTEM_EXAMPLES.map((e) => e.band)).toEqual(["좋음", "무난", "주의"]);
    for (const e of SYSTEM_EXAMPLES) {
      // v4.16: 예시는 사주 용어·판정 문장 없이 검사기를 통과한다 (areas·최근은 비움)
      const b0 = briefFor("2026-10-10", e.band);
      const b = { ...b0, areas: [], recent: [], avoid: { headlines: [] } };
      expect(validateFortuneText(e.text, b).filter((i) => !i.includes("예시")), e.band).toEqual([]);
      expect(e.text.body, e.band).not.toMatch(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|맞는 편|모자란|넉넉한/);
      expect(["A", "B", "C", "D", "E"], e.band).toContain(e.text.판단.구조);
      expect(validateFortuneText(e.text, b).some((i) => i.startsWith("headline: 예시 제목")), "예시를 그대로 쓰면 걸린다").toBe(true);
      expect(SYSTEM).not.toContain(e.text.headline);
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
    expect(validateFortuneText(t, b()).some((i) => i.includes("성격 이름"))).toBe(true);
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
    expect(visibleAreas(areas, []).map((a) => a.period)).toEqual(["오늘", "이달"]);   // v4.15: 이달 줄은 매일
    expect(visibleAreas(areas, ["이달 운 戊戌은 힘이 드는 편이에요."]).map((a) => a.period)).toEqual(["오늘", "이달"]);
    expect(visibleAreas(areas, ["올해 운 丙午은 보통이에요."]).map((a) => a.period)).toEqual(["오늘", "이달", "올해"]);
  });
});

describe("v4.6 오늘의 짜임", () => {
  it("충이나 운 문장이 있으면 change, 오늘 영역 신호가 뚜렷하면 focus, 아니면 calm", async () => {
    const { angleOf } = await import("@/lib/fortune/brief");
    const base = { relations: { hits: [], flags: [] }, areas: [], facts: [] } as never;
    expect(angleOf(base)).toEqual({ angle: "calm", focus: null });
    expect(angleOf({ relations: { hits: [], flags: [] }, areas: [{ period: "오늘", area: "재물", signal: "↑", why: "" }], facts: [] } as never)).toEqual({ angle: "focus", focus: "재물" });
    expect(angleOf({ relations: { hits: [], flags: [] }, areas: [{ period: "오늘", area: "재물", signal: "↑", why: "" }], facts: ["이달 운 戊戌은 힘이 드는 편이에요."] } as never).angle).toBe("change");
    // v4.8: 변화형은 내 일지·월지와 충일 때만. 연지 충은 변화형이 아니다
    expect(angleOf({ relations: { hits: [{ kind: "충", pos: "일" }], flags: [] }, areas: [], facts: [] } as never).angle).toBe("change");
    expect(angleOf({ relations: { hits: [{ kind: "충", pos: "연" }], flags: [] }, areas: [], facts: [] } as never).angle).toBe("calm");
    // v4.8: 판정이 보통이면 담백형
    expect(angleOf({ relations: { hits: [], flags: [] }, areas: [{ period: "오늘", area: "재물", signal: "↑", why: "" }], facts: [], dayLuck: { total: "보통" } } as never).angle).toBe("calm");
  });
});

describe("v4.8 반복 줄이기", () => {
  it("말투·기억이 brief에 들어간다 (v4.19: 표현 돌리기는 계획의 피할것)", () => {
    const b = briefFor("2026-10-13");
    expect(b.tone.length).toBeGreaterThan(0);
    expect(b.recent).toEqual([]);
  });
  it("최근 운세와 헤드라인·첫 문장이 겹치면 탈락", () => {
    const base = SYSTEM_EXAMPLES[1]!.text;
    const t = { ...base, headline: "해야 할 일이 보이는 날", do: "미뤄 둔 답장을 오늘 정리해요.", dont: "남의 몫까지 먼저 떠맡지 않아요.", body: "오늘은 할 일이 하나둘 눈에 밟히는 날이에요. 책임감이 커지는 만큼 마음이 조금 무거울 수 있어요.\n\n미뤄 둔 정리를 하나 끝내면 한결 가벼워져요. 할 수 있는 만큼만 맡으면 무리 없이 지나가요." };
    const b = { ...briefFor("2026-10-10", "무난"), areas: [], recent: [{ date: "2026-10-09", headline: "해야 할 일이 보이는 날", start: "오늘은 할 일이 하나둘 눈에 밟히는 날이에요. 책임감이 커지는 만큼 마음이 조금 무거울 수 있어요." }] };
    const issues = validateFortuneText(t, b);
    expect(issues.some((i) => i.includes("제목과 겹침"))).toBe(true);
    expect(issues.some((i) => i.includes("첫 문장과 겹침"))).toBe(true);
  });
  it("겉과 속 문장: 천간·지지가 반대 방향일 때만", async () => {
    const { oppositeParts } = await import("@/lib/fortune/core");
    expect(oppositeParts("용", "기")).toBe(true);
    expect(oppositeParts("구", "희")).toBe(false); // v4.8: 용·기가 맞붙을 때만
    expect(oppositeParts("용", "희")).toBe(false);
    expect(oppositeParts("한", "기")).toBe(false);
  });
});

describe("v4.9 칸마다 같은 말 반복", () => {
  it("오늘 영역 줄·do·dont가 본문 문장을 되풀이하면 탈락", async () => {
    const { stemOverlap } = await import("@/lib/fortune/validate");
    // 실제 v4.8 샘플에서 나온 되풀이
    expect(stemOverlap("오늘은 혼자 결정하기 전에 가까운 사람에게 먼저 얘기해요.", "오늘 같은 날은 혼자 끙끙대기보다 가까운 사람에게 얘기를 꺼내는 편이 나아요.")).toBeGreaterThanOrEqual(0.5);
    const base = SYSTEM_EXAMPLES[1]!.text;
    const b = { ...briefFor("2026-10-10", "무난"), areas: [] };
    expect(validateFortuneText(base, b).some((i) => i.includes("되풀이"))).toBe(false);
    const t = { ...base, do: "혼자 정답을 찾으려고 너무 오래 붙잡지 않아요." };   // v4.16 예시 2의 본문 문장을 되풀이
    expect(validateFortuneText(t, b).some((i) => i.includes("do: 본문 문장을 되풀이"))).toBe(true);
  });
  it("SYSTEM이 칸 역할과 '아니에요' 기억을 말한다", () => {
    expect(SYSTEM).toContain("본문 조언을 되풀이하지 않고");
    expect(SYSTEM).toContain("피할것.아니에요");
  });
});
