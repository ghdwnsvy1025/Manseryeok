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

// ---------- P1 (규칙 완화) ----------
import { buildBrief, renderBrief } from "@/lib/fortune/brief";
import { checkDraft } from "@/lib/fortune/validate";
import { composeAreas } from "@/lib/fortune/visible";

describe("v4.20 P1 규칙 완화", () => {
  test("피할것에 장면·동작·첫 어절·제목 끝맺음을 보내지 않는다", () => {
    const recent = [1, 2].map((n) => ({ date: `2026-06-1${5 - n}`, headline: `제목 ${n}이 되는 날`, start: "답장을 미뤄요.", lines: ["답장을 미뤄요.", "결제는 확인해요."], actions: ["답장을 미뤄 봐요.", "결제를 서두르지 않아요."] }));
    const b = buildBrief({ core, personal: NONE, today: { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" }, date: DATE, weekday: "월요일", score10: 5, band: "무난", recent });
    const j = JSON.parse(renderBrief(b)) as { 피할것?: Record<string, unknown> };
    expect(Object.keys(j.피할것 ?? {})).toEqual(["최근제목"]);
    // 최근 3일 하면·피해요와 거의 같은 하면은 그 칸만 고친다
    const draft = { headline: "새 제목이에요", body: ["오늘은 사고 싶은 것이 여러 개 눈에 들어올 수 있어요.", "예정에 없던 구매라면 바로 정하지 않는 편이 좋아요.", "필요한 것부터 고르면 마음이 편해요."], areaLines: [], do: "답장을 미뤄 봐요.", dont: "새로 벌이지 않아요." };
    expect(checkDraft(draft, b).map((i) => `${i.field}:${i.code}`)).toContain("do:recent_action");
    // v4.21: 비슷한 뜻(말이 조금 다름)은 수리하지 않는다 — 거의 복사만
    expect(checkDraft({ ...draft, do: "오늘 답장은 조금 미뤄 두고 쉬어 봐요." }, b).map((i) => `${i.field}:${i.code}`)).not.toContain("do:recent_action");
  });
  test("영역: → 줄 없음, 오늘은 코드 상태말, 이달·올해는 빈 줄", () => {
    const rows = composeAreas([{ period: "오늘", area: "대인", signal: "↓" }, { period: "오늘", area: "재물", signal: "→" }, { period: "이달", area: "재물", signal: "↑" }], [{ period: "오늘", area: "대인", text: "모델 문장" }], []);
    expect(rows).toEqual([{ period: "오늘", area: "대인", signal: "↓", line: "말이 엇갈리기 쉬운 쪽" }, { period: "이달", area: "재물", signal: "↑", line: "" }]);
  });
});

import { normalizeDraft } from "@/lib/fortune/validate";
test("v4.20 마침표를 빼먹은 본문·하면·피해요에 마침표를 붙인다", () => {
  const d = normalizeDraft({ headline: "제목이에요", body: ["마음이 먼저 올라오기 쉬워요", "그 마음이 앞서면 말이 세지기 쉬워요."], do: "하나만 골라 지켜봐요", dont: "먼저 쓰지 않아요." })!;
  expect(d.body).toEqual(["마음이 먼저 올라오기 쉬워요.", "그 마음이 앞서면 말이 세지기 쉬워요."]);
  expect([d.do, d.dont]).toEqual(["하나만 골라 지켜봐요.", "먼저 쓰지 않아요."]);
  expect(d.headline).toBe("제목이에요");
});

// ---------- v4.21 P1.5 (ChatGPT 3차) ----------
import { READ_WORD } from "@/lib/fortune/plan";
import { TEN_GOD_EXPRESSIONS } from "@/lib/fortune/expressions";
import { templateText } from "@/lib/fortune/text";

describe("v4.21 작가가 짐작하던 뜻을 사실로 준다", () => {
  const b = buildBrief({ core, personal: NONE, today: { ko: "경신", hanja: "庚申", stemKo: "경", branchKo: "신" }, date: DATE, weekday: "월요일", score10: 5, band: "주의", recent: [{ date: "2026-06-14", headline: "어제 제목", start: "문장이에요.", lines: ["문장이에요."], actions: ["하면이에요."], vote: -1 as const, voteReason: "content" as const }] });
  const j = JSON.parse(renderBrief(b)) as Record<string, unknown> & { 영역: { 신호: string; 뜻: string }[]; 핵심: { 오늘: string }; 숫자: number[]; 피할것?: Record<string, unknown> };
  test("방향 칸이 없다 — 행동의 종류는 단계에서 나오지 않는다", () => {
    expect(j).not.toHaveProperty("방향");
    expect(j).toHaveProperty("말투");
  });
  test("읽기 말은 뜻이 하나다 (\"지나치기\" 없음)", () => {
    for (const w of Object.values(READ_WORD)) expect(w).not.toMatch(/지나치/);
    expect(Object.values(READ_WORD)).toContain(j.핵심.오늘);
  });
  test("영역마다 화면 상태말과 같은 뜻이 간다", () => {
    for (const a of j.영역) expect(a.뜻).toMatch(/쪽$/);
  });
  test("숫자에 날짜(연·월·일)가 없다", () => {
    expect(j.숫자).not.toContain(2026);
    expect(j.숫자).not.toContain(15);
  });
  test("내용이 안 맞음 투표는 작가에게 보내지 않고 계획에만 남는다", () => {
    expect(j.피할것 ?? {}).not.toHaveProperty("아니에요");
    expect(b.plan.avoid.voteDown).toEqual(["어제 제목"]);
  });
});

test("v4.21 영역: 맥락을 쓰는 날에도 오늘 영역이 먼저 (↑ 먼저 정렬 없음)", () => {
  const c: CoreFortune = { ...core, areas: [{ period: "오늘", area: "대인", signal: "↓", why: "" }, { period: "이달", area: "재물", signal: "↑", why: "" }, { period: "오늘", area: "건강", signal: "↑", why: "" }] as CoreFortune["areas"], facts: [...core.facts, "이달 운 경자(庚子)가 들어와요."] };
  const p = buildPlan({ core: c, personal: NONE, date: DATE, band: "무난" });
  expect(p.includeContext).toBe(true);
  expect(p.areas.map((a) => `${a.period}${a.area}${a.signal}`)).toEqual(["오늘대인↓", "오늘건강↑"]);
});

test("v4.21 표현 후보와 템플릿 본문이 결과를 약속하지 않는다", () => {
  const all = Object.values(TEN_GOD_EXPRESSIONS).flatMap((e) => [...e.경향, ...e.과할때, ...e.활용]);
  for (const e of all) expect(e).not.toMatch(/결과가|성과가|일이 순해|수월해|잘 통해|하루가 편해|쓰면 남아/);
  const t = templateText(templateInputFromCore(core), NONE, { ko: "경신", stemKo: "경", branchKo: "신" });
  expect(t.body).not.toMatch(/새로 벌이기보다 하던 것을 지키는|손에 든 일부터 하나씩 끝내는 쪽이 편해요/);
});
