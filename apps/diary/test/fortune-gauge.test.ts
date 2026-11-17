// 2026-11-15 앱 주인: "막대를 가로로, − 없이 +로만, 50을 보통으로" — 신호 세기 → 0~100 게이지
import { describe, expect, test } from "vitest";
import { areaGaugeOf } from "@/lib/fortune/areaProfile";

describe("영역 게이지 0~100", () => {
  test("신호 없음은 50, 한 단계마다 15, 끝은 5와 95", () => {
    expect(areaGaugeOf(0, false)).toBe(50);
    expect(areaGaugeOf(2, false)).toBe(50);   // active가 아니면 세기와 상관없이 보통
    expect([1, 2, 3, 5].map((s) => areaGaugeOf(s, true))).toEqual([65, 80, 95, 95]);
    expect([-1, -2, -3, -6].map((s) => areaGaugeOf(s, true))).toEqual([35, 20, 5, 5]);
  });
});

test("같은 세기면 좋은 쪽과 조심할 쪽의 거리가 같다 (±1.5, ±2.5)", () => {
  for (const s of [0.5, 1.5, 2.5]) expect(areaGaugeOf(s, true) - 50).toBe(50 - areaGaugeOf(-s, true));
});
