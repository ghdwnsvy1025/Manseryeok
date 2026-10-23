// v4.14 (2026-10-16, 글품질 검수 §11 10-c): 되풀이 검사 탈락 → 글 전체가 아니라 그 칸(areas[i]·do·dont)만 다시 쓴다.
// 가짜 클라이언트로 흐름만 본다. 사주·날짜·good 글은 fortune-v410.test.ts와 같음
import { describe, expect, test } from "vitest";
import { OUTPUT_SCHEMA, PATCH_SCHEMA, generateFortuneText, mergePatch, patchMessages } from "@/lib/fortune/llm";
import { buildBrief, renderBrief, type BriefInput } from "@/lib/fortune/brief";
import { ABSTRACT_RE, slotIssues, stemOverlap, validateFortuneText, type ModelText } from "@/lib/fortune/validate";
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

const AREA_LINE: Record<string, string> = { 대인: "사람 일은 평소와 비슷해요.", 재물: "돈 쓰는 일은 계획대로 가요.", 직업: "일은 평소 속도로 가요.", 학업: "배우는 일은 평소와 비슷해요.", 연애: "관계는 평소와 비슷해요.", 가족: "가족 일은 평소와 비슷해요.", 건강: "몸 상태는 평소와 비슷해요." };
const good: ModelText = {
  핵심: "밀고 싶은 마음이 들어와 나에게 과해지기 쉬운 날이라, 할 일을 하나로 줄이면 편해요",
  headline: "할 일이 자꾸 늘어나는 날",
  body: "이달 갑오월은 내게 조심할 편이에요. 그래도 오늘 경신일은 기회와 확장을 뜻하는 편재가 아주 센 날이고 내게 모자란 금을 채우는 쪽이라, 사고 싶은 것과 새 제안이 자꾸 눈에 들어와요.\n\n집에 와서 미뤄 둔 정리와 답장을 한 번에 하려다 둘 다 어정쩡해지기 쉬워요. 오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요.",
  areas: brief.areas.map((a) => ({ period: a.period, area: a.area, line: AREA_LINE[a.area]! })),
  do: "저녁에 할 일 하나를 골라 그것만 끝내요.",
  dont: "답장과 정리를 같은 시간에 벌이지 않아요.",
};
/** 본문 마지막 문장을 낱말만 바꿔 do에 쓴 글 (3차 말뭉치 B 10-18 꼴) */
const REPEAT_DO = "오늘은 하나만 골라 끝까지 하는 쪽으로 가요.";
const todayIdx = good.areas.findIndex((a) => a.period === "오늘");

const fakeClient = (answers: (ModelText | Partial<ModelText> | string)[]) => {
  const calls: { messages: { content: string }[]; output_config: { format: { schema: unknown } } }[] = [];
  const client = { messages: { create: async (params: never) => {
    calls.push(params); const a = answers[calls.length - 1]!;
    return { stop_reason: "end_turn", content: [{ type: "text", text: typeof a === "string" ? a : JSON.stringify(a) }], usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
  } } };
  return { client: client as never, calls };
};

describe("v4.14 되풀이 사유는 어느 문장과 겹치는지 인용한다", () => {
  test("do가 본문 마지막 문장을 되풀이하면 그 문장을 사유에 인용", () => {
    expect(validateFortuneText(good, brief)).toEqual([]);
    expect(stemOverlap(REPEAT_DO, "오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요.")).toBeGreaterThanOrEqual(0.5);
    const issues = validateFortuneText({ ...good, do: REPEAT_DO }, brief);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^do가 본문 문장을 되풀이함 \(본문 "오늘은 하나만 골라/);
    expect(issues[0]).toContain("다른 장면·다른 행동으로");
  });
  test("오늘 영역 줄이 본문을 되풀이하면 areas[i] 사유에 인용, 이달·올해 줄은 보지 않음", () => {
    expect(todayIdx).toBeGreaterThanOrEqual(0);
    const areas = good.areas.map((a, i) => (i === todayIdx ? { ...a, line: REPEAT_DO } : a));
    const issues = validateFortuneText({ ...good, areas }, brief);
    expect(issues.filter((i) => i.startsWith(`areas[${todayIdx}] line이 본문 문장을 되풀이함 (본문 "`))).toHaveLength(1);
  });
});

describe("v4.14 slotIssues — 사유가 칸에만 있는가", () => {
  test("areas[i]·do·dont 사유만 있으면 그 칸들, 본문 사유가 섞이면 null, 빈 배열이면 null", () => {
    expect(slotIssues(['do가 본문 문장을 되풀이함 (본문 "…")', "areas[0] line이 본문 문장을 되풀이함", "areas[0] line 80자 (70자 안)", "dont는 1문장"])).toEqual({ areas: [0], do: true, dont: true });
    expect(slotIssues(['areas[2] 이달 줄이 최근(2026-10-15) 줄과 겹침 "…"'])).toEqual({ areas: [2], do: false, dont: false });
    expect(slotIssues(["do 50자 (45자 안)"])).toEqual({ areas: [], do: true, dont: false });
    expect(slotIssues(["예시 do·dont를 그대로 씀"])).toEqual({ areas: [], do: true, dont: true });
    expect(slotIssues(['금지어 "흐름"', "do가 본문 문장을 되풀이함"])).toBeNull();
    expect(slotIssues(["areas 불일치: 기대 [재물] / 받음 [대인]"])).toBeNull();
    expect(slotIssues(["areas period 불일치: 기대 [오늘] / 받음 [이달]"])).toBeNull();
    expect(slotIssues(["최근(2026-10-16) 운세 첫 문장과 겹침"])).toBeNull();
    expect(slotIssues([])).toBeNull();
  });
});

describe("v4.14 칸 고쳐 쓰기 요청과 덮어 쓰기", () => {
  test("PATCH_SCHEMA는 areas·do·dont만, 본문·headline·핵심은 받지 않는다", () => {
    expect(Object.keys(PATCH_SCHEMA.properties)).toEqual(["areas", "do", "dont"]);
    expect(PATCH_SCHEMA.required).toEqual(["areas", "do", "dont"]);
    expect(PATCH_SCHEMA.properties.areas).toBe(OUTPUT_SCHEMA.properties.areas);
  });
  test("patchMessages: 걸린 칸 이름·이전 글·사유가 붙고 본문을 바꾸지 말라고 한다", () => {
    const issues = ['do가 본문 문장을 되풀이함 (본문 "오늘은 하나만 골라 끝까지 하는 쪽이 마음이 편해요."와 같은 말 — 다른 장면·다른 행동으로)'];
    const m = patchMessages(renderBrief(brief), { ...good, do: REPEAT_DO }, issues, { areas: [todayIdx], do: true, dont: false });
    const content = m[0]!.content as string;
    expect(content).toContain("[칸 고쳐 쓰기]");
    expect(content).toContain(`areas[${todayIdx}]·do 칸만 걸렸어요`);
    expect(content).toContain("본문·headline은 한 글자도 바꾸지 않고");
    expect(content).toContain(REPEAT_DO);
    expect(content).toContain(issues[0]);
    expect(content).not.toContain("[재작성]");
  });
  test("mergePatch: 걸린 칸만 응답 것, 나머지(본문·headline·핵심·안 걸린 줄)는 앞 글 그대로. 모양이 틀린 응답은 무시", () => {
    const prev = { ...good, do: REPEAT_DO };
    const patchAreas = good.areas.map((a, i) => ({ ...a, line: i === todayIdx ? "새 영역 줄이에요." : "이건 무시돼야 해요." }));
    const merged = mergePatch(prev, { areas: patchAreas, do: "새 do예요.", dont: "새 dont예요." }, { areas: [todayIdx], do: true, dont: false });
    expect(merged.body).toBe(good.body); expect(merged.headline).toBe(good.headline); expect(merged.핵심).toBe(good.핵심);
    expect(merged.do).toBe("새 do예요."); expect(merged.dont).toBe(good.dont);
    merged.areas.forEach((a, i) => expect(a.line).toBe(i === todayIdx ? "새 영역 줄이에요." : good.areas[i]!.line));
    // areas 길이가 다르면 areas는 그대로, do는 받는다
    const bad = mergePatch(prev, { areas: [], do: "새 do예요.", dont: "x" }, { areas: [todayIdx], do: true, dont: false });
    expect(bad.areas).toEqual(prev.areas); expect(bad.do).toBe("새 do예요.");
    expect(mergePatch(prev, null, { areas: [], do: true, dont: false })).toBe(prev);
  });
});

describe("v4.14 파이프라인: 칸만 걸리면 칸만 다시 쓴다", () => {
  test("do 되풀이 → 둘째 호출은 PATCH_SCHEMA·[칸 고쳐 쓰기], 응답의 do만 받아 통과: llm, attempts 2, patches 1, 본문은 첫 글 그대로", async () => {
    const { client, calls } = fakeClient([{ ...good, do: REPEAT_DO }, { areas: good.areas, do: "자기 전에 내일 쓸 돈을 한 줄로 적어 둬요.", dont: "무시돼야 해요." }]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.source).toBe("llm"); expect(r.attempts).toBe(2); expect(r.patches).toBe(1);
    expect(r.issues[0]!.some((i) => i.startsWith("do가 본문 문장을 되풀이함"))).toBe(true); expect(r.issues[1]).toEqual([]);
    expect(calls[0]!.output_config.format.schema).toBe(OUTPUT_SCHEMA);
    expect(calls[1]!.output_config.format.schema).toBe(PATCH_SCHEMA);
    expect(calls[1]!.messages[0]!.content).toContain("[칸 고쳐 쓰기]");
    expect(r.text.body).toBe(good.body); expect(r.text.do).toBe("자기 전에 내일 쓸 돈을 한 줄로 적어 둬요."); expect(r.text.dont).toBe(good.dont);
    expect(r.core).toBe(good.핵심);
  });
  test("본문 사유가 섞이면 글 전체 재작성([재작성], OUTPUT_SCHEMA), patches 0", async () => {
    const { client, calls } = fakeClient([{ ...good, headline: "흐름이 좋은 날", do: REPEAT_DO }, good]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.source).toBe("llm"); expect(r.attempts).toBe(2); expect(r.patches).toBe(0);
    expect(calls[1]!.output_config.format.schema).toBe(OUTPUT_SCHEMA);
    expect(calls[1]!.messages[0]!.content).toContain("[재작성]");
  });
  test("칸 응답이 또 되풀이면 한 번 더 칸만 (patches 2), 그래도 걸리면 템플릿", async () => {
    const stillBad = { areas: good.areas, do: "오늘은 하나만 골라 끝까지 하는 쪽이 편해요.", dont: good.dont };
    const { client, calls } = fakeClient([{ ...good, do: REPEAT_DO }, stillBad, stillBad]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.source).toBe("template"); expect(r.attempts).toBe(3); expect(r.patches).toBe(2);
    expect(calls[2]!.output_config.format.schema).toBe(PATCH_SCHEMA);
    expect(r.issues.every((x) => x.length === 1 && x[0]!.startsWith("do가 본문 문장을 되풀이함"))).toBe(true);
  });
  test("칸 응답이 새 사유(칸 밖)를 만들면 그다음은 글 전체 재작성으로 돌아간다", async () => {
    // 새 do에 오늘 것이 아닌 기운 이름 → 칸 사유가 아니므로 셋째 호출은 [재작성]
    const { client, calls } = fakeClient([{ ...good, do: REPEAT_DO }, { areas: good.areas, do: "정관을 믿고 하나만 끝내요.", dont: good.dont }, good]);
    const r = await generateFortuneText(input, fallback, { client, reviewModel: null });
    expect(r.source).toBe("llm"); expect(r.attempts).toBe(3); expect(r.patches).toBe(1);
    expect(r.issues[1]!.some((i) => i.includes("오늘 기운이 아닌 이름"))).toBe(true);
    expect(calls[2]!.messages[0]!.content).toContain("[재작성]");
    expect(calls[2]!.output_config.format.schema).toBe(OUTPUT_SCHEMA);
  });
});

describe("v4.14 추상어 검사 오탐 — 목적어와 동사 사이의 부사 한 어절", () => {
  test("이름을 댄 문장은 부사가 끼어도 통과, 이름 없는 꼴은 여전히 탈락, 사유에 걸린 문장을 인용", () => {
    // 4차 말뭉치(2026-10-16)에서 걸린 꼴 — brief 라벨 문장(core.ts "~을 옆에서 거들어 줘요")을 옮겨 적은 것
    for (const ok of ["실속을 챙기는 힘을 옆에서 거들어 주는 쪽이라 오늘은 맞는 날이에요.", "내게 모자란 목을 든든하게 채워 주는 쪽이에요.", "금을 받쳐 주는 힘이에요."]) expect(ok, ok).not.toMatch(ABSTRACT_RE);
    for (const bad of ["아쉽던 자리를 옆에서 채워 주는 힘이에요.", "힘을 옆에서 조용히 거들어 주는 쪽이에요.", "부족한 쪽을 채워 주는 힘이에요.", "채워 주는 쪽이에요."]) expect(bad, bad).toMatch(ABSTRACT_RE);
    const body = good.body.replace("내게 모자란 금을 채우는 쪽이라", "내게 모자란 금을 옆에서 거들어 주는 쪽이라");
    expect(validateFortuneText({ ...good, body }, brief).filter((i) => i.startsWith("추상어"))).toEqual([]);
    const issues = validateFortuneText({ ...good, body: good.body.replace("내게 모자란 금을 채우는 쪽이라", "채워 주는 쪽이라") }, brief).filter((i) => i.startsWith("추상어"));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('추상어 "채워 주는 쪽"');
    expect(issues[0]).toMatch(/문장 "그래도 오늘 경신일은/);
  });
});
