// v5 (2026-11-14): 단락 사전으로 글감을 고르고(compose.ts) 편집자에게 넘긴다(v5.ts). 모델은 가짜 클라이언트.
// 고르는 규칙은 앱 주인이 원장의 물음에 답한 것이다 — 사주 일기/피드백/지적_원장.md "주인 확정 현황".
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildBrief, TEN_GOD_NAMES, V5_BANNED, type BriefInput } from "@/lib/fortune/brief";
import { areaScoreOf, areaScoreView } from "@/lib/fortune/areaProfile";
import { composeV5, coreIsStemV5, faceOf, pickPosition, relKey, v5Fallback, type V5Part } from "@/lib/fortune/compose";
import { echoes, SEAL_WORDS, sealCount, sealsOf } from "@/lib/fortune/seals";
import { computeCoreFortune } from "@/lib/fortune/core";
import { DICT_ACTIONS, DICT_CLOSINGS, DICT_END, DICT_PAIRS, DICT_POS, DICT_REL, DICT_SCENES, DICT_TEN_GOD, DICT_TITLES } from "@/lib/fortune/dict";
import { generateFortuneText, PROMPT_VERSION, SYSTEM } from "@/lib/fortune/llm";
import { adjustWithEntries } from "@/lib/fortune/personal";
import type { CoreFortune, CoreLuckPart, CoreRelationHit } from "@/lib/fortune/types";
import { renderBriefV5, SYSTEM_V5 } from "@/lib/fortune/v5";
import { checkDraft, V5_CHECKS, type Draft } from "@/lib/fortune/validate";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE_A, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const PILLARS = pr.value.pillars;
const coreOf = (date: string): CoreFortune => computeCoreFortune({ pillars: PILLARS, profile: PROFILE_A, date, todayHanja: dayGanji(date).hanja });
const DATE = "2026-06-15";   // 庚申 — 편재·편재(겹침), 일지 寅申충
const core = coreOf(DATE);
const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
const NONE = adjustWithEntries(core.parts.score01, [], { index: dayGanji(DATE).index, stemKo: "경", branchKo: "신" });
const input: BriefInput = { core, personal: NONE, today, date: DATE, weekday: "월요일", score10: 9.2, band: "좋음", v5: true };
const brief = buildBrief(input);
const sents = (s: string): string[] => s.split(/(?<=[.!?])\s+/).filter(Boolean);
const part = (over: Partial<CoreLuckPart>): CoreLuckPart => ({ char: "甲", tenGod: "비견", family: "비겁", label: "기", score: -3, ...over });
const hit = (pos: CoreRelationHit["pos"], kind: CoreRelationHit["kind"], strength = 2): CoreRelationHit => ({ pos, kind, direction: "중립", strength, chars: "x" });

describe("사전", () => {
  test("본문 50칸과 재료가 다 들어 있다", () => {
    expect(Object.keys(DICT_TEN_GOD)).toHaveLength(10);
    for (const t of TEN_GOD_NAMES) { expect(DICT_TEN_GOD[t as keyof typeof DICT_TEN_GOD].strong.length).toBeGreaterThan(40); expect(DICT_TEN_GOD[t as keyof typeof DICT_TEN_GOD].use.length).toBeGreaterThan(40); }
    expect(Object.keys(DICT_REL)).toHaveLength(15);
    expect(Object.values(DICT_POS).flatMap((o) => Object.values(o))).toHaveLength(12);
    expect(Object.keys(DICT_END)).toEqual(["좋음", "무난", "주의"]);
    expect(Object.values(DICT_CLOSINGS).every((x) => x.length === 10)).toBe(true);
    expect(Object.keys(DICT_PAIRS)).toHaveLength(7);
    expect(Object.values(DICT_ACTIONS).every((x) => x.length === 2)).toBe(true);
    expect(Object.values(DICT_SCENES).every((x) => x.장면.length === 5 && x.비유.length >= 1)).toBe(true);
    expect(DICT_TITLES.비견.strong).toBeTruthy();
  });

  test("앱 주인이 확정한 글은 v5 검사에 걸리지 않는다 (한 문장씩)", () => {
    const all = [
      ...Object.values(DICT_TEN_GOD).flatMap((x) => [x.strong, x.use]), ...Object.values(DICT_REL), ...Object.values(DICT_POS).flatMap((o) => Object.values(o)), ...Object.values(DICT_END),
      ...Object.values(DICT_CLOSINGS).flat(), ...Object.values(DICT_PAIRS).map((p) => p.예),
    ].flatMap(sents);
    const bad: string[] = [];
    for (let i = 0; i < all.length; i += 6) {
      const body = all.slice(i, i + 6);
      const d: Draft = { headline: "오늘의 제목", body, areaLines: [], do: "작은 목표를 정하고 끝까지 해 보세요.", dont: "함께 정할 일을 혼자 결정해 버리지 마세요." };
      // 여섯 문장씩 끊어 넣느라 생기는 "첫 문장이 이음말" 이슈는 사전 탓이 아니다
      for (const is of checkDraft(d, brief, { minBody: 1 }).filter((x) => x.code !== "connective")) bad.push(`${is.code}: ${body[is.index ?? 0]}`);
    }
    expect(bad).toEqual([]);
    // 하면·피해요와 제목 보기도
    for (const [tg, as] of Object.entries(DICT_ACTIONS)) for (const a of as) {
      const d: Draft = { headline: DICT_TITLES[tg as keyof typeof DICT_TITLES].use, body: all.slice(0, 5), areaLines: [], do: a.do, dont: a.dont };
      expect(checkDraft(d, brief, { minBody: 1 }).map((i) => `${tg} ${i.msg}`)).toEqual([]);
    }
  });
});

describe("글감 고르기", () => {
  test("읽기 → 면: 활용은 잘 쓸 때, 과함은 세질 때, 한신·시간 모름은 좋은 쪽에 부담을 곁들인다", () => {
    expect([faceOf("활용"), faceOf("과함"), faceOf("보통"), faceOf("보류")]).toEqual(["use", "strong", "both", "both"]);
  });

  test("중심: 점수 큰 쪽(같으면 천간), 같은 그룹의 다른 십신이 함께 오면 편 쪽 (물음 3)", () => {
    expect(coreIsStemV5(part({ score: -3 }), part({ tenGod: "식신", family: "식상", score: 2 }))).toBe(true);
    expect(coreIsStemV5(part({ score: 1 }), part({ tenGod: "식신", family: "식상", score: -2 }))).toBe(false);
    // 임자일(정재 천간 + 편재 지지): 천간 점수가 커도 편재가 중심
    expect(coreIsStemV5(part({ tenGod: "정재", family: "재성", score: 3 }), part({ tenGod: "편재", family: "재성", score: 2 }))).toBe(false);
    expect(coreIsStemV5(part({ tenGod: "겁재", family: "비겁", score: -1 }), part({ tenGod: "비견", family: "비겁", score: -2 }))).toBe(true);
  });

  test("닿는 자리: 연지는 쓰지 않고, 일지 > 월지·시지, 충 > 합 > 복음 (물음 1·6)", () => {
    expect(pickPosition([hit("연", "충", 3)])).toBeNull();
    expect(pickPosition([hit("일", "반합", 0.5)])).toBeNull();
    expect(pickPosition([hit("월", "충"), hit("일", "충")])).toMatchObject({ kind: "충", pos: "일", 글: DICT_POS.충.일 });
    expect(pickPosition([hit("일", "복음"), hit("시", "충")])).toMatchObject({ kind: "충", pos: "시" });
    expect(pickPosition([hit("연", "삼합"), hit("월", "육합")])).toMatchObject({ kind: "합", pos: "월" });
    expect(pickPosition([hit("일", "육합"), hit("월", "충")])).toMatchObject({ kind: "충", pos: "월" });
  });

  test("관계 열쇠는 순서와 무관하다", () => {
    expect(relKey("재성", "비겁")).toBe("비겁+재성");
    expect(relKey("관성", "관성")).toBe("관성+관성");
    expect(DICT_REL[relKey("인성", "식상")]).toBeTruthy();
  });

  test("같은 십신이 겹쳐 온 날: 곁은 없고 같은 그룹 단락으로 잇는다", () => {
    const m = composeV5({ core, band: "좋음", date: DATE });
    expect(m.겹침).toBe(true);
    expect(m.other).toBeNull();
    expect(m.core.tenGod).toBe("편재");
    expect(m.연결).toBe(DICT_REL["재성+재성"]);
    expect(m.자리).toMatchObject({ kind: "충", pos: "일" });
    expect(m.끝인사).toHaveLength(2);
    expect(DICT_CLOSINGS.좋음).toEqual(expect.arrayContaining(m.끝인사));
    expect(m.core.장면).toHaveLength(3);
  });

  test("조심 단락은 없다 — 지지 군겁쟁재 표시가 있어도 글감은 같다 (물음 13, 2026-11-15)", () => {
    const flagged: CoreFortune = { ...core, relations: { ...core.relations, flags: [...core.relations.flags, "운 子 재성이 원국 지지 비겁 3개 사이로 옴 — 군겁쟁재"] } };
    expect(composeV5({ core: flagged, band: "무난", date: DATE })).toEqual(composeV5({ core, band: "무난", date: DATE }));
    expect("조심" in composeV5({ core, band: "무난", date: DATE })).toBe(false);
  });

  test("최근에 쓴 끝인사는 다시 고르지 않는다", () => {
    const a = composeV5({ core, band: "좋음", date: DATE });
    const b = composeV5({ core, band: "좋음", date: DATE, recentEndings: a.끝인사 });
    expect(b.끝인사.some((x) => a.끝인사.includes(x))).toBe(false);
  });

  test("사전만으로 엮은 글은 사전 문장 그대로이고 열 문장을 넘지 않는다", () => {
    for (const date of ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24"]) {
      const c = coreOf(date);
      const b = buildBrief({ ...input, core: c, date });
      const f = v5Fallback(b.v5!);
      expect(f.first.length + f.second.length).toBeLessThanOrEqual(10);
      expect(f.first.length).toBeGreaterThanOrEqual(3);
      const d: Draft = { headline: f.headline, body: [...f.first, ...f.second], split: f.first.length, areaLines: [], do: f.do, dont: f.dont };
      expect(checkDraft(d, b, { minBody: 3 }).map((i) => `${date} ${i.msg}`)).toEqual([]);
    }
  });
});

describe("카드 인장 (명세 38·41)", () => {
  const P = (tenGod: V5Part["tenGod"], face: V5Part["face"], label: V5Part["label"] = face === "strong" ? "구" : face === "use" ? "희" : "한"): V5Part => ({ 자리: "천간", tenGod, family: "비겁", read: "보통", label, face, 글: "", 장면: [] });
  const w = (tg: V5Part["tenGod"], tone: "good" | "care", i = 0) => ({ word: SEAL_WORDS[tg][tone][i]!, tone });
  test("개수는 세기만큼: 용·기는 둘, 희·구는 하나, 한신은 좋은 쪽 하나 + 조심 하나, 겹친 날은 한 단계 세게", () => {
    expect(sealCount(P("편재", "use", "용"))).toEqual({ good: 2, care: 0 });
    expect(sealCount(P("겁재", "strong", "기"))).toEqual({ good: 0, care: 2 });
    expect(sealCount(P("상관", "use", "희"))).toEqual({ good: 1, care: 0 });
    expect(sealCount(P("편인", "strong", "구"))).toEqual({ good: 0, care: 1 });
    expect(sealCount(P("정관", "both", "한"))).toEqual({ good: 1, care: 1 });
    expect(sealCount(P("상관", "use", "희"), true)).toEqual({ good: 2, care: 0 });
  });
  test("좋은 것만 넷인 날, 조심할 것만 셋인 날도 된다 — 좋은 쪽이 앞", () => {
    // 12-04 임자일 꼴: 편재(용) + 정재(용)
    expect(sealsOf({ core: P("편재", "use", "용"), other: P("정재", "use", "용"), band: "무난" })).toEqual([w("편재", "good"), w("편재", "good", 1), w("정재", "good"), w("정재", "good", 1)]);
    // 12-10 무오일 꼴: 겁재(기) + 편인(구)
    expect(sealsOf({ core: P("겁재", "strong", "기"), other: P("편인", "strong", "구"), band: "주의" })).toEqual([w("겁재", "care"), w("겁재", "care", 1), w("편인", "care")]);
    // 곁이 반대 색이면 섞여서, 좋은 쪽이 앞
    expect(sealsOf({ core: P("겁재", "strong", "구"), other: P("상관", "use", "희"), band: "주의" })).toEqual([w("상관", "good"), w("겁재", "care")]);
    // 한신 겹침
    expect(sealsOf({ core: P("정관", "both", "한"), other: null, band: "무난" })).toEqual([w("정관", "good"), w("정관", "care")]);
    for (const x of Object.values(SEAL_WORDS)) for (const t of [...x.good, ...x.care]) expect(t.length).toBeLessThanOrEqual(7);   // 띄어쓰기 포함 — 앱 주인 뜻으로 옮긴 "버텨 낸 실력"이 7자
  });
  test("제목과 같은 말을 하는 낱말은 같은 쪽 다른 낱말로 바꾸거나 뺀다 (그릴링 Q1)", () => {
    const [g0, g1] = SEAL_WORDS.상관.good;
    expect(echoes(g0, `준비해 온 ${g0.split(" ")[0]}을 보여 줄 때`)).toBe(true);
    const one = sealsOf({ core: P("상관", "use", "희"), other: null, band: "좋음" }, `준비해 온 ${g0.split(" ")[0]}을 꺼내 보이는 날`);
    expect(one.map((x) => x.word)).not.toContain(g0);
    expect(one.map((x) => x.word)).toContain(g1);
    expect(sealsOf({ core: P("상관", "use", "희"), other: null, band: "좋음" }, "말이 물처럼 흐르는 날")[0]!.word).toBe(g0);
  });
  test("하나만 찍는 칸은 최근 7일에 찍힌 낱말을 피한다 — 둘 다 썼으면 정한 순서대로", () => {
    const [c0, c1] = SEAL_WORDS.편인.care;
    const day = { core: P("편인", "strong", "구"), other: P("상관", "use", "희"), band: "주의" as const };
    expect(sealsOf(day).map((x) => x.word)).toEqual([SEAL_WORDS.상관.good[0], c0]);
    expect(sealsOf(day, "", [c0, SEAL_WORDS.상관.good[0]]).map((x) => x.word)).toEqual([SEAL_WORDS.상관.good[1], c1]);
    expect(sealsOf(day, "", [c0, c1]).map((x) => x.word)).toEqual([SEAL_WORDS.상관.good[0], c0]);
  });
  test("영역 점수: 신호 없음은 5, 세기 ±3에서 1과 10", () => {
    expect([areaScoreOf(0, false), areaScoreOf(1, true), areaScoreOf(2, true), areaScoreOf(3, true), areaScoreOf(5, true)]).toEqual([5, 7, 8, 10, 10]);
    expect([areaScoreOf(-1, true), areaScoreOf(-2, true), areaScoreOf(-3, true), areaScoreOf(-5, true)]).toEqual([3, 2, 1, 1]);
    const v = areaScoreView({ core })!;
    expect(v).toHaveLength(6);
    expect(v.every((a) => a.score >= 1 && a.score <= 10 && (a.active || a.score === 5))).toBe(true);
  });
});

describe("편집자 입력과 지시", () => {
  test("v5를 켠 brief에만 글감이 있고, 문체 금지어는 싣지 않는다", () => {
    expect(brief.v5).toBeTruthy();
    expect(brief.banned).toEqual(V5_BANNED);
    const old = buildBrief({ ...input, v5: false });
    expect(old.v5).toBeUndefined();
    expect(old.banned.length).toBeGreaterThan(V5_BANNED.length);
  });

  test("입력에는 단락이 그대로 들어가고 십신 이름은 없다", () => {
    const j = JSON.parse(renderBriefV5(brief)) as { 글감: { 중심: { 성격: string; 면: string; 단락: string }; 겹침?: string; 둘사이: string; 닿는자리?: { 단락: string }; 마무리: string }; 장면: string[]; 제목_보기: string[]; 끝인사_보기: string[] };
    expect(j.글감.중심.단락).toBe(DICT_TEN_GOD.편재.use);
    expect(j.글감.중심.면).toBe("잘 쓸 때");
    expect(j.글감.겹침).toContain("두 번");
    expect(j.글감.닿는자리?.단락).toBe(DICT_POS.충.일);
    expect(j.글감.마무리).toBe(DICT_END.좋음);
    expect(j.장면).toHaveLength(3);
    expect(j.제목_보기).toEqual([DICT_TITLES.편재.use]);
    const text = renderBriefV5(brief);
    for (const n of ["편재", "정재", "겁재", "비견", "식신", "상관", "편관", "정관", "정인"]) expect(text.includes(n)).toBe(false);
  });

  test("며칠 전 같은 성격으로 나간 문장은 피할 것으로 보여 준다", () => {
    const line = sents(DICT_TEN_GOD.편재.use)[0]!;
    const b = buildBrief({ ...input, recent: [{ date: "2026-06-12", headline: "어제 제목", start: line, lines: [line, "전혀 다른 이야기를 하는 문장이에요."], actions: [] }] });
    const j = JSON.parse(renderBriefV5(b)) as { 피할것?: { 며칠전에쓴문장?: string[]; 최근제목?: string[] } };
    expect(j.피할것?.며칠전에쓴문장).toEqual([line]);
    expect(j.피할것?.최근제목).toEqual(["어제 제목"]);
  });

  test("v5 글은 열 갈래 검사만 받는다 (그릴링 Q4) — 문체 검사는 v4 글에만", () => {
    const d: Draft = { headline: "오늘의 제목이에요", body: ["그래서 앞에서 말한 것처럼 회의 전에 아침, 점심, 저녁을 챙겨요.", ...sents(DICT_TEN_GOD.편재.use)], areaLines: [], do: "작은 목표를 정하고 끝까지 해 보세요.", dont: "함께 정할 일을 혼자 결정해 버리지 마세요." };
    const v5 = checkDraft(d, brief);
    expect(v5.every((i) => V5_CHECKS.has(i.code))).toBe(true);
    const v4 = checkDraft(d, buildBrief({ ...input, v5: false }));
    expect(v4.some((i) => !V5_CHECKS.has(i.code))).toBe(true);   // 이음말·되받기·직장·시간대 나열은 v4에서만 걸린다
    expect(V5_CHECKS.size).toBeLessThanOrEqual(21);
  });
  test("편집자 지시의 엮는 법은 아홉 줄을 넘지 않는다 (그릴링 Q3)", () => {
    const rules = SYSTEM_V5.split("[엮는 법]")[1]!.split("[출력]")[0]!.trim().split("\n").filter((l) => /^\d+\./.test(l));
    expect(rules.length).toBeLessThanOrEqual(9);
    expect(SYSTEM_V5).not.toContain("글감.조심");
  });
  test("지시는 짧고 본보기·문체 금지어가 없다", () => {
    expect(SYSTEM_V5.length).toBeLessThan(SYSTEM.length / 2);
    expect(SYSTEM_V5).toContain("편집자");
    expect(SYSTEM_V5).not.toContain("[본보기");
  });

  test("v5 글감이 있으면 편집자 지시로 부르고, 사전 문장을 그대로 쓴 글도 통과한다", async () => {
    const f = v5Fallback(brief.v5!);
    const answer = { headline: "먼저 움직이면 길이 보이는 하루", first: f.first, second: f.second, do: f.do, dont: f.dont };
    const calls: { system: { text: string }[]; messages: { content: string }[] }[] = [];
    const client = { messages: { create: async (p: { system: { text: string }[]; messages: { content: string }[] }) => { calls.push(p); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answer) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }; } } };
    const r = await generateFortuneText(input, { headline: "x", body: "y", do: "z", dont: "w" }, { client: client as never, reviewModel: null });
    expect(r.issues).toEqual([[]]);
    expect(r.source).toBe("llm");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.system[0]!.text).toBe(SYSTEM_V5);
    expect(calls[0]!.messages[0]!.content).toBe(renderBriefV5(brief));
    expect(r.metrics.promptVersion.startsWith("v5.0-")).toBe(true);
    expect(r.metrics.promptVersion).not.toBe(PROMPT_VERSION);
    expect(r.text.body).toContain("\n\n");
    // v5를 끄면 옛 지시 그대로
    const calls2: { system: { text: string }[] }[] = [];
    const client2 = { messages: { create: async (p: { system: { text: string }[] }) => { calls2.push(p); throw new Error("stop"); } } };
    await generateFortuneText({ ...input, v5: false }, { headline: "x", body: "y", do: "z", dont: "w" }, { client: client2 as never, reviewModel: null, maxAttempts: 1 });
    expect(calls2[0]!.system[0]!.text).toBe(SYSTEM);
  });
});

// 2026-11-17 기록 반영(Q5) · 제목 머리 검사
import { headlineOpener, HEADLINE_OPENER_CHECK } from "@/lib/fortune/validate";
describe("기록 한 줄 글감 · 제목 머리", () => {
  test("지시는 여전히 엮는 법 9줄이고, 내기록은 5번 줄에 합쳤다", () => {
    const rules = SYSTEM_V5.split("[엮는 법]")[1]!.split("[출력]")[0]!.trim().split("\n").filter((l) => /^\d+\./.test(l));
    expect(rules).toHaveLength(9);
    expect(rules[4]).toContain("글감.내기록");
    expect(SYSTEM_V5).toContain("글감.내기록 밖의 기록 이야기");
  });
  test("제목 첫 낱말 — '오늘·내·그동안'은 건너뛴다. 2026-11-17 앱 주인이 켰다", () => {
    expect(headlineOpener("미뤄둔 일, 오늘은 한 걸음")).toBe("미뤄");
    expect(headlineOpener("오늘은 누굴 이기려 하기보다")).toBe("누굴");
    expect(headlineOpener("그동안 만든 것, 오늘은")).toBe("만든");
    expect(HEADLINE_OPENER_CHECK).toBe(true);
  });
});
