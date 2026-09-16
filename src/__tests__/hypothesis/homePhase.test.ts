/**
 * 홈 시간대 판정 검증
 *
 * 이 함수 하나가 홈 전체를 가른다. 경계(5시·18시)와 자정 넘김에서
 * 틀리면 사용자가 새벽 4시에 "좋은 아침" 인사를 받는다.
 */
import { describe, expect, test } from "@jest/globals";
import {
  greeting,
  isNightHour,
  phaseHint,
  resolveHomePhase,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
} from "@/lib/hypothesis/homePhase";

describe("밤 판정", () => {
  test("18시부터 다음날 5시 전까지가 밤", () => {
    // 낮
    for (const h of [5, 6, 9, 12, 15, 17]) {
      expect(`${h}시=${isNightHour(h)}`).toBe(`${h}시=false`);
    }
    // 밤
    for (const h of [18, 20, 23, 0, 1, 4]) {
      expect(`${h}시=${isNightHour(h)}`).toBe(`${h}시=true`);
    }
  });

  test("경계값이 정확하다", () => {
    expect(isNightHour(NIGHT_END_HOUR - 1)).toBe(true); // 4시 → 밤
    expect(isNightHour(NIGHT_END_HOUR)).toBe(false); // 5시 → 낮
    expect(isNightHour(NIGHT_START_HOUR - 1)).toBe(false); // 17시 → 낮
    expect(isNightHour(NIGHT_START_HOUR)).toBe(true); // 18시 → 밤
  });

  test("이상한 값이 와도 터지지 않는다", () => {
    expect(isNightHour(Number.NaN)).toBe(false);
    expect(isNightHour(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("홈 화면 결정", () => {
  test("기록을 했으면 시간과 무관하게 done", () => {
    for (const h of [4, 8, 13, 19, 23]) {
      expect(resolveHomePhase({ hour: h, hasTodayEntry: true })).toBe("done");
    }
  });

  test("기록 전이면 낮은 day, 밤은 night", () => {
    expect(resolveHomePhase({ hour: 8, hasTodayEntry: false })).toBe("day");
    expect(resolveHomePhase({ hour: 12, hasTodayEntry: false })).toBe("day");
    expect(resolveHomePhase({ hour: 22, hasTodayEntry: false })).toBe("night");
    expect(resolveHomePhase({ hour: 3, hasTodayEntry: false })).toBe("night");
  });

  test("24시간 전부 셋 중 하나로 떨어진다", () => {
    for (let h = 0; h < 24; h += 1) {
      const phase = resolveHomePhase({ hour: h, hasTodayEntry: false });
      expect(["day", "night", "done"]).toContain(phase);
    }
  });
});

describe("인사말", () => {
  test("시간대에 맞는 말이 나온다", () => {
    expect(greeting(7, false)).toBe("좋은 아침이에요");
    expect(greeting(14, false)).toBe("오후예요");
    expect(greeting(20, false)).toBe("저녁이에요");
    expect(greeting(2, false)).toBe("늦은 밤이네요");
  });

  test("새벽 4시에 '좋은 아침'이라고 하지 않는다", () => {
    expect(greeting(4, false)).not.toContain("아침");
  });

  test("기록을 마쳤으면 감사 인사", () => {
    for (const h of [7, 14, 20, 2]) {
      expect(greeting(h, true)).toContain("고마워요");
    }
  });

  test("24시간 전부 빈 문자열이 아니다", () => {
    for (let h = 0; h < 24; h += 1) {
      expect(`${h}시: ${greeting(h, false)}`.length).toBeGreaterThan(5);
    }
  });
});

describe("빠져나갈 문", () => {
  test("낮이 아닐 때는 반대쪽으로 가는 길을 안내한다", () => {
    // 시간 판정이 틀렸을 때 사용자가 되돌릴 수 있어야 한다
    const night = phaseHint("night");
    expect(night.text).toContain("밤");
    expect(night.toggleLabel).toContain("운세");

    const done = phaseHint("done");
    expect(done.toggleLabel).toContain("운세");
  });

  test("모든 화면에 이동 버튼 문구가 있다", () => {
    for (const phase of ["day", "night", "done"] as const) {
      expect(phaseHint(phase).toggleLabel.length).toBeGreaterThan(2);
    }
  });
});
