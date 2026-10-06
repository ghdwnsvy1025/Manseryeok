// 원본: 사주 코어 core/test/birth.test.ts @ ebf972d4c44c02f6f6bf01bbd4fa396b2d6907cc (2026-10-05 복사). node:test → vitest 로만 바꿈. 기대값 수정 금지.
import { test } from "vitest";
import assert from "node:assert/strict";
import { fromBirth, yearGanji } from "../src/birth";
import { checkPillars } from "../src/base";

test("기준.md 확인값: 1990-05-15 14:30 서울 남 → 庚午 辛巳 庚辰 癸未, 순행 7년 2개월, 첫 대운 壬午", () => {
  const r = fromBirth({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, 성별: "남" });
  assert.deepEqual(r.pillars, ["庚午", "辛巳", "庚辰", "癸未"]); assert.equal(r.대운.방향, "순행");
  assert.deepEqual(r.대운.시작나이, { 년: 7, 월: 2 }); assert.equal(r.대운.목록[0].간지, "壬午"); assert.equal(r.보정.경도보정분, -32.1);
});
test("자정 직후 출생: 00:10 서울 → 보정 시각은 전날 23:38, 일주는 庚辰 (앱 엔진은 辛巳로 틀림)", () => {
  const r = fromBirth({ year: 1990, month: 5, day: 15, hour: 0, minute: 10, 성별: "남" });
  assert.equal(r.보정.보정시각, "1990-05-14 23:38"); assert.equal(r.pillars[2], "庚辰"); assert.equal(r.pillars[3], "丙子"); assert.deepEqual(checkPillars(r.pillars), []);
});
test("23:40 출생 → 보정 23:08 → 자시 → 다음 날 일주 (기준.md: 辛巳 / 戊子)", () => {
  const r = fromBirth({ year: 1990, month: 5, day: 15, hour: 23, minute: 40, 성별: "남" }); assert.equal(r.pillars[2], "辛巳"); assert.equal(r.pillars[3], "戊子");
});
test("서머타임: 1988-07-01 09:00 → 1시간 뺌", () => {
  const r = fromBirth({ year: 1988, month: 7, day: 1, hour: 9, minute: 0, 성별: "여" }); assert.equal(r.보정.서머타임, true); assert.equal(r.보정.실제KST, "1988-07-01 08:00"); assert.equal(r.보정.보정시각, "1988-07-01 07:28");
});
test("동경 127.5° 기간: 1957-01-10 12:00 서울 → 경도 보정은 약 −2분 (KST로는 12:30)", () => {
  const r = fromBirth({ year: 1957, month: 1, day: 10, hour: 12, minute: 0, 성별: "남" }); assert.equal(r.보정.표준시1275, true); assert.equal(r.보정.실제KST, "1957-01-10 12:30"); assert.equal(r.보정.보정시각, "1957-01-10 11:58");
});
test("시간 모름 / 음력 입력 / 세운 간지", () => {
  const r = fromBirth({ year: 1990, month: 5, day: 15, 성별: "여" }); assert.equal(r.pillars[3], null); assert.equal(r.대운.방향, "역행");
  const l = fromBirth({ year: 1990, month: 4, day: 21, 달력: "음력", hour: 14, minute: 30, 성별: "남" }); assert.equal(l.양력, "1990-05-15"); assert.deepEqual(l.pillars, ["庚午", "辛巳", "庚辰", "癸未"]);
  assert.equal(yearGanji(2026), "丙午"); assert.equal(yearGanji(1984), "甲子");
});

test("Y-11 월운: 절입으로 바뀌는 12개월, 월간은 그 해 연간에서 (2026 丙午 → 寅월 庚寅)", async () => {
  const { monthGanjiList } = await import("../src/birth");
  const ms = monthGanjiList("2026-09-29", 12);
  assert.equal(ms.length, 12);
  assert.equal(ms[0].간지, "丁酉");                                   // 2026-09-07 백로 ~ 10-08 한로
  assert.ok(ms[0].시작.startsWith("2026-09-07") && ms[0].끝.startsWith("2026-10-08"));
  assert.equal(ms[1].간지, "戊戌");
  assert.equal(ms.find((m) => m.사주연도 === 2027 && m.월번호 === 1)!.간지, "壬寅");   // 丁未년 寅월 = 壬寅
  for (let i = 1; i < ms.length; i++) assert.equal(ms[i].시작, ms[i - 1].끝);          // 구간이 빈틈없이 이어짐
});

// [이식] "Y-11 월운이 판정에 붙고 확신도는 항상 '낮음'" 테스트는 reading.ts(이 패키지에 없음)를 쓰므로 뺐다.
// 같은 기대값(戊戌 매우 유리 / 壬寅 어려움 / 丁未 월지 충)은 test/adapters.test.ts 에서 luck()·luckRelations() 로 직접 확인한다.
