// 2026-10-31 나 탭 만세력 화면: 십이운성표, 12신살·신살 칩, 중심 기운·용신·대운이 한 장으로 나오는지
import { describe, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { computeProfile } from "@/lib/profile";
import { sajuChart, unseongOf } from "@/lib/saju/chart";
import { sajucowCardUrl } from "@/lib/sajucow";

describe("십이운성", () => {
  test("양간 순행·음간 역행 (표준표)", () => {
    expect(unseongOf("甲", "亥")).toBe("장생");
    expect(unseongOf("甲", "寅")).toBe("건록");
    expect(unseongOf("甲", "卯")).toBe("제왕");
    expect(unseongOf("乙", "午")).toBe("장생");
    expect(unseongOf("乙", "卯")).toBe("건록");
    expect(unseongOf("丙", "午")).toBe("제왕");
    expect(unseongOf("癸", "子")).toBe("건록");
    expect(unseongOf("庚", "酉")).toBe("제왕");
  });
});

describe("만세력 한 장", () => {
  const input = { name: "x", gender: "female" as const, calendar: "solar" as const, isLeapMonth: false, birthYear: 1995, birthMonth: 3, birthDay: 14, birthHour: 9, birthMinute: 30, city: "seoul" as const };
  const c = computeProfile(input);
  if (!c.ok) throw new Error("profile");
  const { name: _n, ...birth } = input;
  const chart = sajuChart(c.value.pillars, birth, "2026-10-31");

  test("기둥 넷(시·일·월·연), 일간은 '나', 표의 줄이 다 찬다", () => {
    expect(chart.columns.map((x) => x.label)).toEqual(["시주", "일주", "월주", "연주"]);
    expect(chart.columns[1]!.stemGod).toBe("나");
    for (const col of chart.columns) {
      expect(col.unseong).not.toBeNull();
      expect(col.sal12).not.toBeNull();
      expect(col.hidden.length).toBeGreaterThan(0);
    }
  });
  test("중심 기운·용신·대운", () => {
    expect(["신강", "중화", "신약"]).toContain(chart.center.strength);
    expect(chart.yongsin).not.toBeNull();
    expect(chart.daeun?.current).not.toBeNull();
  });
  test("시간 모름이면 시주 칸이 비고 나머지는 그대로", () => {
    const c2 = computeProfile({ ...input, birthHour: null, birthMinute: null });
    if (!c2.ok) throw new Error("profile");
    const ch = sajuChart(c2.value.pillars, { ...birth, birthHour: null, birthMinute: null }, "2026-10-31");
    expect(ch.hourUnknown).toBe(true);
    expect(ch.columns[0]!.unknown).toBe(true);
    expect(ch.columns[1]!.unseong).not.toBeNull();
  });
});

describe("바이럴 링크", () => {
  test("일주 카드 페이지, 생년월일 없음", () => {
    expect(sajucowCardUrl("갑자")).toBe("https://sajucow.com/card/gapja/?from=diary&at=saju");
    expect(sajucowCardUrl("모름")).toBe("https://sajucow.com/?from=diary&at=saju");
  });
});
