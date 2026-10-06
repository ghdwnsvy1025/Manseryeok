// @saju/core-rules 스모크 — 일기 앱에서 패키지가 링크되고 luck() 이 한 번 돌아 결과 모양이 맞는지만 본다.
// 판정값 자체는 패키지 쪽 테스트(packages/saju-core-rules/test)가 검증한다.
import { describe, expect, test } from "vitest";
import { balance, luck, toCorePillars, yongsin } from "@saju/core-rules";
import type { PillarsSnapshot } from "@/lib/profile";

// fortune.test.ts 와 같은 사주: 1990-01-01 12:00 서울 → 己巳 丙子 丙寅 甲午
const ME: PillarsSnapshot = {
  year: { stem: "己", branch: "巳", ko: "기사" },
  month: { stem: "丙", branch: "子", ko: "병자" },
  day: { stem: "丙", branch: "寅", ko: "병인" },
  hour: { stem: "甲", branch: "午", ko: "갑오" },
};

describe("@saju/core-rules 연결", () => {
  test("PillarsSnapshot → Pillars → luck() 결과 형태", () => {
    const p = toCorePillars(ME);
    expect(p).toEqual(["己巳", "丙子", "丙寅", "甲午"]);
    const b = balance(p);
    const y = yongsin(p, b);
    const l = luck(p, "庚申", b, y); // 2026-10-03 전후의 일진 하나
    expect(["매우 유리", "유리", "보통", "주의", "어려움"]).toContain(l.판정);
    expect(l.천간).toMatchObject({ 글자: "庚" });
    expect(l.지지).toMatchObject({ 글자: "申" });
    expect(typeof l.천간.점수).toBe("number");
    expect(["용", "희", "기", "구", "한"]).toContain(l.천간.라벨);
  });
});
