/**
 * 운세 맞춤도 검증
 *
 * 이 숫자는 홈에서 사용자가 매일 보는 값이다.
 * "레벨이 높아질수록 운세가 정확해져요"가 거짓말이었던 자리를 대신하므로,
 * 이 값만큼은 **오르는 이유가 항상 진짜여야** 한다.
 */
import { describe, expect, test } from "@jest/globals";
import {
  computeCompletion,
  completionHeadline,
  hypothesisAxisRatio,
  COMPLETION_TARGETS,
  COMPLETION_WEIGHTS,
  type CompletionInput,
} from "@/lib/hypothesis/completion";
import type { HypothesisCard, HypothesisStatus } from "@/lib/hypothesis/types";

function card(status: HypothesisStatus, progress = 0): HypothesisCard {
  return {
    rule: { id: `r-${status}-${progress}` } as HypothesisCard["rule"],
    status,
    evidence: {
      matchedDays: 0, unmatchedDays: 0, matchedMean: null,
      unmatchedMean: null, gap: null, needMatched: 5, needUnmatched: 5,
    },
    headline: "",
    progress,
  };
}

const EMPTY: CompletionInput = {
  recordedDays: 0,
  cards: [],
  collectedGanji: 0,
  weekdayCoverage: 0,
  moodVariety: 0,
  moodTotal: 13,
};

describe("가중치", () => {
  test("합이 정확히 1이다", () => {
    const sum = Object.values(COMPLETION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("맞춤도 계산", () => {
  test("아무 기록도 없으면 0%", () => {
    const r = computeCompletion(EMPTY);
    expect(r.percent).toBe(0);
    expect(r.nextStep).toContain("30초");
  });

  test("모든 축이 꽉 차면 100%", () => {
    const r = computeCompletion({
      recordedDays: COMPLETION_TARGETS.days,
      cards: [card("confirmed"), card("exception"), card("neutral")],
      collectedGanji: COMPLETION_TARGETS.ganji,
      weekdayCoverage: 7,
      moodVariety: 13,
      moodTotal: 13,
    });
    expect(r.percent).toBe(100);
  });

  test("목표를 넘겨도 100%를 넘지 않는다", () => {
    const r = computeCompletion({
      recordedDays: 999,
      cards: [card("confirmed")],
      collectedGanji: 999,
      weekdayCoverage: 99,
      moodVariety: 99,
      moodTotal: 13,
    });
    expect(r.percent).toBe(100);
  });

  test("기록이 늘면 절대 줄지 않는다", () => {
    let prev = -1;
    for (const days of [0, 1, 5, 10, 20, 40, 60]) {
      const r = computeCompletion({ ...EMPTY, recordedDays: days });
      expect(r.percent).toBeGreaterThanOrEqual(prev);
      prev = r.percent;
    }
  });

  test("네 축이 각각 실제로 기여한다", () => {
    const base = computeCompletion(EMPTY).percent;

    const onlyDays = computeCompletion({
      ...EMPTY,
      recordedDays: COMPLETION_TARGETS.days,
    }).percent;
    const onlyCards = computeCompletion({ ...EMPTY, cards: [card("confirmed")] }).percent;
    const onlyGanji = computeCompletion({ ...EMPTY, collectedGanji: 60 }).percent;
    const onlyVariety = computeCompletion({
      ...EMPTY, weekdayCoverage: 7, moodVariety: 13,
    }).percent;

    for (const value of [onlyDays, onlyCards, onlyGanji, onlyVariety]) {
      expect(value).toBeGreaterThan(base);
    }

    // 가중치 순서대로여야 한다: 기록(.35) > 성향(.25) = 다양성(.25) > 간지(.15)
    expect(onlyDays).toBeGreaterThan(onlyCards);
    expect(onlyCards).toBe(onlyVariety);
    expect(onlyVariety).toBeGreaterThan(onlyGanji);
  });
});

describe("가설 축", () => {
  test("확인 중인 카드는 아직 안 센다", () => {
    // 화면에 "확인된 성향 0/9"라고 적혀 있는데 숫자만 올라가면 어긋난다.
    // 세는 기준을 화면 문구와 똑같이 맞춘다.
    expect(hypothesisAxisRatio([card("collecting", 0)])).toBe(0);
    expect(hypothesisAxisRatio([card("collecting", 0.9)])).toBe(0);
    expect(hypothesisAxisRatio([card("confirmed")])).toBe(1);
    expect(hypothesisAxisRatio([card("confirmed"), card("collecting", 0.9)])).toBe(0.5);
  });

  test("어떤 판정이든 확정이면 똑같이 1이다", () => {
    // "당신은 달랐습니다"도 알아낸 것이다. 맞은 것만 쳐주면 안 된다.
    expect(hypothesisAxisRatio([card("confirmed")])).toBe(1);
    expect(hypothesisAxisRatio([card("exception")])).toBe(1);
    expect(hypothesisAxisRatio([card("neutral")])).toBe(1);
  });

  test("카드가 없으면 0", () => {
    expect(hypothesisAxisRatio([])).toBe(0);
  });
});

describe("다음 할 일 안내", () => {
  test("가장 덜 찬 축을 집어 구체적으로 말한다", () => {
    // 기록만 부족한 경우
    const needDays = computeCompletion({
      ...EMPTY,
      recordedDays: 3,
      cards: [card("confirmed")],
      collectedGanji: 60,
      weekdayCoverage: 7,
      moodVariety: 13,
    });
    expect(needDays.nextStep).toContain("일 더 기록");

    // 간지만 부족한 경우
    const needGanji = computeCompletion({
      ...EMPTY,
      recordedDays: 60,
      cards: [card("confirmed")],
      collectedGanji: 5,
      weekdayCoverage: 7,
      moodVariety: 13,
    });
    expect(needGanji.nextStep).toContain("안 겪어본");
  });
});

describe("문구", () => {
  test("0%일 때 정직하게 말한다", () => {
    expect(completionHeadline(0)).toContain("남들과 같습니다");
  });

  test("모든 구간에 문구가 있고 숫자가 들어간다", () => {
    for (const p of [1, 24, 25, 59, 60, 99]) {
      expect(completionHeadline(p)).toContain(String(p));
    }
    expect(completionHeadline(100)).toContain("완전히");
  });
});
