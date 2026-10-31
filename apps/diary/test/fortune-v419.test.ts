// v4.19 (2026-10-31, ChatGPT 검토 반영): 코드가 내용을 고르고(plan.ts) 모델은 작가만. 측정(metrics) · 개인 기록 편차 보정 · 걸린 문장만 수리 · 영역 신호 분리.
// 모델은 가짜 클라이언트. 사주·날짜는 fortune.test.ts의 PROFILE_A(1990-01-01 12:00 남) × 2026-06-15 庚申 (편재·편재, 일지 寅申충, 오늘 재물↑ 연애↑ / 이달 대인↓ / 올해 대인↓)
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildBrief, recentFromRows, renderBrief, TEN_GOD_NAMES, type BriefInput } from "@/lib/fortune/brief";
import { computeCoreFortune, toScore01 } from "@/lib/fortune/core";
import { FORTUNE_EXAMPLES } from "@/lib/fortune/examples";
import { applyRepair, generateFortuneText, MIN_CALL_MS, OUTPUT_SCHEMA, PROMPT_VERSION, pruneFailing, REPAIR_SCHEMA, SYSTEM, TOTAL_DEADLINE_MS, type GenerateResult } from "@/lib/fortune/llm";
import { adjustWithEntries, bandOf, MIN_ENTRIES_FOR_SHIFT, SHIFT_MAX, toTenPoint, type EntryLike } from "@/lib/fortune/personal";
import { avoidFromRecent, buildPlan, headlineEnding } from "@/lib/fortune/plan";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import type { CoreFortune } from "@/lib/fortune/types";
import { checkDraft, joinBody, needsRewrite, normalizeDraft, type Draft } from "@/lib/fortune/validate";
import { areasOf, composeAreas } from "@/lib/fortune/visible";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE_A, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const PILLARS = pr.value.pillars;
const coreOf = (date: string): CoreFortune => computeCoreFortune({ pillars: PILLARS, profile: PROFILE_A, date, todayHanja: dayGanji(date).hanja });
const DATE = "2026-06-15";
const core = coreOf(DATE);
const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
const NONE = adjustWithEntries(core.parts.score01, [], { index: dayGanji(DATE).index, stemKo: "경", branchKo: "신" });
const input: BriefInput = { core, personal: NONE, today, date: DATE, weekday: "월요일", score10: 9.2, band: "좋음" };
const brief = buildBrief(input);
const fallback = templateText(templateInputFromCore(core), NONE, today);

const GOOD: Draft = {
  headline: "눈에 들어온 제안을 적어 두는 날",
  body: [
    "평소라면 그냥 넘겼을 할인 소식이나 제안이 오늘은 자꾸 눈에 들어와요.",
    "둘러보는 재미가 있어서 이것저것 알아보고 싶은 마음이 커질 수 있어요.",
    "가까운 사람과 미뤄 둔 이야기가 다시 나오면 피하지 말고 들어 봐요.",
    "다만 마음에 든 것을 그 자리에서 정하기보다 한 번 적어 두는 편이 좋아요.",
    "하루쯤 지나 다시 봐도 괜찮은 것만 남기면 고르는 일이 한결 가벼워져요.",
  ],
  areaLines: [
    { area: "재물", text: "필요한 물건은 미리 정한 가격 안에서만 골라 봐요." },
    { area: "연애", text: "가까운 사람에게 오늘 본 재미있는 것을 먼저 보여 줘요." },
  ],
  do: "눈에 띈 제안 하나를 메모장에 적어 둬요.",
  dont: "처음 본 상품을 그 자리에서 결제하지 않아요.",
};

type Params = { model: string; temperature?: unknown; max_tokens: number; thinking: unknown; output_config: { effort: string; format: { type: string; schema: unknown } }; system: { text: string; cache_control: unknown }[]; messages: { role: string; content: string }[] };
const USAGE = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 20 };
function fakeClient(answers: (unknown | Error | "truncated")[]) {
  const calls: { params: Params; opts?: { timeout?: number } }[] = [];
  const client = {
    messages: {
      create: async (params: Params, opts?: { timeout?: number }) => {
        calls.push({ params, opts });
        const a = answers[calls.length - 1];
        if (a instanceof Error) throw a;
        if (a === "truncated") return { stop_reason: "max_tokens", content: [{ type: "text", text: '{"headline":"잘' }], usage: USAGE };
        if (a === undefined) throw new Error("답이 더 없음");
        return { stop_reason: "end_turn", content: [{ type: "text", text: typeof a === "string" ? a : JSON.stringify(a) }], usage: USAGE };
      },
    },
  };
  return { client: client as never, calls };
}
const replaceBody = (d: Draft, i: number, s: string): Draft => ({ ...d, body: d.body.map((x, j) => (j === i ? s : x)) });

describe("v4.19 개인 기록 보정 — 전체 평균 대비 편차만", () => {
  const t = { index: 47, stemKo: "신", branchKo: "해" };
  const e = (stem: string, branch: string, h: number, idx = 0): EntryLike => ({ day_ganji_index: idx, day_stem: stem, day_branch: branch, happiness: h });
  test("행복도 절대값을 섞지 않는다: 늘 행복한 사람(모든 날 9)은 점수가 그대로", () => {
    const all9 = [...Array.from({ length: 6 }, () => e("신", "자", 9)), ...Array.from({ length: 10 }, () => e("갑", "오", 9))];
    const r = adjustWithEntries(0.4, all9, t);
    expect(r).toMatchObject({ n: 6, mean: 9, overallMean: 9, shift: 0, score: 0.4 });
    expect(r.weight).toBe(0.55);   // 비교 수치는 남는다
  });
  test("편차 × w / 9, ±0.08에서 자른다", () => {
    const ents = [...Array.from({ length: 5 }, () => e("신", "자", 8)), ...Array.from({ length: 10 }, () => e("갑", "오", 5))];
    const r = adjustWithEntries(0.5, ents, t);
    const overall = (5 * 8 + 10 * 5) / 15;   // 6
    expect(r.overallMean).toBe(6);
    expect((0.5 * (8 - overall)) / 9).toBeGreaterThan(SHIFT_MAX);   // w = 5/10 → 0.111 → 0.08로 자른다
    expect(r.shift).toBe(SHIFT_MAX);
    expect(r.score).toBeCloseTo(0.58, 5);
    const low = adjustWithEntries(0.5, [...Array.from({ length: 3 }, () => e("신", "자", 5)), ...Array.from({ length: 9 }, () => e("갑", "오", 6))], t);
    expect(low.shift).toBeCloseTo((3 / 8) * (5 - 5.75) / 9, 3);   // −0.031
    expect(low.shift).toBeLessThan(0);
  });
  test("전체 기록 10개 미만 또는 같은 성분 3개 미만이면 shift 0 (비교 수치만)", () => {
    const few = Array.from({ length: MIN_ENTRIES_FOR_SHIFT - 1 }, (_, i) => e(i < 5 ? "신" : "갑", "자", i < 5 ? 10 : 1));
    expect(adjustWithEntries(0.5, few, t)).toMatchObject({ shift: 0, score: 0.5, n: 5 });
    const twoMatch = [e("신", "자", 10), e("정", "해", 10), ...Array.from({ length: 10 }, () => e("갑", "오", 2))];
    expect(adjustWithEntries(0.5, twoMatch, t)).toMatchObject({ n: 2, shift: 0, score: 0.5 });
  });
});

describe("v4.19 계획 (plan.ts) — 무엇을 말할지 코드가 고른다", () => {
  test("핵심은 |점수| 큰 쪽, 일지 충이 보조, 평일엔 맥락 재료가 없다, 영역은 ↑ 먼저 최대 2", () => {
    const p = brief.plan;
    expect(p.core.tenGod).toBe("편재");
    expect(p.core.part).toBe("천간");   // 같은 십신이면 천간(점수 ×1.5)
    expect(p.core.expressions).toHaveLength(4);
    expect(p.support).toMatchObject({ kind: "충" });
    expect(p.includeContext).toBe(false);
    expect(p.context).toEqual([]);
    expect(brief.month).toBeNull();
    expect(p.areas.map((a) => `${a.period}${a.area}${a.signal}`)).toEqual(["오늘재물↑", "오늘연애↑"]);
  });
  test("맥락: 바뀌는 날(입절일)엔 그 운 문장, ctx를 빼면 밴드가 바뀌는 날엔 올해·10년 운, 아니면 없음", () => {
    const termDay = coreOf("2026-10-08");   // 한로 = 월운이 바뀌는 날
    const pt = buildPlan({ core: termDay, personal: NONE, date: "2026-10-08", band: bandOf(toTenPoint(termDay.parts.score01)) });
    expect(pt.includeContext).toBe(true);
    expect(pt.contextReason).toBe("운이 바뀌거나 오늘과 어긋나는 날");
    expect(pt.context.some((c) => c.startsWith("이달 운"))).toBe(true);
    // ctx가 밴드를 바꾸는 날(인위): raw·rel 0이면 보통(5.0 → 무난), ctx +2면 6.7 → 무난… +3이면 7.5 → 좋음
    const tilted: CoreFortune = { ...core, facts: core.facts.filter((f) => !/^(올해 운|이달 운|지금 10년)/.test(f)), parts: { raw: 0, rel: 0, ctx: 3, score01: toScore01(3) } };
    const band = bandOf(toTenPoint(toScore01(3)));
    expect(band).toBe("좋음");
    const pc = buildPlan({ core: tilted, personal: NONE, date: DATE, band });
    expect(pc.includeContext).toBe(true);
    expect(pc.contextReason).toBe("운 맥락이 단계를 바꾸는 날");
    expect(pc.context.length).toBeGreaterThan(0);
    expect(pc.context.every((c) => /^(올해 운|지금 10년 단위 운)/.test(c))).toBe(true);
    const flat = buildPlan({ core: { ...tilted, parts: { raw: 0, rel: 0, ctx: 0.5, score01: toScore01(0.5) } }, personal: NONE, date: DATE, band: "무난" });
    expect(flat.includeContext).toBe(false);
  });
  test("피할것: 최근 장면·동작·첫 어절·제목 끝맺음을 코드로 뽑는다", () => {
    const rows = [
      { fortune_date: "2026-06-14", content: { headline: "답장을 미루지 않는 날", body: "오늘은 답장이 밀려요. 결제할 것도 확인해요.", do: "답장 하나를 보내요.", dont: "결제를 미루지 않아요." } },
      { fortune_date: "2026-06-13", content: { headline: "정리하기 좋은 날", body: "오늘은 서랍 정리가 손에 맞아요. 확인할 일이 많아요.", do: "서랍 하나를 비워요.", dont: "새 일을 벌이지 않아요." } },
      { fortune_date: "2026-05-20", content: { headline: "오래전 날", body: "산책이 좋아요.", do: "a요.", dont: "b요." } },
    ];
    const av = avoidFromRecent(DATE, recentFromRows(rows));
    expect(av.scenes).toEqual(expect.arrayContaining(["답장", "결제", "서랍"]));
    expect(av.scenes).not.toContain("산책");   // 7일 밖
    expect(av.verbs).toEqual(expect.arrayContaining(["보내", "미루", "확인"]));
    expect(av.openers).toEqual(["오늘은"]);
    expect(av.headlineEndings).toEqual(["날"]);
    expect(headlineEnding("오늘은 계획보다 회복이 먼저예요")).toBe("~요");
    expect(av.headlines).toEqual(["답장을 미루지 않는 날", "정리하기 좋은 날"]);
  });
});

describe("v4.19 brief·SYSTEM 줄이기", () => {
  test("모델에게 가는 brief: 계획 칸만, 십신 이름·판정 사실 문장·금지어 목록·태그·rules 없음", () => {
    const json = renderBrief(brief);
    const o = JSON.parse(json) as Record<string, unknown>;
    expect(Object.keys(o)).toEqual(expect.arrayContaining(["단계", "말투", "핵심", "영역", "숫자"]));
    expect(o).not.toHaveProperty("오늘");   // v4.20: 날짜·요일·절기는 보내지 않는다
    for (const k of ["inside", "rules", "banned", "jargon", "personal", "mine", "facts", "맥락", "tags", "avoid"]) expect(o).not.toHaveProperty(k);
    for (const n of TEN_GOD_NAMES) expect(json).not.toContain(n);
    expect(json).not.toMatch(/채워져요|넉넉한/);
    expect(json.length).toBeLessThan(1200);
    expect(brief.allowedNumbers).toEqual([]);   // v4.21: 날짜 숫자 없음
  });
  test("SYSTEM: 글쓰기 철학 + 절대 금지 한 번, 예시 세 편 없음, 2,500자 안. 스키마는 작가 칸만", () => {
    expect(SYSTEM).toContain("[절대 쓰지 않는 것]");
    expect(SYSTEM.length).toBeLessThan(2500);
    for (const e of FORTUNE_EXAMPLES) expect(SYSTEM).not.toContain(e.text.headline);
    expect(SYSTEM).not.toContain("판단.후보");
    expect(SYSTEM.split("흐름").length - 1).toBeLessThanOrEqual(2);   // 금지 낱말은 목록에 한 번 (+ 비유 예 한 번)
    expect(OUTPUT_SCHEMA.required).toEqual(["headline", "body", "do", "dont"]);   // v4.20: 영역 줄은 모델이 쓰지 않는다
    expect(OUTPUT_SCHEMA.properties).not.toHaveProperty("areaLines");
    expect(OUTPUT_SCHEMA.properties.body.type).toBe("array");
    expect(REPAIR_SCHEMA.properties.fixes.items.properties.action.enum).toEqual(["replace", "delete"]);
    expect(PROMPT_VERSION).toMatch(/^v4\.21-[0-9a-f]{8}$/);
  });
});

describe("v4.19 검사기 — 구조화 이슈", () => {
  test("기준 글은 통과", () => {
    expect(checkDraft(GOOD, brief)).toEqual([]);
  });
  test("걸린 문장 하나를 가리킨다 (field·index)", () => {
    const r = checkDraft(replaceBody(GOOD, 2, "가까운 사람과의 흐름이 바뀌면 피하지 말고 들어 봐요."), brief);
    expect(r).toEqual([expect.objectContaining({ code: "banned", field: "body", index: 2 })]);
    expect(checkDraft({ ...GOOD, headline: "편재가 들어오는 날" }, brief)).toEqual([expect.objectContaining({ code: "tengod", field: "headline" })]);
    expect(checkDraft({ ...GOOD, do: "제안은 적어 두세요." }, brief)).toEqual([expect.objectContaining({ code: "ending", field: "do" })]);
    const area = checkDraft({ ...GOOD, areaLines: [GOOD.areaLines[0]!, { area: "연애", text: "선물은 짝이 맞게 두 개 골라 봐요." }] }, brief);
    expect(area).toEqual([expect.objectContaining({ code: "structure", field: "area", index: 1 })]);
    expect(needsRewrite(area)).toBe(false);
  });
  test("다시 쓰기는 JSON 아님·문장이 너무 적음·핵심 누락일 때만", () => {
    expect(needsRewrite(checkDraft(null, brief))).toBe(true);
    expect(checkDraft({ ...GOOD, body: GOOD.body.slice(0, 3) }, brief)).toEqual([]);   // v4.20: 3문장도 받는다
    const short = checkDraft({ ...GOOD, body: GOOD.body.slice(0, 2) }, brief);
    expect(short).toEqual([expect.objectContaining({ code: "body_count", field: "whole" })]);
    const off = checkDraft({ ...GOOD, body: ["오늘은 몸이 조금 무겁게 느껴질 수 있어요.", "밥을 거르지 말고 쉬는 시간을 먼저 챙겨 봐요.", "운동은 가볍게 걷는 정도로 줄여도 괜찮아요.", "잠들기 전에는 화면을 조금 일찍 꺼 두는 편이 좋아요."] }, brief);
    expect(off.some((i) => i.code === "core_missing")).toBe(true);
  });
  test("반복: 태그 겹침으로 거부하지 않고, 최근 제목 동일·3일 첫 문장 동일·7일 문장 유사는 그 칸만", () => {
    const rows = [{ fortune_date: "2026-06-14", content: { headline: GOOD.headline, body: `${GOOD.body[0]} 다른 둘째 문장이에요.`, tags: { 주제: "기회", 감정: "설렘", 상황: "제안", 영역: "돈", 장면: "할인", 권장: "적기", 피할: "결제", 제목뜻: "제안" } } }];
    const b2 = buildBrief({ ...input, recent: recentFromRows(rows) });
    const r = checkDraft(GOOD, b2);
    expect(r.map((i) => `${i.code}@${i.field}${i.index ?? ""}`).sort()).toEqual(["recent_headline@headline", "recent_line@body0", "recent_start@body0"]);
    expect(needsRewrite(r)).toBe(false);
  });
  test("normalizeDraft: 한 원소에 두 문장이면 나누고, 꼬리 쓰레기를 떼고, 옛 꼴(areas·body 문자열)도 받는다", () => {
    const d = normalizeDraft({ headline: "제목이에요", body: ["첫 문장이에요. 둘째 문장이에요.", "셋째예요.1"], areaLines: [], do: "해요.」", dont: "않아요." })!;
    expect(d.body).toEqual(["첫 문장이에요.", "둘째 문장이에요.", "셋째예요."]);
    expect(d.do).toBe("해요.");
    const old = normalizeDraft({ headline: "h", body: "가요. 나요.\n\n다요.", areas: [{ period: "오늘", area: "재물", line: "줄이에요." }], do: "a", dont: "b" })!;
    expect(old.body).toHaveLength(3);
    expect(old.areaLines).toEqual([{ area: "재물", text: "줄이에요." }]);
    expect(joinBody(GOOD.body)).toBe(`${GOOD.body.slice(0, 2).join(" ")}\n\n${GOOD.body.slice(2).join(" ")}`);
  });
  test("applyRepair·pruneFailing: 표시한 칸만 바꾸고, 그래도 본문이 걸려 있으면 지우지 않고 null(템플릿) — v4.20", () => {
    const bad = replaceBody(GOOD, 2, "가까운 사람과의 흐름이 바뀌면 피하지 말고 들어 봐요.");
    const fixed = applyRepair(bad, { fixes: [{ id: "body.2", action: "replace", text: "가까운 사람과 미뤄 둔 이야기가 나오면 끝까지 들어 봐요." }, { id: "headline", action: "replace", text: "몰래 바꾼 제목" }] }, new Set(["body.2"]));
    expect(fixed.headline).toBe(GOOD.headline);   // 표시하지 않은 칸은 무시
    expect(checkDraft(fixed, brief)).toEqual([]);
    const dropped = applyRepair(bad, { fixes: [{ id: "body.2", action: "delete", text: "" }] }, new Set(["body.2"]));
    expect(dropped.body).toHaveLength(4);
    expect(pruneFailing(bad, brief)).toBeNull();   // 본문 문장을 지워 비약을 만들지 않는다
    expect(pruneFailing({ ...bad, headline: "흐름이 좋은 날" }, brief)).toBeNull();   // 제목은 지울 수 없다
  });
});

describe("v4.19 파이프라인 — 초안 1 + 수리 최대 2라운드, 측정", () => {
  const m = (r: GenerateResult) => r.metrics.calls.map((c) => `${c.kind}:${c.issueCodes.join("+") || "ok"}`);
  test("첫 초안이 통과: 호출 1, firstPass, 본문 배열·영역 문장(기간은 계획 것)·코드 태그, 요청 모양", async () => {
    const { client, calls } = fakeClient([GOOD]);
    const r = await generateFortuneText(input, fallback, { client, model: "claude-sonnet-5", reviewModel: null });
    expect(r).toMatchObject({ source: "llm", attempts: 1, patches: 0, model: "claude-sonnet-5" });
    expect(r.metrics.firstPass).toBe(true);
    expect(m(r)).toEqual(["draft:ok"]);
    expect(r.metrics.calls[0]).toMatchObject({ input: 100, output: 50, cacheRead: 10, cacheWrite: 20, model: "claude-sonnet-5" });
    expect(r.metrics.promptVersion).toBe(PROMPT_VERSION);
    expect(r.bodySentences).toEqual(GOOD.body);
    expect(r.text.body).toBe(joinBody(GOOD.body));
    expect(r.areaNarratives).toEqual([{ period: "오늘", area: "재물", text: GOOD.areaLines[0]!.text }, { period: "오늘", area: "연애", text: GOOD.areaLines[1]!.text }]);
    expect(r.tags).toMatchObject({ 주제: "기회와 확장 · 활용", 권장: GOOD.do, 제목뜻: GOOD.headline });
    expect(r.usage).toEqual({ input: 100, output: 50, cacheRead: 10, cacheWrite: 20 });
    const p = calls[0]!.params;
    expect(p.temperature).toBeUndefined();
    expect(p.max_tokens).toBe(4096);
    expect(p.thinking).toEqual({ type: "adaptive" });
    expect(p.output_config).toEqual({ effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } });
    expect(p.system[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect(p.messages.map((x) => x.role)).toEqual(["user"]);
    expect(p.messages[0]!.content).toBe(renderBrief(brief));
    expect(calls[0]!.opts!.timeout).toBeLessThanOrEqual(20_000);
  });
  test("계획에 없는 영역 줄은 버린다", async () => {
    const { client } = fakeClient([{ ...GOOD, areaLines: [...GOOD.areaLines, { area: "가족", text: "가족에게 먼저 연락해 봐요." }] }]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.areaNarratives!.map((a) => a.area)).toEqual(["재물", "연애"]);
  });
  test("문장 하나가 걸리면 그 문장만 수리(호출 2, patch). 다른 문장·제목은 그대로, 요청에 id·앞뒤 문장·사유", async () => {
    const bad = replaceBody(GOOD, 2, "가까운 사람과의 흐름이 바뀌면 피하지 말고 들어 봐요.");
    const fix = { fixes: [{ id: "body.2", action: "replace", text: "가까운 사람과 미뤄 둔 이야기가 나오면 끝까지 들어 봐요." }] };
    const { client, calls } = fakeClient([bad, fix]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null, patchModel: "claude-haiku-4-5" });
    expect(r).toMatchObject({ source: "llm", attempts: 2, patches: 1 });
    expect(r.metrics.firstPass).toBe(false);
    expect(m(r)).toEqual(["draft:banned", "patch:ok"]);
    expect(r.bodySentences).toEqual(GOOD.body.map((s, i) => (i === 2 ? fix.fixes[0]!.text : s)));
    const p = calls[1]!.params;
    expect(p.model).toBe("claude-haiku-4-5");
    expect(r.metrics.calls[1]!.model).toBe("claude-haiku-4-5");
    expect(p.output_config.format.schema).toEqual(REPAIR_SCHEMA);
    const content = p.messages[0]!.content;
    expect(content).toContain("[수리]");
    expect(content).toContain('"id":"body.2"');
    expect(content).toContain(GOOD.body[1]!);   // 앞 문장
    expect(content).toContain(GOOD.body[3]!);   // 뒤 문장
    expect(content).toContain('금지어 \\"흐름\\"');
  });
  test("FORTUNE_PATCH_MODEL이 없으면 수리도 글쓰기 모델, 있으면 그 모델", async () => {
    const bad = { ...GOOD, do: "제안은 적어 두세요." };
    const fix = { fixes: [{ id: "do", action: "replace", text: "눈에 띈 제안 하나를 메모장에 적어 둬요." }] };
    const a = fakeClient([bad, fix]);
    await generateFortuneText(input, fallback, { client: a.client, model: "claude-sonnet-5", reviewModel: null });
    expect(a.calls[1]!.params.model).toBe("claude-sonnet-5");
    process.env.FORTUNE_PATCH_MODEL = "claude-haiku-4-5";
    try {
      const b = fakeClient([bad, fix]);
      await generateFortuneText(input, fallback, { client: b.client, model: "claude-sonnet-5", reviewModel: null });
      expect(b.calls[1]!.params.model).toBe("claude-haiku-4-5");
    } finally {
      delete process.env.FORTUNE_PATCH_MODEL;
    }
  });
  test("수리 두 번 다 실패한 본문 문장은 지우지 않고 템플릿 (호출 3) — v4.20", async () => {
    const bad = replaceBody(GOOD, 2, "가까운 사람과의 흐름이 바뀌면 피하지 말고 들어 봐요.");
    const still = { fixes: [{ id: "body.2", action: "replace", text: "가까운 사람과의 흐름을 따라 들어 봐요." }] };
    const { client } = fakeClient([bad, still, still]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r).toMatchObject({ source: "template", attempts: 3 });
    expect(m(r)).toEqual(["draft:banned", "patch:banned", "patch:banned"]);
    expect(r.metrics.fallback).toBe("unresolved");
  });
  test("4문장 초안의 걸린 문장도 지우지 않는다. 수리 중 API 장애면 템플릿 + transient api — v4.20", async () => {
    const four = { ...GOOD, body: GOOD.body.slice(0, 4).map((s, i) => (i === 1 ? "둘러보는 흐름이 재미있어서 이것저것 알아보고 싶어져요." : s)) };
    const still = { fixes: [{ id: "body.1", action: "replace", text: "흐름을 타고 이것저것 알아보고 싶어져요." }] };
    const a = fakeClient([four, still, still]);
    const r1 = await generateFortuneText(input, fallback, { client: a.client, reviewModel: null });
    expect(r1.source).toBe("template");
    const b = fakeClient([four, new Error("overloaded")]);
    const r2 = await generateFortuneText(input, fallback, { client: b.client, reviewModel: null });
    expect(r2).toMatchObject({ source: "template", attempts: 2, transient: "api" });
    expect(r2.metrics.calls.map((c) => c.issueCodes.join("+"))).toEqual(["banned", "api"]);
  });
  test("제목이 끝까지 걸리면 템플릿 — 그래도 쓴 토큰·호출은 usage·metrics에 남는다", async () => {
    const bad = { ...GOOD, headline: "흐름이 좋은 날" };
    const still = { fixes: [{ id: "headline", action: "replace", text: "흐름이 좋은 하루" }] };
    const { client } = fakeClient([bad, still, still]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r).toMatchObject({ source: "template", attempts: 3, model: null, text: fallback });
    expect(r.metrics.fallback).toBe("unresolved");
    expect(r.usage.input).toBe(300);
    expect(r.metrics.calls).toHaveLength(3);
  });
  test("문장이 너무 적으면 글 전체 다시 쓰기(rewrite) → 통과", async () => {
    const { client, calls } = fakeClient([{ ...GOOD, body: GOOD.body.slice(0, 2) }, GOOD]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(m(r)).toEqual(["draft:body_count", "rewrite:ok"]);
    expect(r.source).toBe("llm");
    expect(calls[1]!.params.messages[0]!.content).toContain("[다시 쓰기]");
    expect(calls[1]!.params.output_config.format.schema).toEqual(OUTPUT_SCHEMA);
  });
  test("잘림·JSON 깨짐은 다시 쓰기, API 오류는 transient 템플릿, 거절은 템플릿", async () => {
    const t = fakeClient(["truncated", GOOD]);
    const r1 = await generateFortuneText(input, fallback, { client: t.client, reviewModel: null });
    expect(m(r1)).toEqual(["draft:truncated", "rewrite:ok"]);
    expect(r1.source).toBe("llm");
    expect(t.calls[1]!.params.messages[0]!.content).toContain("끊겨");
    const j = fakeClient(["{not json", GOOD]);
    expect((await generateFortuneText(input, fallback, { client: j.client, reviewModel: null })).metrics.calls[0]!.issueCodes).toEqual(["json"]);
    const a = fakeClient([new Error("Request timed out.")]);
    const r2 = await generateFortuneText(input, fallback, { client: a.client, reviewModel: null });
    expect(r2).toMatchObject({ source: "template", transient: "api", attempts: 1 });
    expect(r2.metrics.fallback).toBe("api");
    const refusal = { messages: { create: async () => ({ stop_reason: "refusal", content: [], usage: USAGE }) } } as never;
    const r3 = await generateFortuneText(input, fallback, { client: refusal, reviewModel: null });
    expect(r3).toMatchObject({ source: "template", attempts: 1 });
    expect(r3.metrics.fallback).toBe("refusal");
    expect(r3.usage.input).toBe(100);
  });
  test("시간: 남은 시간이 MIN_CALL_MS보다 적으면 수리를 시작하지 않는다 — 본문이든 제목이든 걸렸으면 템플릿(deadline) — v4.20", async () => {
    let clock = 0;
    const now = () => clock;
    const slow = (answer: unknown) => ({ messages: { create: async () => { clock += TOTAL_DEADLINE_MS - MIN_CALL_MS + 1; return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(answer) }], usage: USAGE }; } } }) as never;
    const r1 = await generateFortuneText(input, fallback, { client: slow(replaceBody(GOOD, 2, "가까운 사람과의 흐름이 바뀌면 피하지 말고 들어 봐요.")), reviewModel: null, now });
    expect(r1).toMatchObject({ source: "template", attempts: 1 });
    expect(r1.metrics.fallback).toBe("deadline");
    expect(r1.metrics.calls[0]!.ms).toBe(TOTAL_DEADLINE_MS - MIN_CALL_MS + 1);
    clock = 0;
    const r2 = await generateFortuneText(input, fallback, { client: slow({ ...GOOD, headline: "흐름이 좋은 날" }), reviewModel: null, now });
    expect(r2).toMatchObject({ source: "template", attempts: 1 });
    expect(r2.metrics.fallback).toBe("deadline");
  });
  test("키가 없으면 부르지 않고 템플릿 (no_key)", async () => {
    const prev = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const r = await generateFortuneText(input, fallback);
      expect(r).toMatchObject({ source: "template", attempts: 0 });
      expect(r.metrics.fallback).toBe("no_key");
    } finally {
      if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev;
    }
  });
});

describe("v4.19 content (computeFortune) — metrics·영역 신호 분리·키워드", () => {
  const req = { date: DATE, pillars: PILLARS, profile: PROFILE_A, entries: [] as EntryLike[] };
  test("모델 글: metrics(시간·호출), 영역 신호 전부 + 모델 문장, 화면 호환 areas, 본문 배열", async () => {
    const { computeFortune } = await import("@/lib/fortune");
    const { client } = fakeClient([GOOD]);
    const c = await computeFortune(req, { useModel: true, generate: (i, f) => generateFortuneText(i, f, { client, reviewModel: null }) });
    expect(c.source).toBe("llm");
    expect(c.metrics).toMatchObject({ promptVersion: PROMPT_VERSION, firstPass: true, calls: [expect.objectContaining({ kind: "draft", issueCodes: [] })] });
    expect(c.metrics!.fallback).toBeUndefined();
    for (const k of ["totalMs", "coreMs", "briefMs"] as const) expect(c.metrics![k]).toBeGreaterThanOrEqual(0);
    expect(c.areaSignals!.map((a) => `${a.period}${a.area}${a.signal}`)).toEqual(core.areas.map((a) => `${a.period}${a.area}${a.signal}`));
    expect(c.areaNarratives).toEqual([]);   // v4.20: 모델이 영역 줄을 쓰지 않는다
    // 화면(FortuneCard)이 읽는 areas: 오늘 둘은 코드 상태말, 이달은 빈 줄(화살표 칩만), 올해는 그 운 문장이 없는 날이라 숨김(v4.5), →는 없음
    expect(c.areas!.map((a) => `${a.period}${a.area}`)).toEqual(["오늘재물", "오늘연애", "이달대인"]);
    expect(c.areas![0]!.line).toBe("돈 판단이 차분한 쪽");
    expect(c.areas![2]!.line).toBe("");
    expect(areasOf(c)).toEqual(c.areas);
    expect(c.bodySentences).toEqual(GOOD.body);
    expect(c.body).toContain("\n\n");
    expect(c.keywords).toEqual(core.keywords);
    expect(c.plan).toMatchObject({ core: { tenGod: "편재" }, includeContext: false });
    expect(c.usage).toEqual({ input: 100, output: 50, cacheRead: 10, cacheWrite: 20 });
    expect(JSON.stringify(c.metrics)).not.toContain(GOOD.body[0]);   // 본문은 측정에 없다
  });
  test("템플릿으로 떨어져도 usage·metrics가 남고, 모델을 안 쓰면 no_model", async () => {
    const { computeFortune } = await import("@/lib/fortune");
    const { client } = fakeClient([{ ...GOOD, headline: "흐름이 좋은 날" }, { fixes: [] }, { fixes: [] }]);
    const c = await computeFortune(req, { useModel: true, generate: (i, f) => generateFortuneText(i, f, { client, reviewModel: null }) });
    expect(c.source).toBe("template");
    expect(c.usage).toEqual({ input: 300, output: 150, cacheRead: 30, cacheWrite: 60 });
    expect(c.metrics).toMatchObject({ fallback: "unresolved", firstPass: false });
    expect(c.metrics!.calls).toHaveLength(3);
    expect(c.areaSignals).toHaveLength(core.areas.length);
    const t = await computeFortune(req, { useModel: false });
    expect(t.metrics).toMatchObject({ fallback: "no_model", calls: [] });
    expect(t.usage).toBeUndefined();
    expect(t.areas!.map((a) => a.area)).toEqual(["재물", "연애", "대인"]);
  });
  test("composeAreas·areasOf: 옛 캐시는 저장된 areas 그대로, 같은 영역·신호 두 번이면 둘째 변형", () => {
    const old = { areas: [{ period: "오늘" as const, area: "재물" as const, signal: "↑" as const, line: "옛 줄이에요." }] };
    expect(areasOf(old)).toEqual(old.areas);
    const rows = composeAreas([{ period: "오늘", area: "대인", signal: "↓" }, { period: "이달", area: "대인", signal: "↓" }], [], []);
    expect(rows[0]!.line).not.toBe(rows[1]!.line);
    expect(composeAreas([{ period: "올해", area: "대인", signal: "↓" }], [], ["올해 운 병오은 조심할 편이에요."])).toHaveLength(1);
    expect(composeAreas([{ period: "올해", area: "대인", signal: "↓" }], [], [])).toHaveLength(0);
  });
  test("recentFromRows: bodySentences·하면·피해요·areaNarratives를 읽는다", () => {
    const [r] = recentFromRows([{ fortune_date: "2026-06-14", content: { headline: "h", body: "합친 본문", bodySentences: ["가요.", "나요."], do: "해요.", dont: "않아요.", areaNarratives: [{ period: "이달", text: "이달엔 줄이에요." }, { period: "오늘", text: "오늘 줄" }] } }]);
    expect(r).toMatchObject({ lines: ["가요.", "나요."], actions: ["해요.", "않아요."], areas: ["이달엔 줄이에요."] });
  });
});
