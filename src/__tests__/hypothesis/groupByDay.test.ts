/**
 * 카드 날짜 묶기 검증.
 *
 * 사장님이 "9월 13일이 왜 여러 군데 흩어져 있냐"고 지적한 화면을 고친 것이다.
 * 흩어져 보인 이유는 버그가 아니라 **정렬 기준과 첫 칸이 어긋나서**였다.
 * 여기서 묶는 규칙을 고정해 두고, 나중에 정렬을 손대면 터지게 한다.
 */
import { describe, expect, test } from "@jest/globals";
import { groupCardsByDay } from "@/lib/hypothesis/groupByDay";
import type { HypothesisCard, HypothesisStatus } from "@/lib/hypothesis/types";
import type { WhenDays } from "@/lib/hypothesis/whenDays";

const TODAY = "2026-09-11";

function card(
  id: string,
  status: HypothesisStatus,
  gap: number | null,
  progress = 1
): HypothesisCard {
  return {
    rule: { id, title: id, metric: "energy" } as HypothesisCard["rule"],
    status,
    progress,
    headline: "",
    evidence: {
      matchedDays: 10,
      unmatchedDays: 20,
      matchedMean: 4,
      unmatchedMean: 3,
      gap,
      needMatched: 5,
    } as HypothesisCard["evidence"],
  } as HypothesisCard;
}

function when(opts: {
  isToday?: boolean;
  nextDate?: string | null;
  ganji?: string | null;
}): WhenDays {
  return {
    isToday: opts.isToday ?? false,
    nextDate: opts.nextDate ?? null,
    nextGanjiKo: opts.ganji ?? null,
    countAhead: 3,
    upcoming: opts.nextDate ? [opts.nextDate] : [],
  };
}

function run(
  cards: HypothesisCard[],
  whens: Record<string, WhenDays>,
  todayGanjiKo: string | null = "무자"
) {
  return groupCardsByDay({
    cards,
    whenByRule: new Map(Object.entries(whens)),
    today: TODAY,
    todayGanjiKo,
  });
}

describe("같은 날짜는 한 그룹으로", () => {
  test("9/13 에 걸린 카드 셋이 한 묶음이 된다", () => {
    const { groups } = run(
      [
        card("a", "confirmed", 1),
        card("b", "confirmed", 2.2),
        card("c", "exception", -1.4),
      ],
      {
        a: when({ nextDate: "2026-09-13", ganji: "경인" }),
        b: when({ nextDate: "2026-09-13", ganji: "경인" }),
        c: when({ nextDate: "2026-09-13", ganji: "경인" }),
      }
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("9/13");
    expect(groups[0]!.ganjiKo).toBe("경인");
    expect(groups[0]!.cards).toHaveLength(3);
  });

  test("그룹 안에서는 차이가 큰 것부터", () => {
    const { groups } = run(
      [
        card("작음", "confirmed", 1),
        card("큼", "confirmed", 2.2),
        card("중간", "exception", -1.4),
      ],
      {
        작음: when({ nextDate: "2026-09-13" }),
        큼: when({ nextDate: "2026-09-13" }),
        중간: when({ nextDate: "2026-09-13" }),
      }
    );
    expect(groups[0]!.cards.map((c) => c.rule.id)).toEqual([
      "큼",
      "중간",
      "작음",
    ]);
  });
});

describe("그룹 순서", () => {
  test("오늘이 언제나 맨 앞, 나머지는 날짜순", () => {
    const { groups } = run(
      [
        card("멀리", "confirmed", 1),
        card("오늘것", "confirmed", 1),
        card("가까이", "confirmed", 1),
      ],
      {
        멀리: when({ nextDate: "2026-09-21" }),
        오늘것: when({ isToday: true }),
        가까이: when({ nextDate: "2026-09-13" }),
      }
    );
    expect(groups.map((g) => g.label)).toEqual(["오늘", "9/13", "9/21"]);
  });

  test("오늘 그룹은 오늘의 간지를 쓴다", () => {
    const { groups } = run([card("x", "confirmed", 1)], {
      x: when({ isToday: true, ganji: "무시되어야함" }),
    });
    expect(groups[0]!.ganjiKo).toBe("무자");
  });

  test("한 달 안에 안 오는 날은 맨 뒤", () => {
    const { groups } = run(
      [card("없음", "confirmed", 1), card("있음", "confirmed", 1)],
      {
        없음: when({ nextDate: null }),
        있음: when({ nextDate: "2026-09-21" }),
      }
    );
    expect(groups.map((g) => g.label)).toEqual(["9/21", "한 달 안엔 없어요"]);
  });
});

describe("확인 중인 카드", () => {
  test("날짜로 묶지 않고 따로 내려간다", () => {
    const { groups, waiting } = run(
      [
        card("확정", "confirmed", 1),
        card("아직1", "collecting", 1, 0.6),
        card("아직2", "collecting", 1, 0.2),
      ],
      {
        확정: when({ nextDate: "2026-09-13" }),
        아직1: when({ nextDate: "2026-09-13" }),
        아직2: when({ nextDate: "2026-09-13" }),
      }
    );
    // "이 날은 3가지"가 되면 안 된다 — 확정된 건 하나뿐이다
    expect(groups).toHaveLength(1);
    expect(groups[0]!.cards).toHaveLength(1);
    expect(waiting.map((c) => c.rule.id)).toEqual(["아직1", "아직2"]);
  });

  test("확인 중은 진행률이 높은 것부터", () => {
    const { waiting } = run(
      [
        card("느림", "collecting", null, 0.2),
        card("빠름", "collecting", null, 0.8),
      ],
      { 느림: when({}), 빠름: when({}) }
    );
    expect(waiting.map((c) => c.rule.id)).toEqual(["빠름", "느림"]);
  });

  test("차이 없음(neutral)은 확정 쪽에 남는다", () => {
    const { groups, waiting } = run([card("무난", "neutral", 0.1)], {
      무난: when({ nextDate: "2026-09-13" }),
    });
    expect(groups[0]!.cards).toHaveLength(1);
    expect(waiting).toHaveLength(0);
  });
});

describe("날짜를 못 구할 때", () => {
  test("묶지 않고 한 덩어리로 (차이 큰 순)", () => {
    const { groups } = run(
      [card("작음", "confirmed", 1), card("큼", "confirmed", 3)],
      {}
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe("");
    expect(groups[0]!.cards.map((c) => c.rule.id)).toEqual(["큼", "작음"]);
  });

  test("카드가 하나도 없으면 그룹도 없다", () => {
    const { groups, waiting } = run([], {});
    expect(groups).toHaveLength(0);
    expect(waiting).toHaveLength(0);
  });

  test("확인 중만 있으면 그룹은 비고 대기만 찬다", () => {
    const { groups, waiting } = run([card("x", "collecting", null, 0.4)], {
      x: when({ nextDate: "2026-09-13" }),
    });
    expect(groups).toHaveLength(0);
    expect(waiting).toHaveLength(1);
  });
});
