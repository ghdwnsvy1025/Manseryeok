/**
 * 첫날 짐작 ↔ 기록 대조.
 *
 * Day 0 에 사용자는 카드마다 "이런 날, 있으신가요?"에 답했다.
 *   맞아요(agree) · 글쎄요(disagree) · 모르겠어요(unsure)
 * 그 답은 저장만 되고 아무 데서도 안 쓰이고 있었다 (2026-09-15 사장님 지적).
 *
 * 여기서 그 답을 되살린다. 단 `day0Answers.ts` 의 절대 규칙은 지킨다 —
 * **짐작은 판정에 한 번도 들어가지 않는다.** 판정은 기록만으로 끝난 뒤,
 * 끝난 결과 옆에 "첫날 당신은 이렇게 짐작했다"를 나란히 놓을 뿐이다.
 *
 * 그래서 이런 문장이 나온다. 이건 이 앱만 쓸 수 있는 문장이다.
 *   "첫날 '글쎄요'라고 하셨는데, 13일 기록은 맞다고 나왔어요."
 *
 * 말 규칙
 * - "틀렸다"는 쓰지 않는다. 사용자의 짐작에도, 사주에도.
 * - 아직 확인 중인 카드에는 짐작과 같다/다르다를 말하지 않는다.
 *   확정되지 않은 걸 대조하면 확정처럼 보인다.
 * - 짐작이 없는 카드(건너뛴 카드, 첫날 이후 새로 생긴 카드)는 아무 말도 안 한다.
 */
import type { Day0Answers, Day0Guess } from "./day0Answers";
import type { HypothesisCard } from "./types";

export type Day0Verdict =
  /** 짐작과 기록이 같은 쪽 */
  | "match"
  /** 짐작과 기록이 다른 쪽 */
  | "differ"
  /** 첫날엔 모르겠다고 했는데 기록이 답을 냈다 */
  | "found"
  /** 짐작은 있는데 기록이 아직 모자란다 */
  | "waiting"
  /** 짐작이 없다 */
  | "none";

export type Day0Comparison = {
  verdict: Day0Verdict;
  guess: Day0Guess | null;
  /** 목록 한 줄에 붙는 짧은 표시 — 없으면 null */
  chip: string | null;
  /** 카드를 펼쳤을 때 보여줄 한 문장 — 없으면 null */
  sentence: string | null;
};

const GUESS_WORD: Record<Day0Guess, string> = {
  agree: "맞아요",
  disagree: "글쎄요",
  unsure: "모르겠어요",
};

const NONE: Day0Comparison = {
  verdict: "none",
  guess: null,
  chip: null,
  sentence: null,
};

export function compareDay0(
  card: HypothesisCard,
  answers: Day0Answers | null | undefined
): Day0Comparison {
  const guess = answers?.guesses?.[card.rule.id] ?? null;
  if (!guess) return NONE;

  const said = `첫날 '${GUESS_WORD[guess]}'`;

  if (card.status === "collecting") {
    return {
      verdict: "waiting",
      guess,
      // 확인 전에는 목록에 표시하지 않는다 — 결과처럼 보이면 안 된다
      chip: null,
      sentence:
        guess === "unsure"
          ? `${said}였죠. 기록으로 확인하는 중이에요.`
          : `${said}라고 하셨어요. 기록으로 확인하는 중이에요.`,
    };
  }

  const days = `${card.evidence.matchedDays}일`;

  if (guess === "unsure") {
    return {
      verdict: "found",
      guess,
      chip: "기록이 찾았어요",
      sentence: `${said}였죠. ${days} 기록이 답을 찾았어요.`,
    };
  }

  // 카드의 예측 문장은 사주 이론 쪽 방향이다.
  // "맞아요" = 그 방향이 있다고 짐작, "글쎄요" = 없다고 짐작.
  const recordHolds = card.status === "confirmed";

  if (guess === "agree") {
    if (recordHolds) {
      return {
        verdict: "match",
        guess,
        chip: "내 짐작대로",
        sentence: `${said}라고 하셨죠. ${days} 기록도 같았어요.`,
      };
    }
    return {
      verdict: "differ",
      guess,
      chip: "내 짐작과 달라요",
      sentence:
        card.status === "exception"
          ? `${said}라고 하셨는데, ${days} 기록은 반대로 나왔어요.`
          : `${said}라고 하셨는데, ${days} 기록으로는 큰 차이가 없었어요.`,
    };
  }

  // guess === "disagree"
  if (recordHolds) {
    return {
      verdict: "differ",
      guess,
      chip: "내 짐작과 달라요",
      sentence: `${said}라고 하셨는데, ${days} 기록은 맞다고 나왔어요.`,
    };
  }
  return {
    verdict: "match",
    guess,
    chip: "내 짐작대로",
    sentence:
      card.status === "exception"
        ? `${said}라고 하셨죠. ${days} 기록도 사주 예상과 반대였어요.`
        : `${said}라고 하셨죠. ${days} 기록도 큰 차이가 없었어요.`,
  };
}

export type Day0Summary = {
  /** 짐작도 있고 판정도 끝난 카드 수 (모르겠어요 제외) */
  compared: number;
  /** 그중 짐작과 같았던 수 */
  matched: number;
  /** 목록 위에 띄울 한 줄 — 대조할 게 없으면 null */
  line: string | null;
};

/**
 * "첫날 짐작 vs 기록" 한 줄 요약.
 * 대조할 카드가 2장은 돼야 말한다. 1장으로 "1장 중 1장"은 의미가 없다.
 */
export function summarizeDay0(
  cards: HypothesisCard[],
  answers: Day0Answers | null | undefined
): Day0Summary {
  if (!answers) return { compared: 0, matched: 0, line: null };

  let compared = 0;
  let matched = 0;
  for (const card of cards) {
    const c = compareDay0(card, answers);
    if (c.verdict === "match" || c.verdict === "differ") {
      compared += 1;
      if (c.verdict === "match") matched += 1;
    }
  }

  if (compared < 2) return { compared, matched, line: null };

  let tail: string;
  if (matched === compared) tail = "전부 짐작대로였어요.";
  else if (matched === 0) tail = "전부 짐작과 다르게 나왔어요.";
  else tail = `${matched}가지가 짐작대로였어요.`;

  return {
    compared,
    matched,
    line: `첫날 짐작한 ${compared}가지를 기록으로 확인해 보니, ${tail}`,
  };
}
