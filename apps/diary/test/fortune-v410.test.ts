// v4.10(2026-10-14): 이음말 검사 · 문맥 검수(FORTUNE_REVIEW_MODEL) — 가짜 클라이언트로 흐름만 본다. 사주·날짜는 fortune.test.ts의 PROFILE_A와 같음
// v4.19: 뼈대 한 줄(핵심)은 모델이 아니라 계획(plan.ts)이 정한다. 검수가 찾은 문제는 글 전체가 아니라 인용이 든 칸만 수리한다.
import { describe, expect, test } from "vitest";
import { generateFortuneText } from "@/lib/fortune/llm";
import { buildBrief, recentFromRows, type BriefInput } from "@/lib/fortune/brief";
import { validateFortuneText, type Draft } from "@/lib/fortune/validate";
import { parseReview, problemTarget, reviewUser, REVIEW_SYSTEM } from "@/lib/fortune/review";
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

const good: Draft = {
  headline: "할 일이 자꾸 늘어나는 날",
  body: [
    "사고 싶은 것과 새 제안이 평소보다 자꾸 눈에 들어와요.",
    "이것저것 둘러보다 보면 할 일이 하나둘 늘어나기 쉬워요.",
    "집에 와서 미뤄 둔 정리와 답장을 한 번에 하려다 둘 다 어정쩡해지기 쉬워요.",
    "오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요.",
  ],
  areaLines: [{ area: "재물", text: "돈 쓰는 일은 계획대로 가요." }, { area: "연애", text: "관계는 평소와 비슷해요." }],
  do: "저녁에 할 일 하나를 골라 그것만 끝내요.",
  dont: "답장과 정리를 같은 시간에 벌이지 않아요.",
};
const FIXED_LAST = "그래서 오늘은 둘 중 하나만 골라 끝까지 하는 쪽이 마음이 편해요.";
const problems = JSON.stringify({ 문제: [{ 종류: "끊김", 인용: "오늘은 하나만 골라 끝까지", 왜: "앞 문장의 어정쩡해짐을 받지 않음", 고칠방향: "앞 문장을 받는 이음말로" }] });

const fakeClient = (answers: unknown[]) => {
  const calls: { system?: unknown; messages: { content: string }[]; model: string }[] = [];
  const client = { messages: { create: async (params: never) => {
    calls.push(params); const a = answers[calls.length - 1]!;
    return { stop_reason: "end_turn", content: [{ type: "text", text: typeof a === "string" ? a : JSON.stringify(a) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  } } };
  return { client: client as never, calls };
};

describe("v4.10 이음말 검사", () => {
  test("첫 문장이 '그래서'로 시작하면 탈락, '그래서' 두 번이면 탈락, 한 번은 통과", () => {
    expect(validateFortuneText(good, brief)).toEqual([]);
    const a = validateFortuneText({ ...good, body: ["그래서 마음이 앞서는 날이라 이것저것 눈에 들어와요.", ...good.body.slice(1)] }, brief);
    expect(a.some((x) => x.includes("첫 문장이 이음말로 시작"))).toBe(true);
    const b = validateFortuneText({ ...good, body: [good.body[0]!, good.body[1]!, "그래서 " + good.body[2]!, FIXED_LAST] }, brief);
    expect(b).toEqual(["본문 4번째 문장: '그래서'가 두 번째 (본문에 한 번까지)"]);
    expect(validateFortuneText({ ...good, body: [...good.body.slice(0, 3), FIXED_LAST] }, brief)).toEqual([]);
  });
});

describe("v4.10 문맥 검수 (v4.19: 인용이 든 칸만 수리)", () => {
  test("검수 모델이 없으면(기본) 호출 1회, review 없음", async () => {
    const { client, calls } = fakeClient([good]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(calls.length).toBe(1); expect(r.review).toBeUndefined();
  });
  test("문제 없음 → 통과(호출 2회). 문제 있음 → 그 문장 수리 → 검사 통과면 적용(호출 3회, 검수 모델은 검수 호출에만)", async () => {
    const ok = fakeClient([good, '{"문제":[]}']);
    const r1 = await generateFortuneText(input, fallback, { client: ok.client, reviewModel: "claude-haiku-4-5-20251001" });
    expect(ok.calls.length).toBe(2); expect(r1.review?.status).toBe("통과"); expect(ok.calls[1]!.model).toBe("claude-haiku-4-5-20251001"); expect(ok.calls[1]!.system).toEqual([{ type: "text", text: REVIEW_SYSTEM, cache_control: { type: "ephemeral" } }]);
    const fix = fakeClient([good, problems, { fixes: [{ id: "body.3", action: "replace", text: FIXED_LAST }] }]);
    const r2 = await generateFortuneText(input, fallback, { client: fix.client, reviewModel: "claude-haiku-4-5-20251001" });
    expect(fix.calls.length).toBe(3); expect(r2.review?.status).toBe("적용"); expect(r2.bodySentences![3]).toBe(FIXED_LAST); expect(r2.review?.problems[0]).toMatch(/^\[끊김\]/);
    expect(fix.calls[2]!.messages[0]!.content).toContain("[수리]"); expect(fix.calls[2]!.messages[0]!.content).toContain('"id":"body.3"'); expect(fix.calls[2]!.model).not.toBe("claude-haiku-4-5-20251001");
  });
  test("고친 글이 검사에 걸리면 초고 유지(탈락), 검수 호출이 실패해도 초고는 산다", async () => {
    const bad = fakeClient([good, problems, { fixes: [{ id: "body.3", action: "replace", text: "흐름을 따라 하나만 골라 끝까지 하는 쪽이 편해요." }] }]);
    const r1 = await generateFortuneText(input, fallback, { client: bad.client, reviewModel: "x" });
    expect(r1.review?.status).toBe("탈락"); expect(r1.bodySentences).toEqual(good.body); expect(r1.review?.why).toContain("금지어");
    let n = 0; const down = { messages: { create: async () => { if (++n === 2) throw new Error("네트워크"); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(good) }], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }; } } } as never;
    const r2 = await generateFortuneText(input, fallback, { client: down, reviewModel: "x" });
    expect(r2.source).toBe("llm"); expect(r2.review?.status).toBe("탈락"); expect(r2.review?.why).toContain("검수 호출 실패");
  });
  test("편집자 답 파싱: 글에 없는 인용·모르는 종류는 버림. 인용이 든 칸을 찾는다. 핵심은 계획 것", () => {
    const ps = parseReview(JSON.stringify({ 문제: [{ 종류: "뻔한말", 인용: "하나만 골라 끝까지", 왜: "a", 고칠방향: "b" }, { 종류: "맞춤법", 인용: "마음이 편해요", 왜: "c" }, { 종류: "비약", 인용: "글에 없는 문장", 왜: "d" }] }), good);
    expect(ps.map((p) => p.종류)).toEqual(["뻔한말"]);
    expect(problemTarget(ps[0]!, good)).toEqual({ field: "body", index: 3 });
    expect(parseReview("형식 아님", good)).toEqual([]);
    expect(reviewUser(good, brief)).toContain("[핵심 — 계획이 정한 것] 기회와 확장");
  });
});

describe("v4.11 이달·올해 영역 줄 되풀이", () => {
  test("recentFromRows가 이달·올해 줄을 싣고, 이달·올해 영역 줄이 같으면 그 줄만 걸린다", () => {
    const rows = [{ fortune_date: "2026-06-14", content: { headline: "어제 제목", body: "어제 첫 문장이에요. 둘째 문장이에요.", areas: [{ period: "오늘", line: "오늘 줄" }, { period: "이달", line: "이달엔 사람 사이 말을 짧게 해요." }] } }];
    const recent = recentFromRows(rows); expect(recent[0]!.areas).toEqual(["이달엔 사람 사이 말을 짧게 해요."]);
    const b2 = { ...brief, recent, areas: [...brief.areas, { period: "이달" as const, area: "대인" as const, word: "사람", signal: "↓" as const }] };
    const same = { ...good, areaLines: [...good.areaLines, { area: "대인" as const, text: "이달엔 사람 사이 말을 짧게 해요." }] };
    expect(validateFortuneText(same, b2)).toEqual(["areaLines[2]: 이달 줄이 최근(2026-06-14) 줄과 겹침"]);
    const other = { ...good, areaLines: [...good.areaLines, { area: "대인" as const, text: "이달엔 가까운 사람의 부탁을 한 번 더 들어 봐요." }] };
    expect(validateFortuneText(other, b2)).toEqual([]);
  });
});
