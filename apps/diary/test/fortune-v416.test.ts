// v4.16 (2026-10-24, 사용자 수정 방향): 사주 이론은 내부 판단으로만, 본문은 생활 언어. 하루 핵심 하나(후보 3~5 → 선택), 십신 생활 표현 후보 풀,
// 의미 태그로 최근 7일(제목 14일) 중복 검사, 구조 A~E, 영역 0~3개 부분집합, 이달·올해 운 조건부.
import { describe, expect, it } from "vitest";
import { buildBrief, recentFromRows, renderBrief, TEN_GOD_NAMES } from "@/lib/fortune/brief";
import { computeCoreFortune } from "@/lib/fortune/core";
import { FORTUNE_EXAMPLES, TAG_KEYS, type FortuneTags } from "@/lib/fortune/examples";
import { pickExpression, TEN_GOD_EXPRESSIONS } from "@/lib/fortune/expressions";
import { OUTPUT_SCHEMA, SYSTEM, trimTail } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, toTenPoint } from "@/lib/fortune/personal";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { meaningKeys, sameMeaning, validateFortuneText, validateMeaning, validateProse, type ModelText } from "@/lib/fortune/validate";
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
const EX = FORTUNE_EXAMPLES[0]!;
const TAGS: FortuneTags = { 주제: "미뤄 둔 일 정리", 감정: "홀가분함", 상황: "끝이 분명한 일이 빨리 풀림", 영역: "돈·약속", 장면: "답장·결제·일정 확인", 권장: "연락이나 결제 하나 끝내기", 피할: "새 약속을 한꺼번에 잡기", 제목뜻: "정리하기 좋은 날" };
function okText(): ModelText {
  const body = ["오늘은 사람 만날 일보다 혼자 처리할 일이 눈에 먼저 들어와요. 미뤄 둔 연락 하나를 끝내면 나머지 할 일이 또렷하게 줄을 서요.", "다만 잘 풀린다고 저녁에 약속을 두 개 더 잡으면 내일 아침이 무거워질 수 있어요. 오늘은 잡혀 있는 것만 지키고 새 일은 적어 두기만 해요."].join("\n\n");
  return { 판단: { ...EX.text.판단 }, 태그: { ...TAGS }, headline: "오늘만의 새 제목이에요", body, areas: [], do: "장바구니를 비우기 전에 한 번 더 들여다봐요.", dont: "큰돈 드는 결제는 내일로 미뤄요." };
}
function cleanBrief(date = "2026-10-24") {
  const b = briefFor(date);
  return { ...b, areas: [], recent: [], avoid: { tags: [], headlines: [], scenes: [] } };
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
});

describe("v4.16 brief — 내부 판단과 피할 것", () => {
  it("inside에 오늘 기운의 이름·읽기·표현 후보가 있고, avoid·recent 창이 7·14·3일로 나뉜다", () => {
    const b = briefFor("2026-10-24");
    expect(b.inside.tenGods.length).toBeGreaterThanOrEqual(1);
    for (const g of b.inside.tenGods) {
      expect(TEN_GOD_NAMES).toContain(g.name);
      expect(["활용", "보통", "과함", "보류"]).toContain(g.read);
      expect(g.expressions.length).toBeGreaterThanOrEqual(3);
    }
    expect(b.inside.direction.length).toBeGreaterThan(10);
    expect(b.rules.terms).toContain("쓰지 않기");
    expect(b.rules.body).toContain("핵심 하나");
    // 최근 14일을 넘겨도 태그는 7일, 제목은 14일, 첫 문장은 3일
    const rows = Array.from({ length: 14 }, (_, i) => ({ fortune_date: `2026-10-${String(10 + i).padStart(2, "0")}`, content: { headline: `제목${i}`, body: "첫 문장이에요. 둘째 문장이에요.", tags: { ...TAGS, 장면: `장면${i}` } } }));
    const b2 = briefFor("2026-10-24", recentFromRows(rows));
    expect(b2.avoid.tags).toHaveLength(7);
    expect(b2.avoid.headlines).toHaveLength(14);
    expect(b2.avoid.scenes).toHaveLength(7);
    expect(b2.recent).toHaveLength(3);
    expect(b2.recent[0]!.date).toBe("2026-10-23");
    const json = renderBrief(b2);
    expect(json).not.toContain("\"lines\"");
    expect(json).toContain("\"avoid\"");
    expect(json).toContain("\"inside\"");
  });

  it("최근 태그와 같은 뜻인 표현 후보는 오늘 후보에서 뺀다", () => {
    const rows = [{ fortune_date: "2026-10-23", content: { headline: "h", body: "a. b.", tags: { ...TAGS, 주제: "혼자 생각하는 시간이 길어짐", 상황: "작은 일을 오래 곱씹음", 감정: "답답함" } } }];
    const b = briefFor("2026-10-25", recentFromRows(rows));   // 7일 안
    const pyeonin = b.inside.tenGods.find((g) => g.name === "편인");
    if (pyeonin) expect(pyeonin.expressions).not.toContain("혼자 생각하는 시간이 길어져요");
  });
});

describe("v4.16 스키마·예시·프롬프트", () => {
  it("OUTPUT_SCHEMA는 판단·태그·headline·body·areas·do·dont, 예시 세 편은 구조가 다르고 검사기를 통과한다", () => {
    expect(OUTPUT_SCHEMA.required).toEqual(["판단", "태그", "headline", "body", "areas", "do", "dont"]);
    expect(new Set(FORTUNE_EXAMPLES.map((e) => e.text.판단.구조)).size).toBe(3);
    for (const e of FORTUNE_EXAMPLES) {
      expect(validateFortuneText(e.text, cleanBrief()).filter((i) => !i.startsWith("예시")), e.band).toEqual([]);
      for (const k of TAG_KEYS) expect(e.text.태그[k].length, `${e.band} ${k}`).toBeGreaterThan(0);
    }
    expect(SYSTEM).toContain("[본문에 쓰지 않는 것");
    expect(SYSTEM).toContain("판단.후보");
    expect(SYSTEM).not.toContain("blocks는 정확히 4개");
  });
});

describe("v4.16 검사기 — 이론은 내부 판단으로만", () => {
  const brief = cleanBrief();
  it("기준 글은 통과한다", () => {
    expect(validateFortuneText(okText(), brief)).toEqual([]);
  });
  it("십신 이름·오행 기운·판정 문장·비유·성격 이름은 탈락", () => {
    const ok = okText();
    expect(validateFortuneText({ ...ok, dont: "정재가 들어온 날이라 서두르지 않아요." }, brief).some((i) => i.startsWith('십신 이름 "정재"'))).toBe(true);
    expect(validateFortuneText({ ...ok, dont: "토 기운이 센 날이라 서두르지 않아요." }, brief).some((i) => i.startsWith("판정 문장"))).toBe(true);
    for (const bad of ["내게 맞는 편이라 서두르지 않아요.", "내게 모자란 토가 채워지는 날이라 서두르지 않아요.", "실속을 챙기는 힘이 들어오니 서두르지 않아요.", "오늘 기운이 나를 거들어 주니 서두르지 않아요.", "이미 넉넉한 쪽이라 과해지기 쉬워요."]) {
      expect(validateFortuneText({ ...ok, dont: bad }, brief).some((i) => i.startsWith("판정 문장")), bad).toBe(true);
    }
    for (const bad of ["일이 손에 잘 붙는 날이라 서두르지 않아요.", "돈 기운이 움직이는 날이라 서두르지 않아요.", "흐름이 열리는 날이라 서두르지 않아요."]) {
      expect(validateFortuneText({ ...ok, dont: bad }, brief).some((i) => i.startsWith("비유") || i.startsWith("금지어")), bad).toBe(true);
    }
    expect(validateFortuneText({ ...ok, dont: "기회와 확장이 눈에 들어와도 서두르지 않아요." }, brief).some((i) => i.startsWith("추상 이름"))).toBe(true);
    // 일상어는 통과: "필요한 것", "토요일", "금요일에"
    expect(validateFortuneText({ ...ok, dont: "토요일엔 필요한 것만 사고 금요일에 정리해요." }, brief)).toEqual([]);
  });
  it("판단·태그가 없거나 모양이 틀리면 탈락, 영역은 입력의 부분집합 0~3개", () => {
    const ok = okText();
    expect(validateMeaning({ ...ok, 판단: undefined }, brief)).toContain("판단 칸이 없음 (후보 3~5 → 핵심 → 이유 → 구조 A~E)");
    expect(validateMeaning({ ...ok, 판단: { ...ok.판단!, 후보: ["하나"] } }, brief).some((i) => i.includes("판단.후보가 1개"))).toBe(true);
    expect(validateMeaning({ ...ok, 태그: { ...TAGS, 감정: "" } }, brief)).toContain("태그.감정가 비어 있음");
    const b2 = { ...brief, areas: [{ period: "오늘" as const, area: "재물" as const, word: "돈", signal: "↑" as const, why: "" }, { period: "이달" as const, area: "대인" as const, word: "사람", signal: "↓" as const, why: "" }] };
    expect(validateFortuneText({ ...ok, areas: [{ period: "오늘", area: "재물", line: "빠뜨린 지출이나 받을 돈이 없는지 살펴보기 좋아요." }] }, b2)).toEqual([]);
    expect(validateFortuneText({ ...ok, areas: [{ period: "오늘", area: "건강", line: "일찍 쉬는 게 남는 날이에요." }] }, b2).some((i) => i.includes("입력 areas에 없거나"))).toBe(true);
    expect(validateFortuneText({ ...ok, areas: [{ period: "이달", area: "대인", line: "사람 사이 말이 엇갈리기 쉬워 짧게 말해요." }, { period: "오늘", area: "재물", line: "빠뜨린 지출이 없는지 살펴보기 좋아요." }] }, b2).some((i) => i.includes("순서가 다름"))).toBe(true);
  });
  it("의미 태그: 유의어는 같은 뜻, 최근 7일 가운데 어느 하루와 2칸 이상 같으면 탈락, 제목뜻은 14일", () => {
    expect(sameMeaning("혼자 생각이 길어져요", "고민이 길어져요")).toBe(true);
    expect(sameMeaning("생각이 많아져요", "고민이 길어져요")).toBe(true);
    expect(sameMeaning("미뤄 둔 돈 정리", "지출 점검")).toBe(true);
    expect(sameMeaning("몸 상태 우선", "미뤄 둔 일 정리")).toBe(false);
    expect([...meaningKeys("답장을 바로 보내지 않기")]).toEqual(["말"]);
    const ok = okText();
    const same = { ...brief, avoid: { tags: [{ date: "2026-10-22", tags: { ...TAGS, 주제: "미루던 일 마무리", 권장: "결제 하나 끝내기", 제목뜻: "다른 뜻", 장면: "다른 장면", 상황: "다른 상황", 감정: "다른", 피할: "다른", 영역: "다른" } }], headlines: [], scenes: [] } };
    const issues = validateMeaning(ok, same);
    expect(issues.some((i) => i.startsWith("최근(2026-10-22)과 뜻이 같음"))).toBe(true);
    const one = { ...brief, avoid: { tags: [{ date: "2026-10-22", tags: { 주제: "미루던 일 마무리", 감정: "다른", 상황: "다른 상황", 영역: "다른", 장면: "다른 장면", 권장: "다른 행동", 피할: "다른", 제목뜻: "다른 뜻" } }], headlines: [], scenes: [] } };
    expect(validateMeaning(ok, one)).toEqual([]);
    const title = { ...brief, avoid: { tags: [{ date: "2026-10-15", tags: { ...one.avoid.tags[0]!.tags, 제목뜻: "정리하기 좋은 날" } }], headlines: [], scenes: [] } };
    expect(validateMeaning(ok, title).some((i) => i.includes("제목과 뜻이 같음"))).toBe(true);
  });
  it("문장 규칙: 길이·같은 낱말·결과 약속·비유 낱말·내부 말투, 2~3문단, 4~7문장", () => {
    expect(validateProse("짧아요. 이건 열두 자가 넘는 문장이에요.").some((i) => i.includes("12자 이상"))).toBe(true);
    expect(validateProse("그러면 저녁에 남은 돈이 바로 보이게 돼요.").some((i) => i.includes("결과를 약속"))).toBe(true);
    expect(validateProse("볕이 드는 자리처럼 오늘은 하나씩 끝내고 싶어요.").some((i) => i.includes("비유 낱말"))).toBe(true);
    expect(validateProse("판정으로 나와요, 오늘은 하나씩 끝내고 싶은 날이에요.").some((i) => i.includes("속으로 쓰는 말"))).toBe(true);
    expect(validateProse("마음이 마음을 마음에 마음으로 흔들리는 날이에요.").some((i) => i.includes("같은 낱말 되풀이"))).toBe(true);
    const ok = okText();
    expect(validateFortuneText({ ...ok, body: ok.body.replace(/\n\n/g, " ") }, brief).some((i) => i.includes("1문단"))).toBe(true);
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
  it("visibleAreas: 모델이 고른 줄은 그대로(all), 템플릿은 옛 규칙", () => {
    const areas = [{ period: "오늘" as const }, { period: "이달" as const }, { period: "올해" as const }];
    expect(visibleAreas(areas, [], { all: true })).toHaveLength(3);
    expect(visibleAreas(areas, []).map((a) => a.period)).toEqual(["오늘", "이달"]);
  });
});

describe("v4.16 2차 — 3차 말뭉치에서 나온 것", () => {
  it("뜻 중복은 영역 칸을 빼고 센다 (영역 + 한 칸만 같으면 통과)", () => {
    const brief = cleanBrief();
    const ok = okText();
    const two = { ...brief, avoid: { tags: [{ date: "2026-10-22", tags: { 주제: "다른", 감정: "다른", 상황: "다른 상황", 영역: "돈·약속", 장면: "다른 장면", 권장: "연락 하나 끝내기", 피할: "다른", 제목뜻: "다른 뜻" } }], headlines: [], scenes: [] } };
    expect(validateMeaning(ok, two)).toEqual([]);
  });
  it("최근 7일 본문 문장과 60% 이상 겹치는 본문 문장은 탈락하고, 표현 후보에서도 뺀다", () => {
    const brief = cleanBrief();
    const ok = okText();
    const sent = ok.body.split(/(?<=\.)\s+/)[0]!;
    const withLines = { ...brief, avoid: { ...brief.avoid, lines: [{ date: "2026-10-22", lines: [sent] }] } };
    expect(validateFortuneText(ok, withLines).some((i) => i.startsWith("최근(2026-10-22) 문장과 겹침"))).toBe(true);
    const rows = [{ fortune_date: "2026-10-23", content: { headline: "h", body: "오늘은 평소라면 그냥 지나쳤을 할인이나 제안, 부수입 정보가 유독 눈에 잘 들어와요. 둘째 문장이에요.", tags: TAGS } }];
    const b = briefFor("2026-10-25", recentFromRows(rows));
    const pj = b.inside.tenGods.find((g) => g.name === "편재");
    if (pj) expect(pj.expressions).not.toContain("평소라면 지나쳤을 할인·제안·부수입 정보를 눈여겨보게 돼요");
    expect(renderBrief(b)).not.toContain("\"lines\"");
  });
});
