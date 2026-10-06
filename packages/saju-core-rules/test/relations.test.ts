// 원본: 사주 코어 core/test/relations.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars, isYang, type Pillars } from "../src/base";
import { balance, yongsin } from "../src/yongsin";
import { relations, luckRelations, luckClash } from "../src/relations";

// 지지만 주어지는 문서 예제용: 천간은 통관(목·수)에 걸리지 않게 금(庚/辛)으로 채움
const fromBranches = (s: string): Pillars => parsePillars([...s].map((b) => (isYang(b) ? "庚" : "辛") + b).join(" "));
const run = (p: Pillars) => { const b = balance(p); const y = yongsin(p, b); return { b, y, r: relations(p, b, y) }; };

test("충.md C1: 子·午·未 → 자오충 3 → 탐합망충으로 2, 위축 午, 午未 육합은 한 단계 약해짐", () => {
  const { r } = run(fromBranches("子午未酉"));
  const c = r.충.find((x) => x.이름 === "子午충")!; assert.equal(c.강도, 2); assert.equal(c.위축!.글자, "午"); assert.equal(c.생활기반충, true);
  assert.equal(r.합.find((h) => h.종류 === "육합")!.단계, "약");
});
test("충.md C2: 연지 寅 - 시지 申 → 불성립", () => { assert.equal(run(fromBranches("寅丑亥申")).r.충.filter((c) => c.이름.includes("寅")).length, 0); });
test("충.md C3: 월지 卯 + 세운 酉 → 강도 3, 위축 卯, 월령 흔들림, 방향은 卯의 역할에 따름", () => {
  const p = fromBranches("丑卯丑丑"); const { b, y, r } = run(p); const l = luckRelations(p, "辛酉", b, y, r);
  const c = l.충.find((x) => x.상대 === "卯")!; assert.equal(c.강도, 3); assert.equal(c.위축, "卯"); assert.equal(c.월령흔들림, true);
  const role = y.오행역할["목"]; assert.equal(c.방향, "용희".includes(role) ? "불리" : "기구".includes(role) ? "유리" : "중립");
});
test("삼합.md S1: 申·子·辰 연속 → 완전 삼합 수 '강'", () => {
  const h = run(fromBranches("申子辰寅")).r.합.find((x) => x.종류 === "삼합")!; assert.equal(h.오행, "수"); assert.equal(h.단계, "강");
});
test("삼합.md S2: 寅·戌 (왕지 午 없음) → 불성립", () => { assert.equal(run(fromBranches("寅戌丑丑")).r.합.filter((h) => h.오행 === "화").length, 0); });
test("삼합.md S3: 午·酉·巳 → 巳酉 반합 불성립 (S-04)", () => {
  const { r } = run(fromBranches("午酉巳子")); assert.equal(r.합.filter((h) => h.오행 === "금").length, 0);
  assert.ok(r.불성립합.some((h) => h.근거.some((g) => g.includes("S-04"))));
});
test("삼합.md S4: 원국에 卯 하나 + 세운 亥 → 불성립", () => {
  const p = fromBranches("丑卯丑酉"); const { b, y, r } = run(p);
  assert.equal(luckRelations(p, "辛亥", b, y, r).합.find((h) => h.글자.includes("亥"))!.단계, "불성립");
});
test("C-09 대운·세운 충 + 천간 극 → 최고 경보", () => { assert.deepEqual(luckClash("庚子", "丙午"), { 충: true, 강도: 3, 최고경보: true }); });
test("42건에서 오류 없이 돌고, 강도는 0~3", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8")); let nc = 0, nh = 0;
  for (const e of Object.values<any>(expected)) { const { r } = run(parsePillars(e.chart)); nc += r.충.length; nh += r.합.length; for (const c of r.충) assert.ok(c.강도 >= 0 && c.강도 <= 3); }
  console.log(`   42건: 충 ${nc}개, 성립한 합 ${nh}개`);
});
