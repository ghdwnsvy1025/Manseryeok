// 원본: 사주 코어 core/test/usable.test.ts @ 4f795caaff12b331779feacbc2f4a49caa24c211 (2026-10-31 복사). node:test → vitest, reading.ts 의존 테스트 8개 제거(README). 기대값 수정 금지.
// Y-12 쓰는 기운 · K-09 T존 조합 — 이론 확답 루프 카드 001·002·003·005·006 (2026-10-07 합의)의 예시 명조로 확인
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePillars, STEM_EL, BRANCH_EL } from "../src/base";
import { balance, yongsin, luck, power } from "../src/yongsin";
import { tzone } from "../src/structure";
import { usable, tzoneCombo } from "../src/usable";
import { johu } from "../src/extras";
import { relations, luckRelations } from "../src/relations";

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

test("카드 007 [기각·대체]: 극단 비겁(#37 癸亥×4) — 전왕이 아니라 식상 운이 가장 좋고 재성·관성 운이 가장 위험, 비겁·인성은 익숙해 덜 치명적 (Y-13)", () => {
  const p = parsePillars("癸亥 癸亥 癸亥 癸亥"); const b = balance(p); const y = yongsin(p, b);
  assert.equal(y.용신오행, "화", "공식 용신은 그대로");
  const l = luck(p, "丙寅", b, y); assert.equal(l.천간.점수, -3, "丙 재성 = −2×1.5 (한습 극단이어도 온도로 구제하지 않음)"); assert.equal(l.지지.점수, 2, "寅 식상 = +2"); assert.ok(l.합계 < 0, "강사 BAD"); assert.ok(l.플래그.some((f) => f.includes("Y-13")));
  assert.ok(luck(p, "戊辰", b, y).합계 <= -3, "관성 운은 어려움");
  const g = luck(p, "甲子", b, y); assert.equal(g.천간.점수, 3, "甲 식상 = +2×1.5"); assert.equal(g.지지.점수, -2, "子 비겁 −1 + 한습 극단을 더 차게 함 −1 (J-05)");
});

test("카드 008 [기각·대체]: 운 비겁의 무게는 그 층에 원국 식·재·관이 있는가로 (Y-14) — #13 지지에 없음 → 甲辰 유리 / #31 지지에 있음 → 丑 그대로 −2 / 비겁 70%+ 재성 운은 양날(절반)", () => {
  const p = parsePillars("丁未 丁未 己丑 辛未"); const b = balance(p); const y = yongsin(p, b);
  const l = luck(p, "甲辰", b, y); assert.equal(l.지지.점수, -0.5, "辰 비겁 −1(지지에 식재관 없음) + 습토가 조열 극단을 식힘 +0.5"); assert.ok(l.합계 > 0, "강사 GOOD"); assert.ok(l.플래그.some((f) => f.includes("Y-14")));
  const q = parsePillars("癸亥 己未 己未 丙寅"); const bq = balance(q); const lq = luck(q, "乙丑", bq, yongsin(q, bq)); assert.equal(lq.지지.점수, -2, "지지에 亥 재성·寅 관성이 있으니 비겁이 그것을 침 (사용자 확답: 더 불리)");
  const r = parsePillars("戊寅 己未 戊辰 丙辰"); const br = balance(r); assert.ok(br.그룹퍼센트.비겁 >= 70); const lr = luck(r, "癸丑", br, yongsin(r, br));
  assert.equal(lr.천간.점수, 0.75, "용신 癸 +3 → 양날 절반(1.5) → 연간 戊(비겁)와 戊癸합으로 다시 절반(카드 013)"); assert.ok(lr.플래그.some((f) => f.includes("양날"))); assert.ok(lr.플래그.some((f) => f.includes("카드 013"))); assert.ok(lr.합계 < 0, "강사 BAD");
});

test("카드 013 [합의·조건부]: #27 戊午 — 戊는 癸(비겁)와 합해 역할 제한(절반), 午는 군겁쟁재(변동성 플래그), 子午충은 relations가 붙임", () => {
  const p = parsePillars("癸亥 甲子 癸未 壬子"); const b = balance(p); const y = yongsin(p, b); const l = luck(p, "戊午", b, y);
  assert.equal(l.천간.점수, 0.75, "戊 관성 희신 1×1.5의 절반"); assert.ok(l.플래그.some((f) => f.includes("카드 013") && f.includes("합")));
  assert.equal(l.지지.점수, -2); assert.ok(l.플래그.some((f) => f.includes("변동성")));
  const lr = luckRelations(p, "戊午", b, y, relations(p, b, y)); assert.ok(lr.충.some((c) => c.상대 === "子"));
});

test("카드 014 [기각·대체]: 신약에서 관성 운은 불리 — #33 丁丑의 丑(인성 용신의 희신이던 관성)이 기신급, 원국에 관성이 없으면 오히려 희신급, 양간+편관은 조심 플래그", () => {
  const p = parsePillars("庚寅 庚辰 癸卯 甲寅"); const b = balance(p); const y = yongsin(p, b);     // 라벨 #33: 수 신약, 식상 중심, 용신 금(인성)
  assert.equal(b.신강약, "신약"); assert.equal(y.역할.관성, "한", "Y-06 보충: 신약·인성 용신이면 관성은 한신(예전 현묘표는 희신)"); assert.equal(y.역할.비겁, "희");
  const l = luck(p, "丁丑", b, y); assert.equal(l.지지.점수, 0, "카드 019: 식상(목) 중심이라 지지로 오는 관성 丑은 목의 기운을 빼 줘 나쁘지 않음"); assert.ok(l.플래그.some((f) => f.includes("카드 019") && f.includes("식상이 중심"))); assert.ok(l.합계 < 0, "丁(재성 기신)이 있어 강사 BAD 그대로");
  const t = luck(p, "戊午", b, y); assert.equal(t.천간.점수, -0.75, "천간 戊 정관(음간 癸의 짝) = −0.5×1.5 … 신약 관성 불리, 천간이라 식상 중심 예외 없음"); assert.ok(t.플래그.some((f) => f.includes("식상과 운 관성이 대립")) || t.플래그.some((f) => f.includes("정관(음간")));
  const q = parsePillars("癸未 甲寅 庚午 癸未"); const bq = balance(q); const yq = yongsin(q, bq);   // 라벨 #17: 庚 양간 신약, 원국에 午 관성 있음
  const lq = luck(q, "丙申", bq, yq); assert.ok(lq.플래그.some((f) => f.includes("편관(양간 일간)") && f.includes("아주 조심")), "丙은 庚의 편관");
  const r = parsePillars("壬辰 癸丑 丁丑 甲辰"); const br = balance(r); const yr = yongsin(r, br);   // 라벨 #34: 丁 신약·식상(토) 중심 — 카드 012 확답 "수가 오면 위험하지만 수토들이라 그렇게 위험하지 않다"
  assert.equal(luck(r, "壬子", br, yr).지지.점수, 0, "카드 019: 식상 중심이면 지지 관성은 나쁘지 않음"); assert.equal(luck(r, "壬子", br, yr).천간.점수, -0.75, "천간 壬 정관(음간 丁의 짝) −0.5×1.5");
});

test("카드 015 [기각·대체]: 육합은 묶임이 아니라 합화 오행이 강해짐 — 子丑→토, 巳申은 대립(오행 없음)", () => {
  const n = parsePillars("甲寅 乙亥 己酉 辛未"); const bn = balance(n); const yn = yongsin(n, bn);   // 연지 寅·월지 亥 육합 (방합·삼합 경쟁 없음)
  const h = relations(n, bn, yn).합.find((x) => x.종류 === "육합"); assert.ok(h); assert.equal(h!.오행, "목"); assert.ok(h!.근거.some((s) => s.includes("강해짐")));
  const p = parsePillars("甲子 丁丑 己巳 辛未"); const b = balance(p); const y = yongsin(p, b); const rel = relations(p, b, y);   // #36: 원국 子丑은 S-06에서 방합이 앞서 육합은 불성립 목록
  const lr = luckRelations(p, "丙子", b, y, rel); const yh = lr.합.find((x) => x.종류 === "육합"); assert.ok(yh); assert.equal(yh!.오행, "토"); assert.ok(!yh!.근거.includes("세력 변화 없음"));
  const q = parsePillars("丁巳 丙午 丁酉 丙午"); const bq = balance(q); const yq = yongsin(q, bq); const lq = luckRelations(q, "庚申", bq, yq, relations(q, bq, yq));
  const sa = lq.합.find((x) => x.종류 === "육합"); assert.ok(sa); assert.equal(sa!.오행, null, "巳申은 화·금 대립");
});

test("카드 019 [합의·조건부]: 신약의 관성 운은 일간 음양 × 편관·정관으로 — #17 庚(양간)에 午(정관)는 세게 누르지 못해 −0.5, 丙(편관)은 강렬해 −3", () => {
  const p = parsePillars("癸未 甲寅 庚午 癸未"); const b = balance(p); const y = yongsin(p, b);
  const g = luck(p, "戊午", b, y); assert.equal(g.지지.점수, -0.5); assert.ok(g.합계 > 0, "강사 GOOD"); assert.ok(g.플래그.some((f) => f.includes("정관(양간")));
  const h = luck(p, "丙申", b, y); assert.equal(h.천간.점수, -3); assert.ok(h.플래그.some((f) => f.includes("명예·성과")));
  const q = parsePillars("辛未 乙未 癸未 己未"); const bq = balance(q); const yq = yongsin(q, bq);   // #28 癸(음간): 己 편관 −1×1.5
  const k = luck(q, "己亥", bq, yq); assert.equal(k.천간.점수, -1.5); assert.ok(k.합계 > 0, "강사 GOOD");
});

test("카드 020 [기각·대체]: 충은 점수를 바꾸지 않고 '불안정성'을 붙인다 — 子午·丑未는 마음 쪽, 卯酉·寅申은 몸 쪽, 丑未는 더 날뜀", () => {
  const p = parsePillars("癸亥 甲子 癸未 壬子"); const b = balance(p); const y = yongsin(p, b); const rel = relations(p, b, y);
  const lr = luckRelations(p, "戊午", b, y, rel); assert.ok(lr.플래그.some((f) => f.includes("불안정성") && f.includes("마음 쪽")));
  const q = parsePillars("辛未 乙未 癸未 己未"); const bq = balance(q); const yq = yongsin(q, bq);
  const lq = luckRelations(q, "辛丑", bq, yq, relations(q, bq, yq)); assert.ok(lq.플래그.some((f) => f.includes("더 날뜀")));
  const r = parsePillars("甲戌 乙亥 乙卯 辛巳"); const br = balance(r); const yr = yongsin(r, br);
  assert.ok(luckRelations(r, "癸酉", br, yr, relations(r, br, yr)).플래그.some((f) => f.includes("몸 쪽")));
});

test("카드 021 [합의·조건부]: 관성 운은 신약이면 '바빠짐·번아웃·스트레스로 부담', 신강이면 '나를 깎아 결과물, 반동 있음' — 점수는 그대로", () => {
  const p = parsePillars("癸未 甲寅 庚午 癸未"); const b = balance(p); const y = yongsin(p, b);   // #17 庚 신약
  const l = luck(p, "丙申", b, y); assert.equal(l.천간.점수, -3); assert.ok(l.플래그.some((f) => f.includes("번아웃")));
  const q = parsePillars("乙亥 丙戌 己丑 辛未"); const bq = balance(q); const yq = yongsin(q, bq);   // 1995 己 신강: 甲 정관
  const k = luck(q, "甲申", bq, yq); assert.ok(k.플래그.some((f) => f.includes("나를 깎아") && f.includes("반동")));
});

test("카드 025·026: 신강의 관성 운에 반동 크기(양간+편관 가장 큼), 辰戌충은 丑未보다 강하고 巳亥충은 움직임과 마음", () => {
  const p = parsePillars("庚午 辛巳 庚辰 癸未"); const b = balance(p); const y = yongsin(p, b);   // 1990 庚 양간 신강
  const l = luck(p, "丙子", b, y); assert.ok(l.플래그.some((f) => f.includes("반동 크기 가장 큼")));
  const q = parsePillars("乙亥 丙戌 己丑 辛未"); const bq = balance(q); const yq = yongsin(q, bq); const rel = relations(q, bq, yq);   // 1995: 월지 戌
  const lr = luckRelations(q, "甲辰", bq, yq, rel); assert.ok(lr.플래그.some((f) => f.includes("삶의 근본")));
  assert.equal(lr.충.find((c) => c.상대 === "戌")!.강도, 3, "辰戌은 고지충이지만 −1 없음");
  assert.ok(luckRelations(q, "丁巳", bq, yq, rel).플래그.some((f) => f.includes("움직임(이동)과 마음")));
});

test("카드 009 [합의·조건부]: 조후 극단이면 운 글자의 온도를 억부 점수에 더해 통합 (J-05) — #23 丑(식상·습토)이 戌(식상·조토)보다 좋고, 한습 극단에는 戌이 丑보다 좋다", () => {
  const p = parsePillars("丁巳 丙午 丁酉 丙午"); const b = balance(p); const y = yongsin(p, b); assert.ok(johu(p, y).극단);
  const chuk = luck(p, "辛丑", b, y), sul = luck(p, "戊戌", b, y);
  assert.equal(chuk.지지.점수, 1.5, "丑 식상 +1, 습토 +0.5"); assert.equal(sul.지지.점수, 0.5, "戌 식상 +1, 조토 −0.5"); assert.ok(chuk.플래그.some((f) => f.includes("J-05")));
  assert.ok(luck(p, "庚子", b, y).플래그.some((f) => f.includes("양날")), "화 81%라 용신 금은 '좀 위험'(양날)");
  const q = parsePillars("壬子 辛亥 甲寅 壬申"); const bq = balance(q); const yq = yongsin(q, bq); assert.ok(johu(q, yq).극단); assert.equal(yq.용신오행, "토");
  assert.ok(luck(q, "戊戌", bq, yq).지지.점수 > luck(q, "丁丑", bq, yq).지지.점수, "한습 극단: 술토 > 축토");
});

test("카드 010 [합의·조건부]: 원국 지지 비겁 셋 이상이면 운 지지 재성은 군겁쟁재(기신급, 뜨거운 사주여도 구제 없음), 관성은 부담이라 절반 (Y-15)", () => {
  const p = parsePillars("丁未 丁未 己丑 辛未"); const b = balance(p); const y = yongsin(p, b);     // 라벨 #13: 토 비겁 지지 넷, 조열 극단
  const l = luck(p, "庚子", b, y); assert.equal(l.지지.점수, -2, "子 재성 용신인데 비겁 사이 → 군겁쟁재, 조후(+1)로 구제 안 함"); assert.ok(l.합계 < 0, "강사 BAD"); assert.ok(l.플래그.some((f) => f.includes("군겁쟁재")));
  const k = luck(p, "癸卯", b, y); assert.equal(k.지지.점수, 0.5, "卯 관성(희신급 1)의 절반 — 누르느라 부담"); assert.ok(k.합계 > 0, "강사 GOOD 유지");
  const q = parsePillars("癸亥 己未 己未 丙寅"); const bq = balance(q); assert.equal(luck(q, "癸亥", bq, yongsin(q, bq)).지지.점수, 2, "#31은 지지 비겁 둘뿐 → 적용 안 함");
});

test("카드 011 [기각·조건부]: 운 지지가 원국과 반합으로 기신 오행을 키우면 점수는 그대로 두고 '양면' 플래그만 (S-08 보충)", () => {
  const p = parsePillars("辛酉 乙未 丙午 甲午"); const b = balance(p); const y = yongsin(p, b); const rel = relations(p, b, y);   // 라벨 #16
  const lr = luckRelations(p, "戊戌", b, y, rel); assert.ok(lr.합.some((h) => h.종류 === "반합" && h.오행 === "화")); assert.ok(lr.플래그.some((f) => f.includes("양면")));
  assert.ok(luck(p, "戊戌", b, y).합계 > 0, "토 식상이 오면 일단 좋다 — 점수는 그대로");
});

test("카드 012 [합의]: 신약·인성 용신이면 비겁 운도 희신급 (Y-12 신약 운)", () => {
  const p = parsePillars("壬辰 癸丑 丁丑 甲辰"); const b = balance(p); const y = yongsin(p, b);     // 라벨 #34: 화 신약, 식상 중심, 용신 목
  assert.equal(b.신강약, "신약"); assert.equal(y.용신그룹, "인성");
  const l = luck(p, "丁未", b, y); assert.equal(l.천간.점수, 1.5, "丁 비겁 = 희신급 1×1.5"); assert.ok(l.합계 > 0, "강사 GOOD"); assert.ok(l.플래그.some((f) => f.includes("카드 012")));
});

test("Y-02 세력방식: 기본은 정기(지지 = 대표오행 하나), 지장간 방식은 선택지로만 — 지장간을 넣으면 토가 늘고 신강약이 중화 쪽으로 움직임 (카드 016)", () => {
  const p = parsePillars("乙亥 丙戌 己丑 辛未"); const b0 = balance(p), b1 = balance(p, "지장간일수"), b2 = balance(p, "정기70지장간30");
  assert.deepEqual(balance(p), balance(p, "정기"), "기본값은 정기");
  assert.ok(b0.판정용퍼센트.토 > b1.판정용퍼센트.토, "일수 비율로 나누면 戌丑未의 토가 여기·중기로 새어 나감"); assert.ok(b1.인비 < b0.인비 && b2.인비 < b0.인비);
  assert.equal(b1.신강약, "신강"); assert.equal(b2.중심기운, "비겁");
  const sum = (m: any) => Object.values(power(p, m)).reduce((a: number, x: any) => a + x, 0); for (const m of ["정기", "지장간일수", "진춘익", "정기70지장간30", "엔진분포"] as const) assert.ok(Math.abs(sum(m) - 100) < 0.05, m + " 합 100");
  assert.ok(Math.abs(power(p, "엔진분포").토 - 36.01) < 0.01, "엔진 공식(ELEMENT_DISTRIBUTION.md 4절 기대값) 토 36.01");
});

test("카드 007~012 뒤에도 사용자 사주(1990·1995)의 대운 판정은 그대로 (1995 己卯·戊寅은 Y-15로 −2 → −2.5, 판정 '주의' 그대로)", () => {
  const p = parsePillars("乙亥 丙戌 己丑 辛未"); const b = balance(p); const y = yongsin(p, b);
  assert.equal(luck(p, "庚辰", b, y).판정, "주의"); assert.equal(luck(p, "丁未", b, y).판정, "어려움"); assert.equal(luck(p, "辛巳", b, y).합계, 0.5);
  const q = parsePillars("庚午 辛巳 庚辰 癸未"); const bq = balance(q); const yq = yongsin(q, bq);
  assert.equal(luck(q, "丁未", bq, yq).판정, "보통"); assert.ok(!johu(q, yq).극단);
});

test("카드 031 [합의]: 관성이 이미 중심인 신약은 정관 운도 기신급 — #24 乙未 BAD", () => {
  const p = parsePillars("丙辰 己亥 戊寅 乙卯"); const b = balance(p); const y = yongsin(p, b); const l = luck(p, "乙未", b, y);
  assert.equal(l.천간.점수, -3); assert.ok(l.합계 < 0, "강사 BAD"); assert.ok(l.플래그.some((f) => f.includes("숨이 막히는")));
});

test("카드 032 [합의 (1)]: T존 관성+인성 조합 태그 — 책임·압박을 배움으로 소화", () => {
  const p = parsePillars("壬辰 癸丑 丁丑 甲辰"); const c = tzoneCombo(p, tzone(p).항목);   // #34 월간 癸 편관 + 시간 甲 정인
  assert.ok(c.some((x) => x.조합.join() === "관성,인성" && x.태그.includes("배움으로 소화")));
});

test("카드 032 보충: T존 관성+인성 — 신강이면 '생각이 많아 시작이 느림' 양면, 편관·편인이면 '독특한 모양'", () => {
  const p = parsePillars("庚子 戊子 庚辰 丙戌"); const c = tzoneCombo(p, tzone(p).항목, balance(p));   // #14 庚 신강, 시간 丙 편관 + 편인
  const x = c.find((v) => v.조합.join() === "관성,인성")!; assert.ok(x.양면?.includes("시작이 느려")); assert.ok(x.태그.includes("독특한"));
});

test("카드 034·035 [합의·조건부]: T존 식상+재성 '결과물을 목표로', 재성+관성 '사회생활에 매우 유리' — 신약이면 양면", () => {
  const p = parsePillars("己酉 乙亥 甲辰 丁卯"); const c = tzoneCombo(p, tzone(p).항목, balance(p));   // #15 시간 丁 상관 + 일지 辰 편재
  assert.ok(c.some((x) => x.조합.join() === "식상,재성" && x.태그.includes("결과물")));
  const q = parsePillars("壬戌 壬寅 己卯 壬申"); const bq = balance(q); const d = tzoneCombo(q, tzone(q).항목, bq);   // #10 己 신약, 壬 정재 + 卯 편관
  const x = d.find((v) => v.조합.join() === "재성,관성")!; assert.ok(x.태그.includes("사회생활")); assert.equal(bq.신강약, "신약"); assert.ok(x.양면?.includes("번아웃"));
});

test("Y-06 보충 [사용자 확답 012·P009]: 신약에 인성 용신이면 희신 = 비겁, 한신 = 관성 — #34 '목·화가 용희신', 효준 乙亥 癸未 丙辰 壬辰", () => {
  for (const c of ["壬辰 癸丑 丁丑 甲辰", "乙亥 癸未 丙辰 壬辰"]) { const p = parsePillars(c); const b = balance(p); const y = yongsin(p, b);
    assert.equal(b.신강약, "신약"); assert.equal(y.용신그룹, "인성"); assert.equal(y.역할.비겁, "희"); assert.equal(y.역할.관성, "한"); assert.equal(y.역할.재성, "기"); }
  const q = parsePillars("庚午 辛巳 庚辰 癸未"); const yq = yongsin(q, balance(q)); assert.equal(yq.역할.관성, "한", "1990 신강은 그대로");
});
