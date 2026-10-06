// 원본: 사주 코어 core/test/structure.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars } from "../src/base";
import { flow, isolatedCandidates, tzone, rootGrade, sameElementPillars, exposed, yongGiSituation, positionTags } from "../src/structure";
import { balance, yongsin } from "../src/yongsin";

const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8"));

test("흐름·고립 후보가 파이썬(구조_검증.py)과 42건 모두 같음", () => {
  for (const [n, e] of Object.entries<any>(expected)) {
    const p = parsePillars(e.chart);
    assert.equal(flow(p).단계, e.flow.length - 1, `#${n} 흐름 단계`);
    assert.deepEqual(isolatedCandidates(p).map((x) => x.ch).sort(), [...e.isolated].sort(), `#${n} 고립`);
  }
});

test("T존·통근·간여지동·투출", () => {
  const p = parsePillars("甲戌 乙亥 甲寅 戊辰");
  const t = tzone(p); assert.deepEqual(t.항목.map((x) => `${x.자리}:${x.십신}`), ["시간:편재", "일지:비견", "월간:겁재"]);
  assert.equal(rootGrade(p, 3).등급, "강");          // 戊 위 辰(정기 戊)
  assert.equal(rootGrade(p, 1).등급, "강");          // 乙 위 亥: 정기 壬(수)이 목을 생함
  assert.equal(rootGrade(p, 0).등급, "약");          // 甲 위 戌(辛丁戊)에는 없음 → 인접 亥에 뿌리 → 약
  assert.deepEqual(sameElementPillars(p).map((x) => x.간지), ["甲寅", "戊辰"]);
  assert.ok(exposed(p).some((x) => x.지지 === "亥" && x.글자 === "甲"));
  assert.equal(tzone(parsePillars("甲戌 乙亥 甲寅")).완전, false);
});

test("K-07·K-08이 42건에서 오류 없이 돈다", () => {
  const seen = new Set<string>();
  for (const e of Object.values<any>(expected)) {
    const p = parsePillars(e.chart); const b = balance(p); const s = yongGiSituation(p, b, yongsin(p, b));
    s.태그.forEach((t) => seen.add(t)); if (s.희신) seen.add(s.희신); positionTags(p);
  }
  console.log("   나온 태그:", [...seen].join(" / "));
});

test("K-01 극당함: 누가 누르는지와 방향을 함께 (1994-01-28 12:00 — 시간 庚을 누르는 건 아래 午이지 옆 甲이 아님)", () => {
  const t = tzone(["癸酉", "乙丑", "甲寅", "庚午"]).항목;
  const si = t.find((x) => x.자리 === "시간")!;
  assert.equal(si.극당함, true);
  assert.deepEqual(si.극한글자, ["시지 午(화, 바로 아래)"]);   // 화극금. 옆의 일간 甲(목)은 금에게 눌리는 쪽이라 들어가면 안 됨
  assert.deepEqual(t.find((x) => x.자리 === "월간")!.극한글자, []);
});
