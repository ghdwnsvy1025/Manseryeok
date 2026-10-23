// v4.10(2026-10-14): 뼈대 한 줄(핵심) · 이음말 검사 · 문맥 검수(FORTUNE_REVIEW_MODEL) — 가짜 클라이언트로 흐름만 본다. 사주·날짜는 fortune.test.ts의 PROFILE_A와 같음
import { describe, expect, test } from "vitest";
import { OUTPUT_SCHEMA, SYSTEM, generateFortuneText } from "@/lib/fortune/llm";
import { buildBrief, type BriefInput } from "@/lib/fortune/brief";
import { validateFortuneText, type ModelText } from "@/lib/fortune/validate";
import { parseReview, reviewUser, reviewRewriteContent, REVIEW_SYSTEM } from "@/lib/fortune/review";
import { computeCoreFortune } from "@/lib/fortune/core";
import { templateInputFromCore, templateText } from "@/lib/fortune/text";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const c = computeProfile({ ...PROFILE_A, name: "x" }); if (!c.ok) throw new Error(c.error);
const DATE = "2026-06-15";
const core = computeCoreFortune({ pillars: c.value.pillars, profile: PROFILE_A, date: DATE, todayHanja: dayGanji(DATE).hanja });
const today = { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" };
const NONE = { n: 0, mean: null, sameGanjiCount: 0, sameGanjiMean: null, weight: 0, score: 0.5 };
const input: BriefInput = { core, personal: NONE, today, date: DATE, weekday: "월요일", score10: 9.2, band: "좋음" };
const brief = buildBrief(input);
const fallback = templateText(templateInputFromCore(core), NONE, today);

const good: ModelText = {
  핵심: "밀고 싶은 마음이 들어와 나에게 과해지기 쉬운 날이라, 할 일을 하나로 줄이면 편해요",
  headline: "할 일이 자꾸 늘어나는 날",
  body: "이달 갑오월은 내게 조심할 편이에요. 그래도 오늘 경신일은 기회와 확장을 뜻하는 편재가 아주 센 날이고 내게 모자란 금을 채우는 쪽이라, 사고 싶은 것과 새 제안이 자꾸 눈에 들어와요.\n\n집에 와서 미뤄 둔 정리와 답장을 한 번에 하려다 둘 다 어정쩡해지기 쉬워요. 오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요.",
  areas: brief.areas.map((a) => ({ period: a.period, area: a.area, line: ({ 대인: "사람 일은 평소와 비슷해요.", 재물: "돈 쓰는 일은 계획대로 가요.", 직업: "일은 평소 속도로 가요.", 학업: "배우는 일은 평소와 비슷해요.", 연애: "관계는 평소와 비슷해요.", 가족: "가족 일은 평소와 비슷해요.", 건강: "몸 상태는 평소와 비슷해요." } as Record<string, string>)[a.area]! })),
  do: "저녁에 할 일 하나를 골라 그것만 끝내요.",
  dont: "답장과 정리를 같은 시간에 벌이지 않아요.",
};
const fixedBody = good.body.replace("오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요.", "그래서 오늘은 둘 중 하나만 골라 끝까지 하는 쪽이 마음이 편해요.");
const fixed: ModelText = { ...good, body: fixedBody };
const problems = JSON.stringify({ 문제: [{ 종류: "끊김", 인용: "오늘은 하나만 골라 끝까지", 왜: "앞 문장의 어정쩡해짐을 받지 않음", 고칠방향: "앞 문장을 받는 이음말로" }] });

const fakeClient = (answers: (ModelText | string)[]) => {
  const calls: { system?: unknown; messages: { content: string }[]; model: string }[] = [];
  const client = { messages: { create: async (params: never) => {
    calls.push(params); const a = answers[calls.length - 1]!;
    return { stop_reason: "end_turn", content: [{ type: "text", text: typeof a === "string" ? a : JSON.stringify(a) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  } } };
  return { client: client as never, calls };
};

describe("v4.10 뼈대 한 줄", () => {
  test("스키마의 첫 칸이 핵심이고 필수. 프롬프트에 [뼈대] 블록", () => {
    expect(Object.keys(OUTPUT_SCHEMA.properties)[0]).toBe("핵심");
    expect(OUTPUT_SCHEMA.required[0]).toBe("핵심");
    expect(SYSTEM).toContain("[뼈대 — 글을 쓰기 전에 먼저 정합니다]");
    expect(SYSTEM).toContain("아무 날에나 맞는 말은 쓰지 않습니다");
  });
  test("핵심은 화면 글(text)에 들어가지 않고 result.core로만 남는다", async () => {
    const { client } = fakeClient([good]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.source).toBe("llm"); expect(r.core).toBe(good.핵심); expect((r.text as unknown as Record<string, unknown>).핵심).toBeUndefined(); expect(r.review).toBeUndefined();
  });
});

describe("v4.10 이음말 검사", () => {
  test("첫 문장이 '그래서'로 시작하면 탈락, '그래서' 두 번이면 탈락, 한 번은 통과", () => {
    expect(validateFortuneText(good, brief)).toEqual([]);
    const a = validateFortuneText({ ...good, body: "그래서 마음이 앞서는 날이에요. " + good.body.split(". ").slice(1).join(". ") }, brief);
    expect(a.some((x) => x.includes("첫 문장이 이음말로 시작"))).toBe(true);
    const b = validateFortuneText({ ...good, body: good.body.replace("집에 와서", "그래서 집에 와서").replace("오늘은 하나만", "그래서 오늘은 하나만") }, brief);
    expect(b.some((x) => x.includes("'그래서'가 2번"))).toBe(true);
    expect(validateFortuneText(fixed, brief)).toEqual([]);
  });
});

describe("v4.10 문맥 검수", () => {
  test("검수 모델이 없으면(기본) 호출 1회, review 없음", async () => {
    const { client, calls } = fakeClient([good]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(calls.length).toBe(1); expect(r.review).toBeUndefined();
  });
  test("문제 없음 → 통과(호출 2회). 문제 있음 → 고쳐 쓰기 → 검사 통과면 적용(호출 3회, 검수 모델은 검수 호출에만)", async () => {
    const ok = fakeClient([good, '{"문제":[]}']);
    const r1 = await generateFortuneText(input, fallback, { client: ok.client, reviewModel: "claude-haiku-4-5-20251001" });
    expect(ok.calls.length).toBe(2); expect(r1.review?.status).toBe("통과"); expect(ok.calls[1]!.model).toBe("claude-haiku-4-5-20251001"); expect(ok.calls[1]!.system).toEqual([{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }]);
    const fix = fakeClient([good, problems, fixed]);
    const r2 = await generateFortuneText(input, fallback, { client: fix.client, reviewModel: "claude-haiku-4-5-20251001" });
    expect(fix.calls.length).toBe(3); expect(r2.review?.status).toBe("적용"); expect(r2.text.body).toBe(fixedBody); expect(r2.review?.problems[0]).toMatch(/^\[끊김\]/);
    expect(fix.calls[2]!.messages[0]!.content).toContain("[편집자가 먼저 쓴 글을 검수했습니다"); expect(fix.calls[2]!.model).not.toBe("claude-haiku-4-5-20251001");
  });
  test("고친 글이 검사에 걸리면 초고 유지(탈락), 검수 호출이 실패해도 초고는 산다", async () => {
    const bad = fakeClient([good, problems, { ...good, body: "그래서 " + good.body }]);
    const r1 = await generateFortuneText(input, fallback, { client: bad.client, reviewModel: "x" });
    expect(r1.review?.status).toBe("탈락"); expect(r1.text.body).toBe(good.body); expect(r1.review?.why).toContain("이음말");
    let n = 0; const down = { messages: { create: async () => { if (++n === 2) throw new Error("네트워크"); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(good) }], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }; } } } as never;
    const r2 = await generateFortuneText(input, fallback, { client: down, reviewModel: "x" });
    expect(r2.source).toBe("llm"); expect(r2.review?.status).toBe("탈락"); expect(r2.review?.why).toContain("검수 호출 실패");
  });
  test("편집자 답 파싱: 글에 없는 인용·모르는 종류는 버림. 되돌려 보내는 말에 길이 한도와 먼저 쓴 글", () => {
    const ps = parseReview(JSON.stringify({ 문제: [{ 종류: "뻔한말", 인용: "하나만 골라 끝까지", 왜: "a", 고칠방향: "b" }, { 종류: "맞춤법", 인용: "마음이 앞서는", 왜: "c" }, { 종류: "비약", 인용: "글에 없는 문장", 왜: "d" }] }), good);
    expect(ps.map((p) => p.종류)).toEqual(["뻔한말"]);
    expect(parseReview("형식 아님", good)).toEqual([]);
    expect(reviewUser(good, brief)).toContain("[핵심 — 작가가 먼저 정한 한 줄]");
    const c = reviewRewriteContent("{}", good, ps, 420); expect(c).toContain("420자 이내"); expect(c).toContain("먼저 쓴 글:");
  });
});

describe("v4.11 이달·올해 영역 줄 되풀이", () => {
  test("recentFromRows가 이달·올해 줄을 싣고, 같은 줄을 다시 쓰면 탈락. 오늘 줄과 다른 말로 쓴 줄은 통과", async () => {
    const { recentFromRows } = await import("@/lib/fortune/brief");
    const rows = [{ fortune_date: "2026-06-14", content: { headline: "어제 제목", body: "어제 첫 문장이에요. 둘째 문장이에요.", areas: [{ period: "오늘", line: "오늘 줄" }, { period: "올해", line: "올해는 내 속도만 고집하면 사람이 멀어지기 쉬워요." }] } }];
    const recent = recentFromRows(rows); expect(recent[0]!.areas).toEqual(["올해는 내 속도만 고집하면 사람이 멀어지기 쉬워요."]);
    const b2 = { ...brief, recent };
    const yearIdx = good.areas.findIndex((a) => a.period === "올해");
    if (yearIdx >= 0) {
      const same = { ...good, areas: good.areas.map((a, i) => (i === yearIdx ? { ...a, line: "올해는 내 속도만 고집하면 사람이 멀어지기 쉬워요." } : a)) };
      expect(validateFortuneText(same, b2).some((x) => x.includes("최근(2026-06-14) 줄과 겹침"))).toBe(true);
      const other = { ...good, areas: good.areas.map((a, i) => (i === yearIdx ? { ...a, line: "올해는 혼자 정한 순서를 한 번쯤 바꿔 보면 사람 일이 풀려요." } : a)) };
      expect(validateFortuneText(other, b2).some((x) => x.includes("줄과 겹침"))).toBe(false);
    }
    expect(validateFortuneText(good, b2).some((x) => x.includes("줄과 겹침"))).toBe(false);
  });
});
