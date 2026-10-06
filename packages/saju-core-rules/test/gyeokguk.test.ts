// 원본: 사주 코어 core/test/gyeokguk.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars, type Pillars } from "../src/base";
import { balance, yongsin, hourPillar } from "../src/yongsin";
import { relations } from "../src/relations";
import { gyeokguk, gyeokInLuck } from "../src/gyeokguk";

const run = (p: Pillars) => { const b = balance(p); const rel = relations(p, b, yongsin(p, b)); return { b, rel, g: gyeokguk(p, b, rel) }; };

test("격국.md T1: 甲午 戊辰 癸未 庚申 → 정관격, 거리 판정 파격(구응 없음) / 원전 판정은 인성이 구응 → 학파차이", () => {
  const { g } = run(parsePillars("甲午 戊辰 癸未 庚申"));
  assert.equal(g.격, "정관격"); assert.equal(g.거리판정.판정, "파격"); assert.equal(g.원전판정.판정, "파격-구응"); assert.equal(g.학파차이, true);
});
test("격국.md T2: 癸亥 甲寅 丙子 (시간 모름) → 인격(편인), 12개 시주 모두 같은 격", () => {
  const p = parsePillars("癸亥 甲寅 丙子"); const { g } = run(p);
  assert.equal(g.격, "인격"); assert.equal(g.격십신, "편인"); assert.equal(g.거리판정.판정, "성격");
  const rows = Array.from({ length: 12 }, (_, i) => { const q: Pillars = [p[0], p[1], p[2], hourPillar("丙", i)]; const r = run(q).g; return `${q[3]} ${r.격}/${r.거리판정.판정}`; });
  console.log("   12시주:", rows.join(", ")); assert.ok(rows.every((r) => r.includes("인격")));
});
test("격국.md T3: 丁酉 癸丑 乙巳 → 삼합이 투출보다 먼저 → 칠살격", () => { assert.equal(run(parsePillars("丁酉 癸丑 乙巳")).g.격, "칠살격"); });
test("G-01: 戊 일간 巳월 = 건록격, 午월 = 양인격 (정기 기준이면 인격으로 잘못 나오던 것)", () => {
  assert.equal(run(parsePillars("甲子 己巳 戊寅 壬子")).g.격, "건록격"); assert.equal(run(parsePillars("甲子 庚午 戊寅 壬子")).g.격, "양인격");
});
test("G-07: 인격 + 운에서 재성이 옴", () => {
  const p = parsePillars("癸亥 甲寅 丙子 戊戌"); const { b, rel, g } = run(p); const r = gyeokInLuck(p, b, rel, g, "庚申", false);
  console.log("   운 庚申:", r.판정, r.태그, r.근거.join(" / "));
});
test("42건 전부 격이 정해지고 판정값이 네 가지 중 하나", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8")); const cnt: Record<string, number> = {}; let diff = 0;
  for (const e of Object.values<any>(expected)) { const g = run(parsePillars(e.chart)).g; const k = `${g.격}`; cnt[k] = (cnt[k] ?? 0) + 1; cnt["→" + g.거리판정.판정] = (cnt["→" + g.거리판정.판정] ?? 0) + 1; if (g.학파차이) diff++; }
  console.log("   분포:", JSON.stringify(cnt), "학파차이", diff);
});
