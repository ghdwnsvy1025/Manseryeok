// v4.14 (2026-10-16, 글품질 검수 §11 10-c): 되풀이 검사 탈락 → 글 전체가 아니라 그 칸만 다시 쓴다.
// v4.19: 칸 고쳐 쓰기(PATCH_SCHEMA·mergePatch·slotIssues)는 문장 단위 수리(llm.ts repair)로 합쳐졌다 — 파이프라인 흐름은 fortune-v419.test.ts.
// 여기는 되풀이 사유의 인용과 추상어 오탐만 본다. 사주·날짜는 fortune-v419.test.ts와 같음
import { describe, expect, test } from "vitest";
import { buildBrief, type BriefInput } from "@/lib/fortune/brief";
import { ABSTRACT_RE, checkDraft, stemOverlap, validateFortuneText, type Draft } from "@/lib/fortune/validate";
import { computeCoreFortune } from "@/lib/fortune/core";
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
/** 본문 마지막 문장을 낱말만 바꿔 do에 쓴 글 (3차 말뭉치 B 10-18 꼴) */
const REPEAT_DO = "오늘은 하나만 골라 끝까지 하는 쪽으로 가요.";

describe("v4.14 되풀이 사유는 어느 문장과 겹치는지 인용한다 (v4.19: 그 칸 하나를 가리킨다)", () => {
  test("do가 본문 마지막 문장을 되풀이하면 그 문장을 사유에 인용", () => {
    expect(validateFortuneText(good, brief)).toEqual([]);
    expect(stemOverlap(REPEAT_DO, good.body[3]!)).toBeGreaterThanOrEqual(0.5);
    const issues = checkDraft({ ...good, do: REPEAT_DO }, brief);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: "repeat", field: "do" });
    expect(issues[0]!.msg).toMatch(/^do: 본문 문장을 되풀이함 \(본문 "오늘은 하나만 골라/);
    expect(issues[0]!.msg).toContain("다른 장면·다른 행동으로");
  });
  test("영역 줄이 본문을 되풀이하면 그 줄(area index) 사유에 인용", () => {
    const issues = checkDraft({ ...good, areaLines: [good.areaLines[0]!, { area: "연애", text: REPEAT_DO }] }, brief);
    expect(issues.filter((i) => i.field === "area" && i.index === 1 && i.msg.startsWith('areaLines[1]: 본문 문장을 되풀이함 (본문 "'))).toHaveLength(1);
  });
});

describe("v4.14 추상어 검사 오탐 — 목적어와 동사 사이의 부사 한 어절", () => {
  test("이름을 댄 문장은 부사가 끼어도 통과, 이름 없는 꼴은 여전히 탈락, 걸린 문장을 가리킨다", () => {
    for (const ok of ["실속을 챙기는 힘을 옆에서 거들어 주는 쪽이라 오늘은 맞는 날이에요.", "내게 모자란 목을 든든하게 채워 주는 쪽이에요.", "금을 받쳐 주는 힘이에요."]) expect(ok, ok).not.toMatch(ABSTRACT_RE);
    for (const bad of ["아쉽던 자리를 옆에서 채워 주는 힘이에요.", "힘을 옆에서 조용히 거들어 주는 쪽이에요.", "부족한 쪽을 채워 주는 힘이에요.", "채워 주는 쪽이에요."]) expect(bad, bad).toMatch(ABSTRACT_RE);
    const issues = checkDraft({ ...good, body: good.body.map((s, i) => (i === 1 ? "채워 주는 쪽이라 이것저것 둘러보고 싶어져요." : s)) }, brief).filter((i) => i.code === "abstract");
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: "body", index: 1 });
    expect(issues[0]!.msg).toContain('추상어 "채워 주는 쪽"');
  });
});
