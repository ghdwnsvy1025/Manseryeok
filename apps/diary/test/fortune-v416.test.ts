// v4.16 (2026-10-24, 사용자 수정 방향): 사주 이론은 내부 판단으로만, 본문은 생활 언어. 십신 생활 표현 후보 풀.
// v4.19: 핵심·표현 후보는 계획(plan.ts)이 고르고, 의미 태그 겹침 거부는 없앴다(반복은 그 문장만 수리). 이 파일은 이론 금지 규칙·표현 풀·템플릿을 본다.
import { describe, expect, it } from "vitest";
import { buildBrief, recentFromRows, renderBrief, TEN_GOD_NAMES } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { pickExpression, TEN_GOD_EXPRESSIONS } from "@/lib/fortune/expressions";
import { trimTail } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { checkDraft, validateFortuneText, type Draft } from "@/lib/fortune/validate";
import { visibleAreas } from "@/lib/fortune/visible";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const P: BirthProfile = { gender: "female", calendar: "solar", isLeapMonth: false, birthYear: 1994, birthMonth: 1, birthDay: 28, birthHour: 12, birthMinute: 0, city: "seoul" };
function inputFor(date: string, recent: ReturnType<typeof recentFromRows> = []) {
  const prof = computeProfile({ ...P, name: "t" });
  if (!prof.ok) throw new Error(prof.error);
  const g = dayGanji(date);
  const core = computeCoreFortune({ pillars: prof.value.pillars, profile: P, date, todayHanja: g.hanja });
  const personal = adjustWithEntries(core.parts.score01, [], { index: g.index, stemKo: g.stemKo, branchKo: g.branchKo });
  const score10 = toTenPoint(personal.score);
  return { core, personal, today: { ko: g.ko, hanja: g.hanja, stemKo: g.stemKo, branchKo: g.branchKo }, date, weekday: "금요일", score10, band: bandOf(score10), recent };
}
const briefFor = (date: string, recent?: ReturnType<typeof recentFromRows>) => buildBrief(inputFor(date, recent));
/** 핵심 누락 검사를 끈 brief (이 파일의 기준 글은 어느 날의 핵심에도 맞추지 않은 일반 글) */
function cleanBrief(date = "2026-10-24") {
  const b = briefFor(date);
  return { ...b, plan: { ...b.plan, coreStems: [] }, areas: [], recent: [], avoid: { headlines: [] } };
}
function okText(): Draft {
  return {
    headline: "오늘만의 새 제목이에요",
    body: [
      "오늘은 사람 만날 일보다 혼자 처리할 일이 눈에 먼저 들어와요.",
      "미뤄 둔 연락 하나를 끝내면 나머지 할 일이 또렷하게 줄을 서요.",
      "다만 잘 풀린다고 저녁에 약속을 두 개 더 잡으면 내일 아침이 무거워질 수 있어요.",
      "오늘은 잡혀 있는 것만 지키고 새 일은 적어 두기만 해요.",
    ],
    areaLines: [],
    do: "장바구니를 비우기 전에 한 번 더 들여다봐요.",
    dont: "큰돈 드는 결제는 내일로 미뤄요.",
  };
}

describe("v4.16 표현 후보 풀", () => {
  it("십신 10개마다 경향 6·과할때 2·활용 2가 있고 사주 용어가 없다", () => {
    for (const n of TEN_GOD_NAMES) {
      const e = TEN_GOD_EXPRESSIONS[n as keyof typeof TEN_GOD_EXPRESSIONS];
      expect(e.경향.length, n).toBeGreaterThanOrEqual(5);
      expect(e.과할때.length, n).toBeGreaterThanOrEqual(2);
      expect(e.활용.length, n).toBeGreaterThanOrEqual(2);
      for (const s of [...e.경향, ...e.과할때, ...e.활용]) expect(s, s).not.toMatch(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|기운|오행/);
    }
    expect(pickExpression(["a", "b", "c"], 1, ["b"])).toBe("c");
  });
  it("계획의 핵심 표현은 그날 기운의 풀에서 4개 (읽기에 따라 과할때·활용이 앞에 들어감)", () => {
    const b = briefFor("2026-10-24");
    const pool = TEN_GOD_EXPRESSIONS[b.plan.core.tenGod];
    expect(b.plan.core.expressions).toHaveLength(4);
    for (const e of b.plan.core.expressions) expect([...pool.경향, ...pool.과할때, ...pool.활용]).toContain(e);
    expect(["활용", "보통", "과함", "보류"]).toContain(b.plan.core.read);
  });
});

describe("v4.16 검사기 — 이론은 내부 판단으로만", () => {
  const brief = cleanBrief();
  it("기준 글은 통과한다", () => {
    expect(validateFortuneText(okText(), brief)).toEqual([]);
  });
  it("십신 이름·오행 기운·판정 문장·비유·성격 이름은 탈락", () => {
    const ok = okText();
    const has = (d: Partial<Draft>, pre: string) => validateFortuneText({ ...ok, ...d }, brief).some((i) => i.includes(pre));
    expect(has({ dont: "정재가 들어온 날이라 서두르지 않아요." }, '십신 이름 "정재"')).toBe(true);
    expect(has({ dont: "토 기운이 센 날이라 서두르지 않아요." }, "판정 문장")).toBe(true);
    for (const bad of ["내게 맞는 편이라 서두르지 않아요.", "내게 모자란 토가 채워지는 날이라 서두르지 않아요.", "실속을 챙기는 힘이 들어오니 서두르지 않아요.", "오늘 기운이 나를 거들어 주니 서두르지 않아요.", "이미 넉넉한 쪽이라 과해지기 쉬워요."]) {
      expect(has({ dont: bad }, "판정 문장"), bad).toBe(true);
    }
    for (const bad of ["일이 손에 잘 붙는 날이라 서두르지 않아요.", "돈 기운이 움직이는 날이라 서두르지 않아요.", "흐름이 열리는 날이라 서두르지 않아요."]) {
      expect(has({ dont: bad }, "비유") || has({ dont: bad }, "금지어"), bad).toBe(true);
    }
    expect(has({ dont: "기회와 확장이 눈에 들어와도 서두르지 않아요." }, "성격 이름")).toBe(true);
    // 일상어는 통과: "필요한 것", "토요일", "금요일에"
    expect(validateFortuneText({ ...ok, dont: "토요일엔 필요한 것만 사고 금요일에 정리해요." }, brief)).toEqual([]);
  });
  it("문장 규칙은 걸린 본문 문장을 가리킨다: 길이·결과 약속·사물 비유·속말·같은 낱말", () => {
    const ok = okText();
    const at = (s: string, i = 3) => checkDraft({ ...ok, body: ok.body.map((x, j) => (j === i ? s : x)) }, brief).filter((x) => x.field === "body").map((x) => `${x.code}@${x.index}`);
    expect(at("짧아요.")).toEqual(["length@3"]);
    expect(at("그러면 저녁에 남은 돈이 바로 보이게 돼요.")).toEqual(["promise_head@3"]);
    expect(at("볕이 드는 자리처럼 오늘은 하나씩 끝내고 싶어요.")).toEqual(["metaphor@3"]);
    expect(at("판정으로 나와요, 오늘은 하나씩 끝내고 싶은 날이에요.")).toEqual(["internal@3"]);
    expect(at("마음이 마음을 마음에 마음으로 흔들리는 날이에요.")).toEqual(["overuse@3"]);
  });
  it("꼬리 쓰레기는 잘라 낸다", () => {
    expect(trimTail("큰돈 드는 결제는 내일로 미뤄요.1")).toBe("큰돈 드는 결제는 내일로 미뤄요.");
    expect(trimTail("새로 사지 않아요.placeholder")).toBe("새로 사지 않아요.");
  });
});

describe("v4.16 템플릿·영역 보이기", () => {
  it("템플릿 본문에 십신 이름·판정 문장이 없고 생활 표현 한 줄이 앞에 온다", () => {
    const { core, personal, today } = inputFor("2026-10-24");
    const t = templateText({ ...templateInputFromCore(core), seed: 3 }, personal, today);
    expect(t.body).not.toMatch(/비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인|맞는 편|맞지 않는 쪽|모자란/);
    expect(t.body.split(". ")[0]!.length).toBeGreaterThan(8);
  });
  it("visibleAreas: all이면 그대로, 아니면 올해 줄은 그 운 문장이 있는 날만", () => {
    const areas = [{ period: "오늘" as const }, { period: "이달" as const }, { period: "올해" as const }];
    expect(visibleAreas(areas, [], { all: true })).toHaveLength(3);
    expect(visibleAreas(areas, []).map((a) => a.period)).toEqual(["오늘", "이달"]);
  });
});

describe("v4.16 2차 — 3차 말뭉치에서 나온 것", () => {
  it("최근 7일 본문 문장과 60% 이상 겹치는 본문 문장은 그 문장만 걸리고, 계획의 표현 후보에서도 뺀다", () => {
    const brief = cleanBrief();
    const ok = okText();
    const withLines = { ...brief, avoid: { ...brief.avoid, lines: [{ date: "2026-10-22", lines: [ok.body[0]!] }] } };
    expect(checkDraft(ok, withLines)).toEqual([expect.objectContaining({ code: "recent_line", field: "body", index: 0 })]);
    const rows = [{ fortune_date: "2026-10-23", content: { headline: "h", body: "오늘은 평소라면 그냥 지나쳤을 할인이나 제안, 부수입 정보가 유독 눈에 잘 들어와요. 둘째 문장이에요." } }];
    const b = briefFor("2026-10-25", recentFromRows(rows));
    const parts = [b.plan.core, ...(b.plan.support?.kind === "기운" ? [b.plan.support.part] : [])];
    for (const p of parts) if (p.tenGod === "편재") expect(p.expressions).not.toContain("평소라면 지나쳤을 할인·제안·부수입 정보를 눈여겨보게 돼요");
    expect(renderBrief(b)).not.toContain("\"lines\"");
  });
});
