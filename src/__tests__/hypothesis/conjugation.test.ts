/**
 * 문구 연결형 검증.
 *
 * "마음이 편해요" 를 문장 중간에 넣으면서 **"마음이 편해고"** 로 내보낸 적이 있다.
 * `요` → `고` 규칙 하나로 한국어 축약(해요 = 하 + 여요)을 되돌릴 수 없어서 생긴 일이다.
 * 지금은 지표마다 연결형을 적어 두는데, 적다가 틀릴 수 있으므로 여기서 고정한다.
 */
import { describe, expect, test } from "@jest/globals";
import { METRICS, type MetricCode } from "@/lib/hypothesis/types";
import { todayPatternLine, type TodayPattern } from "@/lib/hypothesis/todayPattern";

const ALL = Object.keys(METRICS) as MetricCode[];

describe("연결형 문구", () => {
  test("모든 지표가 위·아래 연결형을 갖고 있다", () => {
    for (const code of ALL) {
      const m = METRICS[code];
      expect(`${code}.upConn`).toBe(m.upConn ? `${code}.upConn` : "");
      expect(`${code}.downConn`).toBe(m.downConn ? `${code}.downConn` : "");
    }
  });

  test("연결형은 반드시 '고'로 끝난다", () => {
    const bad: string[] = [];
    for (const code of ALL) {
      for (const text of [METRICS[code].upConn, METRICS[code].downConn]) {
        if (!text.endsWith("고")) bad.push(`${code}: ${text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("연결형에 종결어미 '요'가 남아 있지 않다", () => {
    // "마음이 편해고" 같은 사고를 막는 건 아니지만, "…요고" 류를 잡는다
    const bad: string[] = [];
    for (const code of ALL) {
      for (const text of [METRICS[code].upConn, METRICS[code].downConn]) {
        if (text.includes("요")) bad.push(`${code}: ${text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  test("스무 개 전부 손으로 확인한 값과 같다", () => {
    // 여기가 진짜 검증이다. 하나라도 어긋나면 사용자가 읽는 문장이 이상해진다.
    const expected: Record<string, string> = {
      "기분이 좋아요": "기분이 좋고",
      "기분이 가라앉아요": "기분이 가라앉고",
      "힘이 나요": "힘이 나고",
      "쉽게 지쳐요": "쉽게 지치고",
      "집중이 잘 돼요": "집중이 잘 되고",
      "집중이 잘 안 돼요": "집중이 잘 안 되고",
      "몸이 가벼워요": "몸이 가볍고",
      "몸이 무거워요": "몸이 무겁고",
      "마음이 편해요": "마음이 편하고",
      "마음이 좁아져요": "마음이 좁아지고",
      "잘 쉬어져요": "잘 쉬어지고",
      "잘 못 쉬어요": "잘 못 쉬고",
      "일이 잘 풀려요": "일이 잘 풀리고",
      "일이 잘 안 풀려요": "일이 잘 안 풀리고",
      "사람이 편해요": "사람이 편하고",
      "사람이 불편해요": "사람이 불편하고",
      "씀씀이가 잡혀요": "씀씀이가 잡히고",
      "돈이 새요": "돈이 새고",
      "일이 움직여요": "일이 움직이고",
      "일이 멈춰요": "일이 멈추고",
    };

    const seen: string[] = [];
    for (const code of ALL) {
      const m = METRICS[code];
      expect(`${m.up} → ${m.upConn}`).toBe(`${m.up} → ${expected[m.up]}`);
      expect(`${m.down} → ${m.downConn}`).toBe(`${m.down} → ${expected[m.down]}`);
      seen.push(m.up, m.down);
    }
    // 표에 없는 문구가 새로 생기면 여기서 터진다
    expect(seen.filter((t) => !(t in expected))).toEqual([]);
  });
});

function pattern(code: MetricCode, up: boolean, gap: number): TodayPattern {
  const m = METRICS[code];
  return {
    ruleId: `r-${code}`,
    dayTitle: "어떤 날",
    metric: code,
    fact: up ? m.up : m.down,
    factConn: up ? m.upConn : m.downConn,
    up,
    gap,
    matchedDays: 10,
    isException: false,
  };
}

describe("두 개를 이은 한 줄", () => {
  test("앞엣것만 연결형이 되고 뒤는 그대로다", () => {
    const line = todayPatternLine([
      pattern("emotional_balance", true, 1.4), // 마음이 편해요
      pattern("recovery_sleep", true, 1.0), // 잘 쉬어져요
    ]);
    expect(line).toBe("마음이 편하고, 잘 쉬어져요");
  });

  test("하나면 그대로 종결형", () => {
    expect(todayPatternLine([pattern("focus_execution", true, 1)])).toBe(
      "집중이 잘 돼요"
    );
  });

  test("셋이 와도 두 개까지만 쓴다", () => {
    const line = todayPatternLine([
      pattern("focus_execution", true, 2),
      pattern("energy", true, 1),
      pattern("happiness", true, 0.5),
    ]);
    expect(line).toBe("집중이 잘 되고, 힘이 나요");
  });

  test("없으면 null", () => {
    expect(todayPatternLine([])).toBeNull();
  });

  test("어떤 두 지표를 붙여도 '요고'가 생기지 않는다", () => {
    const bad: string[] = [];
    for (const a of ALL) {
      for (const b of ALL) {
        if (a === b) continue;
        for (const upA of [true, false]) {
          const line = todayPatternLine([pattern(a, upA, 2), pattern(b, true, 1)]);
          if (line && (line.includes("요고") || line.includes("요,") === false)) {
            // 앞엣것에 "요"가 남았거나 뒤엣것이 종결형이 아니면 이상하다
            if (line.includes("요고")) bad.push(line);
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
