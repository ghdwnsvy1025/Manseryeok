import { describe, expect, test } from "@jest/globals";
import {
  assessTextQuality,
  computeTextAlpha,
  fuseTextAndUserScore,
  MAX_TEXT_ALPHA,
  MIN_TEXT_CHARS,
  TEXT_ALPHA_VERSION,
} from "@/lib/journal/textAlphaFusion";
import { buildCategoryScoreRecords } from "@/lib/journal/buildScores";

/** 실제 일기에 가까운 변화 있는 장문 */
const LONG = [
  "아침부터 회의가 세 개나 잡혀서 정신이 하나도 없었다.",
  "점심은 근처 국숫집에서 혼자 먹었는데 국물이 생각보다 짰다.",
  "오후에는 다음 분기 기획서를 붙잡고 씨름했지만 방향이 잘 잡히지 않았다.",
  "퇴근길 지하철에서 예전에 듣던 노래를 다시 들었더니 기분이 조금 풀렸다.",
  "집에 와서 설거지를 미뤄둔 걸 보고 한숨이 나왔지만 그래도 정리하고 씻었다.",
  "내일은 조금 일찍 일어나서 산책이라도 해볼 생각이다.",
].join(" ");
/** 중간 길이 */
const MEDIUM = "오늘은 조금 지쳤지만 그래도 할 일은 마쳤다.";
const SHORT = "피곤함";

describe("free-text quality assessment", () => {
  test("empty and whitespace-only text has zero quality", () => {
    expect(assessTextQuality("").quality).toBe(0);
    expect(assessTextQuality("   \n\t ").quality).toBe(0);
    expect(assessTextQuality(null).quality).toBe(0);
    expect(assessTextQuality(undefined).quality).toBe(0);
  });

  test("text under the minimum length has zero quality", () => {
    expect(assessTextQuality(SHORT).effectiveLength).toBeLessThan(
      MIN_TEXT_CHARS
    );
    expect(assessTextQuality(SHORT).quality).toBe(0);
  });

  test("repeated filler characters are treated as no information", () => {
    const filler = "ㅋ".repeat(300);
    const q = assessTextQuality(filler);
    expect(q.effectiveLength).toBe(300);
    expect(q.diversity).toBeLessThan(0.15);
    expect(q.quality).toBe(0);
  });

  test("longer diverse text has higher quality", () => {
    const short = assessTextQuality(MEDIUM);
    const long = assessTextQuality(LONG);
    expect(long.quality).toBeGreaterThan(short.quality);
    expect(long.quality).toBeLessThanOrEqual(1);
  });

  // 회귀 방지: 고유문자/전체문자 비율을 그대로 쓰면 알파벳 크기에 막혀
  // 잘 쓴 장문이 오히려 "반복"으로 오판된다.
  test("a genuinely long entry is not mistaken for filler", () => {
    const veryLong = `${LONG} ${LONG.split(" ").reverse().join(" ")}`;
    const q = assessTextQuality(veryLong);
    expect(q.effectiveLength).toBeGreaterThan(200);
    expect(q.diversity).toBeGreaterThan(0.5);
    expect(q.quality).toBeGreaterThan(0.8);
  });
});

describe("alpha computation", () => {
  test("no ai score means alpha 0", () => {
    const a = computeTextAlpha({ userScore: 7, aiScore: null, content: LONG });
    expect(a.alpha).toBe(0);
    expect(a.reason).toBe("no_ai_score");
    expect(a.version).toBe(TEXT_ALPHA_VERSION);
  });

  test("no user score means the text is the only evidence", () => {
    const a = computeTextAlpha({ userScore: null, aiScore: 6, content: LONG });
    expect(a.alpha).toBe(1);
    expect(a.reason).toBe("no_user_score");
  });

  test("short text never overrides the user's own rating", () => {
    const a = computeTextAlpha({ userScore: 7, aiScore: 2, content: SHORT });
    expect(a.alpha).toBe(0);
    expect(a.reason).toBe("text_too_short");
  });

  test("alpha never exceeds the cap even with perfect text and confidence", () => {
    const a = computeTextAlpha({
      userScore: 7,
      aiScore: 2,
      aiConfidence: 1,
      content: `${LONG} ${LONG} ${LONG}`,
    });
    expect(a.alpha).toBeLessThanOrEqual(MAX_TEXT_ALPHA);
    expect(a.alpha).toBeGreaterThan(0.4);
  });

  test("alpha scales with ai confidence", () => {
    const low = computeTextAlpha({
      userScore: 7,
      aiScore: 2,
      aiConfidence: 0.2,
      content: LONG,
    });
    const high = computeTextAlpha({
      userScore: 7,
      aiScore: 2,
      aiConfidence: 0.9,
      content: LONG,
    });
    expect(high.alpha).toBeGreaterThan(low.alpha);
  });

  test("alpha scales with text length", () => {
    const medium = computeTextAlpha({
      userScore: 7,
      aiScore: 2,
      aiConfidence: 0.8,
      content: MEDIUM,
    });
    const long = computeTextAlpha({
      userScore: 7,
      aiScore: 2,
      aiConfidence: 0.8,
      content: LONG,
    });
    expect(long.alpha).toBeGreaterThan(medium.alpha);
  });

  test("not applicable yields alpha 0", () => {
    const a = computeTextAlpha({
      userScore: null,
      aiScore: 5,
      content: LONG,
      isNotApplicable: true,
    });
    expect(a.alpha).toBe(0);
    expect(a.reason).toBe("not_applicable");
  });
});

describe("score fusion", () => {
  test("fused score stays between the two inputs and leans to the user", () => {
    const f = fuseTextAndUserScore({
      userScore: 8,
      aiScore: 2,
      aiConfidence: 1,
      content: LONG,
    });
    expect(f.finalScore!).toBeGreaterThan(2);
    expect(f.finalScore!).toBeLessThan(8);
    // 상한 alpha가 0.5이므로 중간값(5) 아래로 내려가지 않는다
    expect(f.finalScore!).toBeGreaterThanOrEqual(5);
  });

  test("short text keeps the user score intact", () => {
    const f = fuseTextAndUserScore({
      userScore: 8,
      aiScore: 2,
      content: SHORT,
    });
    expect(f.finalScore).toBe(8);
    expect(f.alpha).toBe(0);
  });

  test("not applicable is always null even with an ai score", () => {
    const f = fuseTextAndUserScore({
      userScore: null,
      aiScore: 5,
      content: LONG,
      isNotApplicable: true,
    });
    expect(f.finalScore).toBeNull();
  });

  test("only ai score present returns the ai score", () => {
    const f = fuseTextAndUserScore({
      userScore: null,
      aiScore: 5,
      content: LONG,
    });
    expect(f.finalScore).toBe(5);
  });

  test("neither score present returns null", () => {
    const f = fuseTextAndUserScore({
      userScore: null,
      aiScore: null,
      content: LONG,
    });
    expect(f.finalScore).toBeNull();
  });
});

describe("buildCategoryScoreRecords integration", () => {
  const rows = [
    {
      categoryCode: "energy",
      userScore: 8 as const,
      aiScore: 2,
      aiConfidence: 1,
      isNotApplicable: false,
    },
  ];

  test("without content the legacy 50:50 average is preserved", () => {
    const out = buildCategoryScoreRecords({
      entryId: "e1",
      userId: "u",
      now: "2026-07-25T00:00:00Z",
      inputScores: rows,
      previous: [],
    });
    expect(out[0]!.finalScore).toBe(5);
  });

  test("with long content the text is fused but capped", () => {
    const out = buildCategoryScoreRecords({
      entryId: "e1",
      userId: "u",
      now: "2026-07-25T00:00:00Z",
      inputScores: rows,
      previous: [],
      content: LONG,
    });
    expect(out[0]!.finalScore!).toBeGreaterThanOrEqual(5);
    expect(out[0]!.finalScore!).toBeLessThan(8);
  });

  test("with a one-word entry the user score wins", () => {
    const out = buildCategoryScoreRecords({
      entryId: "e1",
      userId: "u",
      now: "2026-07-25T00:00:00Z",
      inputScores: rows,
      previous: [],
      content: SHORT,
    });
    expect(out[0]!.finalScore).toBe(8);
  });
});
