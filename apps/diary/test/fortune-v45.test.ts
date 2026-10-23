import { describe, expect, it } from "vitest";
import { buildBrief, ABSTRACT_LABELS, STAGES } from "@/lib/fortune/brief";
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
      // v4.13: 예시는 각자 가정한 오늘 기운 이름(e.tenGods)으로 검사한다 — 이름·뜻·판정·이달 한 줄·추상어·생극 검사까지 통과
      const b0 = briefFor("2026-10-10", e.band);
      // v4.15: 예시의 사례 무대(e.stage)도 brief에 넣는다 — 무대 낱말 검사까지 통과
      const b = { ...b0, areas: [], today: { ...b0.today, tenGods: e.tenGods }, stage: STAGES.find((s) => s.name === e.stage)! };
      expect(validateFortuneText(e.text, b).filter((i) => !i.startsWith("예시")), e.band).toEqual([]);
      expect(e.text.body, e.band).not.toMatch(/이달/);   // v4.15: 이달은 areas의 이달 줄로
      expect(e.text.blocks.map((x) => x.kind).filter((k) => k !== "원리" && k !== "성향").sort(), e.band).toEqual(["근거", "사례", "처방"]);
      expect(e.text.body, e.band).toMatch(/맞는 날|맞는 편|안 맞는 날|보통 날/);
      expect(e.text.body, e.band).not.toMatch(/모자랐던 부분|넘치는 힘|부족한 쪽/);
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
  it("brief에 angle·focusArea·chain이 들어간다", () => {
    const b = briefFor("2026-10-13");
    expect(["change", "focus", "calm"]).toContain(b.angle);
    expect(b.chain.length).toBeGreaterThan(0);
  });
});

describe("v4.8 반복 줄이기", () => {
  it("표현 돌리기: 같은 뜻을 날짜마다 다른 말로", async () => {
    const { varyFact } = await import("@/lib/fortune/brief");
    const f = "'기회와 확장' 쪽은 내게 부족한 실속을 챙기는 힘을 옆에서 거들어 줘요.";
    const outs = new Set([0, 1, 2].map((k) => varyFact(f, k)));
    expect(outs.size).toBe(3);
    expect([...outs].every((o) => o.startsWith("'기회와 확장' 쪽은"))).toBe(true);
  });
  it("진입 방식·말투·기억이 brief에 들어간다", () => {
    const b = briefFor("2026-10-13");
    expect(["scene", "reason", "contrast"]).toContain(b.opening);
    expect(b.tone.length).toBeGreaterThan(0);
    expect(b.recent).toEqual([]);
  });
  it("최근 운세와 헤드라인·첫 문장이 겹치면 탈락", () => {
    const base = SYSTEM_EXAMPLES[1]!.text;
    const t = { ...base, headline: "해야 할 일이 보이는 날", do: "미뤄 둔 답장을 오늘 정리해요.", dont: "남의 몫까지 먼저 떠맡지 않아요.", body: "오늘은 할 일이 하나둘 눈에 밟히는 날이에요. 책임감이 커지는 만큼 마음이 조금 무거울 수 있어요.\n\n미뤄 둔 정리를 하나 끝내면 한결 가벼워져요. 할 수 있는 만큼만 맡으면 무리 없이 지나가요." };
    const b = { ...briefFor("2026-10-10", "무난"), areas: [], recent: [{ date: "2026-10-09", headline: "해야 할 일이 보이는 날", start: "오늘은 할 일이 하나둘 눈에 밟히는 날이에요. 책임감이 커지는 만큼 마음이 조금 무거울 수 있어요." }] };
    const issues = validateFortuneText(t, b);
    expect(issues.some((i) => i.includes("헤드라인과 겹침"))).toBe(true);
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
    const t = { ...base, do: "미뤄 둔 답장 하나를 보내고 할 일을 또렷하게 줄 세워요." };
    expect(validateFortuneText(t, b).some((i) => i.includes("do가 본문 문장을 되풀이"))).toBe(true);
  });
  it("SYSTEM이 칸 역할과 '아니에요' 기억을 말한다", () => {
    expect(SYSTEM).toContain("칸마다 맡은 일이 다릅니다");
    expect(SYSTEM).toContain("vote: -1");
  });
});
