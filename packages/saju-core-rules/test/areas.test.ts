// 원본: 사주 코어 core/test/areas_gunghap.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars } from "../src/base";
import { balance, yongsin, luck } from "../src/yongsin";
import { relations } from "../src/relations";
import { gyeokguk } from "../src/gyeokguk";
import { areas, luckAreas } from "../src/areas";
// [이식] gunghap.ts 는 이 패키지에 옮기지 않아 궁합(gunghap·iljuPair) 테스트 2개는 뺐다. 영역 테스트만 남김.

const run = (c: string, opt = {}) => { const p = parsePillars(c); const b = balance(p); const y = yongsin(p, b); const rel = relations(p, b, y); return { p, b, y, a: areas(p, b, y, rel, gyeokguk(p, b, rel), opt) }; };

test("영역.md 출력 예: 乙亥 丙戌 己丑 辛未 (남) → 월간 정인·시간 식신·일지 비견, 혼합형~독립형", () => {
  const { a } = run("乙亥 丙戌 己丑 辛未", { 성별: "남" });
  assert.deepEqual(a.직업.주도구.map((t) => `${t.자리} ${t.십신}`).sort(), ["시간 식신", "월간 정인"]);
  assert.equal(a.직업.일지.십신, "비견"); assert.ok(["혼합형", "독립형"].includes(a.직업.유형)); assert.equal(a.건강.의료아님, true);
  console.log("   직업 유형:", a.직업.유형, "| 재물:", a.재물.태그.join(", "), "| 연애:", a.연애.태그.join(", "));
});
test("42건 + 운: 영역·운 영역이 오류 없이 돈다", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8")); const types: Record<string, number> = {};
  for (const e of Object.values<any>(expected)) { const { p, b, y, a } = run(e.chart, { 성별: "여" }); types[a.직업.유형] = (types[a.직업.유형] ?? 0) + 1; luckAreas(luck(p, "甲子", b, y), "월운"); }
  console.log("   직업 유형 분포:", JSON.stringify(types));
});
