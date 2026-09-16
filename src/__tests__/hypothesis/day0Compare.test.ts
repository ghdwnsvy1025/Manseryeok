/**
 * 첫날 짐작 ↔ 기록 대조 검증.
 *
 * 지켜야 할 선
 *   1. 짐작은 판정을 바꾸지 않는다 — 대조만 한다.
 *   2. 확인 중인 카드에는 "짐작대로/달라요"를 붙이지 않는다.
 *   3. "틀렸다"를 쓰지 않는다.
 */
import { describe, expect, test } from "@jest/globals";
import { compareDay0, summarizeDay0 } from "@/lib/hypothesis/day0Compare";
import type { Day0Answers, Day0Guess } from "@/lib/hypothesis/day0Answers";
import type { HypothesisCard, HypothesisStatus } from "@/lib/hypothesis/types";

function card(id: string, status: HypothesisStatus, days = 13): HypothesisCard {
  return {
    rule: { id, title: id } as HypothesisCard["rule"],
    status,
    progress: status === "collecting" ? 0.6 : 1,
    headline: "",
    evidence: {
      matchedDays: days,
      unmatchedDays: 20,
      matchedMean: 4,
      unmatchedMean: 3,
      gap: 1,
      needMatched: 5,
    } as HypothesisCard["evidence"],
  } as HypothesisCard;
}

function answers(guesses: Record<string, Day0Guess>): Day0Answers {
  return {
    guesses,
    ruleIds: Object.keys(guesses),
    answeredAt: "2026-09-01T00:00:00.000Z",
    version: "day0-answers-v1",
  };
}

describe("짐작 × 판정 — 경우 9가지 전부", () => {
  const cases: Array<[Day0Guess, HypothesisStatus, string, string]> = [
    ["agree", "confirmed", "match", "첫날 '맞아요'라고 하셨죠. 13일 기록도 같았어요."],
    ["agree", "exception", "differ", "첫날 '맞아요'라고 하셨는데, 13일 기록은 반대로 나왔어요."],
    ["agree", "neutral", "differ", "첫날 '맞아요'라고 하셨는데, 13일 기록으로는 큰 차이가 없었어요."],
    ["disagree", "confirmed", "differ", "첫날 '글쎄요'라고 하셨는데, 13일 기록은 맞다고 나왔어요."],
    ["disagree", "exception", "match", "첫날 '글쎄요'라고 하셨죠. 13일 기록도 사주 예상과 반대였어요."],
    ["disagree", "neutral", "match", "첫날 '글쎄요'라고 하셨죠. 13일 기록도 큰 차이가 없었어요."],
    ["unsure", "confirmed", "found", "첫날 '모르겠어요'였죠. 13일 기록이 답을 찾았어요."],
    ["unsure", "exception", "found", "첫날 '모르겠어요'였죠. 13일 기록이 답을 찾았어요."],
    ["unsure", "neutral", "found", "첫날 '모르겠어요'였죠. 13일 기록이 답을 찾았어요."],
  ];

  for (const [guess, status, verdict, sentence] of cases) {
    test(`${guess} + ${status} → ${verdict}`, () => {
      const c = compareDay0(card("x", status), answers({ x: guess }));
      expect(c.verdict).toBe(verdict);
      expect(c.sentence).toBe(sentence);
    });
  }

  test("목록 표시는 세 가지 말만 쓴다", () => {
    const chips = new Set<string | null>();
    for (const [guess, status] of cases) {
      chips.add(compareDay0(card("x", status), answers({ x: guess })).chip);
    }
    expect([...chips].sort()).toEqual(["기록이 찾았어요", "내 짐작과 달라요", "내 짐작대로"].sort());
  });
});

describe("확인 중인 카드", () => {
  test("목록에 짐작 표시를 붙이지 않는다 — 확정처럼 보이면 안 된다", () => {
    for (const guess of ["agree", "disagree", "unsure"] as Day0Guess[]) {
      const c = compareDay0(card("x", "collecting"), answers({ x: guess }));
      expect(c.verdict).toBe("waiting");
      expect(c.chip).toBeNull();
    }
  });

  test("펼치면 '확인하는 중'이라고만 말한다", () => {
    expect(compareDay0(card("x", "collecting"), answers({ x: "agree" })).sentence).toBe(
      "첫날 '맞아요'라고 하셨어요. 기록으로 확인하는 중이에요."
    );
    expect(compareDay0(card("x", "collecting"), answers({ x: "unsure" })).sentence).toBe(
      "첫날 '모르겠어요'였죠. 기록으로 확인하는 중이에요."
    );
  });
});

describe("짐작이 없을 때", () => {
  test("첫날 답이 아예 없으면 아무 말도 안 한다", () => {
    for (const a of [null, undefined]) {
      const c = compareDay0(card("x", "confirmed"), a);
      expect(c).toEqual({ verdict: "none", guess: null, chip: null, sentence: null });
    }
  });

  test("건너뛰었거나 첫날 이후 새로 생긴 카드도 아무 말도 안 한다", () => {
    const c = compareDay0(card("새카드", "confirmed"), answers({ 옛카드: "agree" }));
    expect(c.verdict).toBe("none");
    expect(c.chip).toBeNull();
  });
});

describe("짐작은 판정을 바꾸지 않는다", () => {
  test("대조 전후로 카드의 상태·근거가 그대로다", () => {
    const c = card("x", "exception");
    const before = JSON.stringify(c);
    compareDay0(c, answers({ x: "agree" }));
    summarizeDay0([c], answers({ x: "agree" }));
    expect(JSON.stringify(c)).toBe(before);
  });
});

describe("요약 한 줄", () => {
  test("짐작과 같은 것 / 다른 것을 센다 (모르겠어요·확인 중은 빼고)", () => {
    const cards = [
      card("a", "confirmed"),
      card("b", "exception"),
      card("c", "confirmed"),
      card("d", "collecting"),
      card("e", "neutral"),
    ];
    const s = summarizeDay0(
      cards,
      answers({ a: "agree", b: "agree", c: "disagree", d: "agree", e: "unsure" })
    );
    expect(s.compared).toBe(3);
    expect(s.matched).toBe(1);
    expect(s.line).toBe("첫날 짐작한 3가지를 기록으로 확인해 보니, 1가지가 짐작대로였어요.");
  });

  test("전부 같거나 전부 다르면 그렇게 말한다", () => {
    const cards = [card("a", "confirmed"), card("b", "confirmed")];
    expect(summarizeDay0(cards, answers({ a: "agree", b: "agree" })).line).toBe(
      "첫날 짐작한 2가지를 기록으로 확인해 보니, 전부 짐작대로였어요."
    );
    expect(summarizeDay0(cards, answers({ a: "disagree", b: "disagree" })).line).toBe(
      "첫날 짐작한 2가지를 기록으로 확인해 보니, 전부 짐작과 다르게 나왔어요."
    );
  });

  test("대조할 카드가 1장 이하면 말하지 않는다", () => {
    expect(summarizeDay0([card("a", "confirmed")], answers({ a: "agree" })).line).toBeNull();
    expect(summarizeDay0([card("a", "confirmed")], null).line).toBeNull();
  });
});

describe("말 규칙", () => {
  test("어느 경우에도 '틀렸'이라는 말이 없다", () => {
    const statuses: HypothesisStatus[] = ["confirmed", "exception", "neutral", "collecting"];
    const guesses: Day0Guess[] = ["agree", "disagree", "unsure"];
    for (const s of statuses) {
      for (const g of guesses) {
        const c = compareDay0(card("x", s), answers({ x: g }));
        expect(`${c.chip ?? ""} ${c.sentence ?? ""}`).not.toMatch(/틀렸|틀린|오답/);
      }
    }
  });
});
