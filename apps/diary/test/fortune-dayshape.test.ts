// 2026-11-04: 숫자로 뭉개지던 날을 카드 한 줄로 말한다 (충이 점수에서 빠진 것은 fortune.test.ts가 본다)
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { dayShapeView } from "@/lib/fortune/areaProfile";
import { computeCoreFortune } from "@/lib/fortune/core";
import type { CoreFortune } from "@/lib/fortune/types";
import { dayGanji } from "@/lib/ganji";
import { computeProfile, type BirthProfile } from "@/lib/profile";

const PROFILE: BirthProfile = { gender: "male", calendar: "solar", isLeapMonth: false, birthYear: 1990, birthMonth: 1, birthDay: 1, birthHour: 12, birthMinute: 0, city: "seoul" };
const pr = computeProfile({ ...PROFILE, name: "x" });
if (!pr.ok) throw new Error(pr.error);
const coreOn = (date: string) => computeCoreFortune({ pillars: pr.value.pillars, profile: PROFILE, date, todayHanja: dayGanji(date).hanja });

const e = (strength: number) => ({ strength, active: Math.abs(strength) >= 1, mixed: false, contributions: [] });
const quiet = { 대인: e(0), 재물: e(0), 직업: e(0), 학업: e(0), 연애: e(0), 가족: e(0), 건강: e(0) };
const base = coreOn("2026-06-15");
const noClash = { ...base.context, daeun: base.context.daeun ? { ...base.context.daeun, clash: undefined } : undefined, seun: { ...base.context.seun, clash: undefined }, wolun: base.context.wolun ? { ...base.context.wolun, clash: undefined } : undefined } as CoreFortune["context"];
const withBars = (over: Partial<typeof quiet>, context = noClash): CoreFortune => ({ ...base, context, todayAreaProfile: { ...quiet, ...over } });

describe("카드 한 줄", () => {
  test("주의인데 좋은 막대가 있으면 그 영역을 말한다", () => {
    const v = dayShapeView({ band: "주의", core: withBars({ 재물: e(2), 대인: e(-2) }) });
    expect(v).toEqual({ crossed: true, shaky: false, line: "전체로는 조심할 편이지만 돈 쪽은 괜찮아요." });
  });
  test("좋음인데 조심 막대가 있으면 그 영역을 말한다", () => {
    const v = dayShapeView({ band: "좋음", core: withBars({ 건강: e(-1.5), 직업: e(3) }) });
    expect(v?.line).toBe("전체로는 수월한 편이지만 건강 쪽은 조심해요.");
  });
  test("무난인데 양쪽 다 있으면 둘 다 말하고, 영역 둘은 조사를 받침대로 잇는다", () => {
    const v = dayShapeView({ band: "무난", core: withBars({ 직업: e(2), 재물: e(1), 건강: e(-1) }) });
    expect(v?.line).toBe("일·공부와 돈 쪽은 괜찮고 건강 쪽은 조심해요.");
    const w = dayShapeView({ band: "무난", core: withBars({ 재물: e(2), 대인: e(1), 건강: e(-1) }) });
    expect(w?.line).toBe("돈과 대인관계 쪽은 괜찮고 건강 쪽은 조심해요.");
  });
  test("막대가 단계와 같은 쪽이면 한 줄이 없다", () => {
    expect(dayShapeView({ band: "주의", core: withBars({ 재물: e(-2) }) })).toBeNull();
    expect(dayShapeView({ band: "좋음", core: withBars({ 재물: e(2) }) })).toBeNull();
    expect(dayShapeView({ band: "무난", core: withBars({ 재물: e(2) }) })).toBeNull();
    expect(dayShapeView({ band: "무난", core: withBars({}) })).toBeNull();
  });
  test("운과 충인 날은 흔들림만 말하고 사건을 말하지 않는다", () => {
    const seun = { ...noClash, seun: { ...noClash.seun, clash: { 강도: 3, 최고경보: false } } };
    const v = dayShapeView({ band: "주의", core: withBars({ 재물: e(-2) }, seun) });
    expect(v).toEqual({ crossed: false, shaky: true, line: "큰 흐름과 오늘이 어긋나 평소보다 들쭉날쭉하게 느껴질 수 있어요." });
    const both = dayShapeView({ band: "주의", core: withBars({ 재물: e(2) }, seun) });
    expect(both).toMatchObject({ crossed: true, shaky: true, line: "전체로는 조심할 편이지만 돈 쪽은 괜찮아요." });
  });
  test("옛 캐시는 null", () => {
    const { todayAreaProfile: _drop, ...old } = base;
    expect(dayShapeView({ band: "주의", core: old as CoreFortune })).toBeNull();
    expect(dayShapeView({ band: "주의" })).toBeNull();
  });
});
