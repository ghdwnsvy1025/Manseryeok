// 원본 아님 — 어댑터(toCorePillars·currentLuckContext)와 index.ts export 를 확인하는 테스트.
// 기대값은 사주 코어 core/test/reading.test.ts·birth.test.ts 의 것을 그대로 가져왔다 (1990-05-15 14:30 서울 남 / 1994-01-28 12:00 여).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  balance, yongsin, luck, luckRelations, relations, fromBirth, currentLuckContext, toCorePillars, monthGanjiList, yearGanji, type Pillars,
} from "../src/index";

test("toCorePillars: 일기 앱 PillarsSnapshot(한자 stem/branch) → 코어 Pillars 튜플, 시주 null 유지", () => {
  const snap = { year: { stem: "己", branch: "巳", ko: "기사" }, month: { stem: "丙", branch: "子", ko: "병자" }, day: { stem: "丙", branch: "寅", ko: "병인" }, hour: { stem: "甲", branch: "午", ko: "갑오" } };
  assert.deepEqual(toCorePillars(snap), ["己巳", "丙子", "丙寅", "甲午"]);
  assert.deepEqual(toCorePillars({ ...snap, hour: null }), ["己巳", "丙子", "丙寅", null]);
});

test("currentLuckContext: reading.test.ts 와 같은 입력(1990-05-15 14:30 남, 기준일 2026-09-21) → 세운 丙午, 현재 대운 있음", () => {
  const birth = fromBirth({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, 성별: "남" });
  const ctx = currentLuckContext(birth, "2026-09-21");
  assert.equal(ctx.세운[0].간지, "丙午"); assert.equal(ctx.세운[0].해, 2026); assert.equal(ctx.세운[1].간지, yearGanji(2027));
  assert.ok(ctx.현재대운); assert.ok(ctx.현재대운!.순서 >= 1);
  const cur = birth.대운.목록.find((c) => c.순서 === ctx.현재대운!.순서)!;
  assert.ok("2026-09-21" >= cur.시작일!.slice(0, 10) && "2026-09-21" < cur.끝일!.slice(0, 10));   // reading.ts 와 같은 고르기 규칙
  assert.equal(ctx.월운!.간지, monthGanjiList("2026-09-21", 1)[0].간지);
});

test("currentLuckContext: 첫 대운 전이면 순서 0, 간지는 월주 (reading.ts 55행 규칙)", () => {
  const birth = fromBirth({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, 성별: "남" });   // 대운 시작 7세 2개월
  const ctx = currentLuckContext(birth, "1995-01-01");
  assert.deepEqual({ 순서: ctx.현재대운!.순서, 간지: ctx.현재대운!.간지 }, { 순서: 0, 간지: birth.pillars[1] });
  assert.ok(ctx.현재대운!.메모?.includes("첫 대운 전"));
});

test("Y-11 월운 기대값(코어 birth.test.ts 마지막 케이스)을 luck()·luckRelations() 로 직접 재현: 1994-01-28 12:00 여", () => {
  const birth = fromBirth({ year: 1994, month: 1, day: 28, hour: 12, minute: 0, 성별: "여" });
  const p: Pillars = birth.pillars; const b = balance(p); const y = yongsin(p, b); const rel = relations(p, b, y);
  const ms = monthGanjiList("2026-09-29", 12); assert.equal(ms.length, 12);
  const verdict = (gj: string) => luck(p, gj, b, y).판정;
  assert.equal(verdict("戊戌"), "매우 유리");   // 용신 토 두 글자
  assert.equal(verdict("壬寅"), "어려움");     // 구신 수 + 기신 목
  assert.ok(luckRelations(p, "丁未", b, y, rel).충.some((c: any) => c.자리 === "월지"));   // 丑未충
});
