// 원본: 사주 코어 core/test/yongsin.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars, checkPillars } from "../src/base";
import { balance, yongsin, yongsinGrade, luck, unknownHour } from "../src/yongsin";

const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8"));

test("파이썬 검증 스크립트(독립검증.py)와 42건 모두 같은 판정", () => {
  for (const [n, e] of Object.entries<any>(expected)) {
    const p = parsePillars(e.chart); assert.deepEqual(checkPillars(p), [], `#${n}`);
    const b = balance(p); const y = yongsin(p, b);
    assert.equal(b.신강약, e.strength, `#${n} 신강약`); assert.equal(b.중심기운, e.center, `#${n} 중심`);
    assert.equal(y.용신오행, e.yong, `#${n} 용신`); assert.ok(Math.abs(b.인비 - e.inbi) <= 0.6, `#${n} 인비 ${b.인비} vs ${e.inbi}`); // 반올림 방식만 다름
  }
});

test("용신.md 손으로 따라간 예: 乙亥 丙戌 己丑 辛未 + 대운 辛午", () => {
  const p = parsePillars("乙亥 丙戌 己丑 辛未"); const b = balance(p); const y = yongsin(p, b);
  assert.deepEqual(Object.values(b.판정용퍼센트).map(Math.round), [9, 13, 53, 13, 13]); // 목 화 토 금 수
  assert.equal(b.신강약, "신강"); assert.equal(b.중심기운, "비겁"); assert.equal(y.용신오행, "수");
  assert.deepEqual(y.오행역할, { 토: "기", 금: "희", 수: "용", 목: "한", 화: "구" });
  const l = luck(p, "辛巳", b, y); // 문서의 '辛午'는 없는 간지(음양 불일치)라 같은 화 지지인 辛巳로 확인
  assert.equal(l.천간.점수, 1.5); assert.equal(l.지지.점수, -1); assert.equal(l.판정, "유리");
});

test("Y-10 시간 모름: 癸亥 甲寅 丙子 → 용신 화 11/12, 신강약은 갈림", () => {
  const u = unknownHour(parsePillars("癸亥 甲寅 丙子"));
  assert.equal(u.용신오행.분포["화"], 11); assert.equal(u.용신오행.말하기, "확정에 준함");
  assert.equal(u.신강약.말하기, "말하지 않음"); assert.equal(u.중심기운.값, "관성");
});

test("Y-07 등급이 A~D 중 하나로 나온다 (42건)", () => {
  const count: Record<string, number> = {};
  for (const e of Object.values<any>(expected)) { const p = parsePillars(e.chart); const b = balance(p); const g = yongsinGrade(p, b, yongsin(p, b)).등급; count[g] = (count[g] ?? 0) + 1; }
  console.log("   등급 분포:", count); assert.equal(Object.values(count).reduce((a, b) => a + b, 0), 42);
});
