// v4.20 P0 (2026-10-31, ChatGPT 2차 검토): 충 문장은 관계 객체에 묶고, 템플릿도 같은 계획에서, 투표 이유를 나눠 쓴다.
// 사주·날짜는 fortune-v419.test.ts와 같다: PROFILE_A(1990-01-01 12:00 남) × 2026-06-15 庚申 (일지 寅申충)
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeCoreFortune } from "@/lib/fortune/core";
import { adjustWithEntries } from "@/lib/fortune/personal";
import { avoidFromRecent, buildPlan } from "@/lib/fortune/plan";
import { templateInputFromCore } from "@/lib/fortune/text";
import type { CoreFortune } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE_A: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE_A, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const DATE = "2026-06-15";
const core = computeCoreFortune({ pillars: pr.value.pillars, profile: PROFILE_A, date: DATE, todayHanja: dayGanji(DATE).hanja });
const NONE = adjustWithEntries(core.parts.score01, [], { index: dayGanji(DATE).index, stemKo: "경", branchKo: "신" });

describe("v4.20 충 문장은 그 관계에 묶인다", () => {
  test("코어가 충·복음 관계마다 사실 문장을 붙인다", () => {
    const clash = core.relations.hits.find((h) => h.kind === "충")!;
    expect(clash.fact).toBeTruthy();
    expect(core.facts).toContain(clash.fact);
  });
  test("충이 둘인 날: 일·월 자리 충의 문장을 고른다 (앞에 있는 다른 자리 충 문장이 아니라)", () => {
    const year = { pos: "연" as const, kind: "충" as const, direction: "불리" as const, strength: 1, chars: "子", fact: "오늘은 바깥 쪽 일이 흔들려 예정이 틀어지기 쉬워요." };
    const day = { ...core.relations.hits.find((h) => h.kind === "충" && h.pos === "일")! };
    const two: CoreFortune = { ...core, facts: [year.fact, ...core.facts], relations: { ...core.relations, hits: [year, day] } };
    const p = buildPlan({ core: two, personal: NONE, date: DATE, band: "무난" });
    expect(p.support).toMatchObject({ kind: "충", text: day.fact });
  });
});

describe("v4.20 템플릿도 같은 계획에서", () => {
  test("계획이 지지를 핵심으로 고른 날 템플릿 십신도 지지 것", () => {
    const branchCore: CoreFortune = { ...core, dayLuck: { ...core.dayLuck, stem: { ...core.dayLuck.stem, tenGod: "정관", score: 0.2 }, branch: { ...core.dayLuck.branch, tenGod: "편재", score: -2 } } };
    const p = buildPlan({ core: branchCore, personal: NONE, date: DATE, band: "주의" });
    expect(p.core.part).toBe("지지");
    expect(templateInputFromCore(branchCore).tenGod).toBe("정관");   // 옛 동작: 늘 천간
    expect(templateInputFromCore(branchCore, p.core).tenGod).toBe("편재");
  });
});

describe("v4.20 투표 이유는 쓰는 곳이 다르다", () => {
  const rec = (date: string, voteReason?: "content" | "obvious" | "awkward") => ({ date, headline: `${date} 제목`, lines: ["문장이에요."], actions: [`${date} 하면`, `${date} 피해요`], vote: -1 as const, ...(voteReason ? { voteReason } : {}) });
  test("내용이 안 맞음·이유 없음 → 주제(제목) 피하기, 뻔함 → 그날 조언 피하기, 어색함 → 아무것도 피하지 않음", () => {
    const av = avoidFromRecent(DATE, [rec("2026-06-14", "content"), rec("2026-06-13", "obvious"), rec("2026-06-12", "awkward"), rec("2026-06-11")]);
    expect(av.voteDown).toEqual(["2026-06-14 제목"]);   // 06-11은 3일 밖
    expect(av.obvious).toEqual(["2026-06-13 하면", "2026-06-13 피해요"]);
    expect(av.voteDown.join(" ") + av.obvious.join(" ")).not.toContain("06-12");
    const old = avoidFromRecent(DATE, [rec("2026-06-14")]);
    expect(old.voteDown).toEqual(["2026-06-14 제목"]);   // 0006 적용 전(이유 없음)은 예전처럼
  });
});
