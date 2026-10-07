// 원본: 사주 코어 core/test/usable.test.ts @ 240c91dbe54a60059d42b74148db88a31aebd16d (2026-10-07 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
// Y-12 쓰는 기운 · K-09 T존 조합 — 이론 확답 루프 카드 001·002·003·005·006 (2026-10-07 합의)의 예시 명조로 확인
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars, STEM_EL, BRANCH_EL } from "../src/base";
import { balance, yongsin, luck } from "../src/yongsin";
import { tzone } from "../src/structure";
import { usable, tzoneCombo } from "../src/usable";
import { johu } from "../src/extras";

test("카드 002: 토 비겁 과다 + 월간 乙 편관이 일간 옆 → 공식 용신은 재성(수, 부재)이지만 쓰는 기운에 관성이 T존·인접으로 오름", () => {
  const p = parsePillars("戊寅 乙丑 己巳 戊辰"); const b = balance(p); const y = yongsin(p, b);
  assert.equal(y.용신오행, "수");                                                    // 공식 용신은 그대로
  const u = usable(p, b); assert.ok(u.발동); const top = u.항목[0];
  assert.equal(top.자리, "월간 乙"); assert.equal(top.그룹, "관성"); assert.ok(top.근거.includes("T존"));
  assert.ok(u.항목.every((x) => x.그룹 === "관성"), "식상·재성이 없으니 관성만");
  // 전왕표는 뺐음(5라운드). 관성 운 점수는 다른 비겁 중심 사주로도 확인
  const q = parsePillars("乙亥 丙戌 己丑 辛未"); const bq = balance(q); const l = luck(q, "甲子", bq, yongsin(q, bq));
  assert.equal(l.방식, "라벨 점수"); assert.equal(l.천간.라벨, "한"); assert.equal(l.천간.점수, 1.5, "비겁 중심 신강에서 관성 운은 희신급(1×1.5)"); assert.ok(l.플래그.some((f) => f.includes("Y-12")));
});

test("카드 006: 신약인데 비겁이 가장 많은 사주 — 쓰는 기운은 비겁·인성(일지 卯 비견이 T존·일간 옆으로 1순위), 사실상 중화 메모", () => {
  const p = parsePillars("甲戌 庚午 乙卯 丙戌"); const b = balance(p);
  assert.equal(b.신강약, "신약"); const u = usable(p, b); assert.ok(u.발동);
  assert.equal(u.항목[0].자리, "일지 卯"); assert.equal(u.항목[0].그룹, "비겁"); assert.deepEqual(u.항목[0].근거, ["T존", "일간 옆"]);
  assert.ok(u.항목.some((x) => x.자리 === "연간 甲")); assert.ok(u.항목.every((x) => x.그룹 === "비겁" || x.그룹 === "인성"), "신약은 식·재·관을 내지 않음");
  assert.ok(u.메모.some((m) => m.includes("T존 해석")), "반례 조건: 중심이 비겁인 신약은 T존 해석이 더 중요");
});

test("카드 006: 신약에서 월간 壬 정인(T존·일간 옆)이 쓰는 기운 1순위", () => {
  const p = parsePillars("己丑 壬申 乙未 丙戌"); const b = balance(p);
  assert.equal(b.신강약, "신약"); const u = usable(p, b);
  assert.equal(u.항목[0].자리, "월간 壬"); assert.equal(u.항목[0].그룹, "인성"); assert.equal(u.항목[0].세기, 4);
});

test("카드 005: 조후 극단(|점수|≥6)이면 조후용신을 옆에 내고, 운 판정의 용신은 그대로", () => {
  const p = parsePillars("丁巳 丙午 丁酉 丙午"); const b = balance(p); const y = yongsin(p, b); const j = johu(p, y);   // 라벨 #23: 강사 용신 금
  assert.ok(j.극단); assert.equal(j.조후용신, "수"); assert.equal(y.용신오행, "금", "억부 용신은 그대로(충돌 카드 009 전까지)");
  assert.ok(j.활력?.includes("발산"));
  const q = parsePillars("庚午 辛巳 庚辰 癸未"); const jq = johu(q, yongsin(q, balance(q)));   // 1990 사례: 조열 뚜렷(4)이지만 극단은 아님
  assert.equal(jq.점수, 4); assert.equal(jq.극단, false); assert.equal(jq.조후용신, null);
});

test("카드 003: 비겁 중심 신강에서 식상이 T존에 있으면 쓰는 기운 1순위", () => {
  const p = parsePillars("乙亥 丙戌 己丑 辛未"); const b = balance(p);     // 용신.md 예시 사주: 토 비겁 과다, 시간 辛 식신
  const u = usable(p, b); assert.ok(u.발동);
  assert.equal(u.항목[0].자리, "시간 辛"); assert.equal(u.항목[0].그룹, "식상"); assert.ok(u.항목[0].근거.includes("시주"));
});

test("카드 001: T존 식상+인성 조합 태그, 인성이 식상을 바로 누르면 양면 표시", () => {
  const p = parsePillars("丁酉 癸丑 辛未 戊子"); const c = tzoneCombo(p, tzone(p).항목);   // 월간 癸 식신이 바로 아래 丑(토=인성)에게 눌림
  assert.equal(c.length, 1); assert.deepEqual(c[0].조합, ["식상", "인성"]); assert.ok(c[0].양면, "눌림 → 양면");
  const q = parsePillars("戊戌 甲寅 丙辰 己亥"); const d = tzoneCombo(q, tzone(q).항목);   // 시간 상관·일지 식신·월간 편인
  assert.equal(d.length, 1);
});

test("5라운드: 인성이 앞서는 혼합(1990 사례)은 관성 운을 비겁 비율만큼만 올린다 / 전왕표 없음", () => {
  const p = parsePillars("庚午 辛巳 庚辰 癸未"); const b = balance(p); const y = yongsin(p, b);
  assert.equal(b.중심기운, "인성"); assert.equal(b.혼합, "비겁");
  const l = luck(p, "丁未", b, y); assert.equal(l.방식, "라벨 점수"); assert.ok(l.천간.점수 > 1.0 && l.천간.점수 < 1.2, `丁(관성) ${l.천간.점수} — 0.5+0.5×(30/62)=0.74, ×1.5`); assert.equal(l.판정, "보통", "합계 +0.1 — 6라운드 Q1-b: 혼합의 관성 보조로 0 근처면 보통"); assert.ok(l.플래그.some((f) => f.includes("보통")));
  const q = parsePillars("戊寅 乙丑 己巳 戊辰"); const bq = balance(q); const lq = luck(q, "甲子", bq, yongsin(q, bq));
  assert.equal(lq.방식, "라벨 점수"); assert.equal(lq.천간.점수, 1.5, "전왕표가 없으니 관성 운이 희신급");
});

test("라벨 42건: 공식 용신이 원국에 없는(D) 사주 가운데 쓰는 기운이 있는 수를 센다 (수치는 보고용)", () => {
  const expected = JSON.parse(readFileSync(new URL("./fixtures/expected_42.json", import.meta.url), "utf8"));
  let fired = 0, withItems = 0, dCount = 0, dWithItems = 0;
  for (const e of Object.values<any>(expected)) {
    const p = parsePillars(e.chart); const b = balance(p); const y = yongsin(p, b); const u = usable(p, b);
    const absent = !p.flatMap((g) => (g ? [g[0], g[1]] : [])).some((ch) => (STEM_EL[ch] ?? BRANCH_EL[ch]) === y.용신오행);
    if (u.발동) fired++; if (u.항목.length) withItems++; if (absent) { dCount++; if (u.항목.length) dWithItems++; }
  }
  console.log(`   쓰는 기운 발동 ${fired}/42, 항목 있음 ${withItems}/42, 공식 용신 부재 ${dCount}건 중 쓰는 기운 있음 ${dWithItems}건`);
  assert.ok(fired > 0);
});
