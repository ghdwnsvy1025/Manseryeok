/**
 * "나" 탭 첫 두 줄 검증.
 *
 * 이 두 줄은 사용자가 자기 자신에 대해 읽는 문장이라, 틀리면 신뢰가 한 번에 깨진다.
 * 특히 두 가지를 막는다 —
 *   1. 동률인데 "가장 많다"고 단정하는 것
 *   2. 조사가 틀리는 것 ("물가 적은" / "나무이 넉넉하고")
 */
import { describe, expect, test } from "@jest/globals";
import type { Element } from "@/lib/saju/constants";
import type { NatalSummary } from "@/lib/hypothesis/types";
import { natalPlainLines } from "@/lib/hypothesis/natalPlain";

function makeNatal(opts: {
  ratio: Record<Element, number>;
  strongest: Element;
  weakest: Element;
  strongestIsTied?: boolean;
  weakestIsTied?: boolean;
  dayMasterElement?: Element;
}): NatalSummary {
  return {
    dayMaster: "己",
    dayMasterKo: "기토",
    dayMasterElement: opts.dayMasterElement ?? "earth",
    godCounts: {} as NatalSummary["godCounts"],
    familyCounts: {} as NatalSummary["familyCounts"],
    elementRatio: opts.ratio,
    weakestElement: opts.weakest,
    strongestElement: opts.strongest,
    yongsin: null,
    weakestIsTied: opts.weakestIsTied ?? false,
    strongestIsTied: opts.strongestIsTied ?? false,
  };
}

const SKEWED = makeNatal({
  ratio: { wood: 0.17, fire: 0.16, earth: 0.36, metal: 0.17, water: 0.14 },
  strongest: "earth",
  weakest: "water",
});

describe("타고난 것", () => {
  test("일간 오행을 한 줄로 말한다", () => {
    expect(natalPlainLines(SKEWED).origin).toBe("흙(土)의 기운을 타고났어요");
  });

  test("다섯 오행 모두 문장이 만들어진다", () => {
    const expected: Record<Element, string> = {
      wood: "나무(木)",
      fire: "불(火)",
      earth: "흙(土)",
      metal: "쇠(金)",
      water: "물(水)",
    };
    for (const el of Object.keys(expected) as Element[]) {
      const line = natalPlainLines(
        makeNatal({
          ratio: { wood: 0.2, fire: 0.2, earth: 0.2, metal: 0.2, water: 0.2 },
          strongest: "earth",
          weakest: "water",
          dayMasterElement: el,
        })
      ).origin;
      expect(line).toContain(expected[el]);
    }
  });
});

describe("기운의 쏠림", () => {
  test("쏠려 있으면 강한 쪽과 약한 쪽을 말한다", () => {
    expect(natalPlainLines(SKEWED).balance).toBe(
      "흙이 넉넉하고, 물이 적은 편이에요"
    );
  });

  test("조사가 받침을 따라간다", () => {
    // 나무 → 가, 물 → 이
    const line = natalPlainLines(
      makeNatal({
        ratio: { wood: 0.36, fire: 0.17, earth: 0.16, metal: 0.17, water: 0.14 },
        strongest: "wood",
        weakest: "water",
      })
    ).balance;
    expect(line).toBe("나무가 넉넉하고, 물이 적은 편이에요");
  });

  test("조사가 틀린 조합이 하나도 없다", () => {
    const els: Element[] = ["wood", "fire", "earth", "metal", "water"];
    const wrong: string[] = [];
    for (const strong of els) {
      for (const weak of els) {
        if (strong === weak) continue;
        const ratio = { wood: 0.2, fire: 0.2, earth: 0.2, metal: 0.2, water: 0.2 };
        ratio[strong] = 0.4;
        ratio[weak] = 0.05;
        const line = natalPlainLines(
          makeNatal({ ratio, strongest: strong, weakest: weak })
        ).balance;
        // 받침 있는 말(흙·불·물) 뒤에 "가", 없는 말(나무·쇠) 뒤에 "이"가 오면 틀린 것
        if (
          /(흙|불|물)가/.test(line) ||
          /(나무|쇠)이/.test(line) ||
          /(흙|불|물)는/.test(line) ||
          /(나무|쇠)은/.test(line)
        ) {
          wrong.push(line);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  test("아예 없는 오행은 '적은 편'이 아니라 '없어요'라고 말한다", () => {
    // 화면 막대가 0%로 비는데 문장이 "적은 편"이면 말과 그림이 어긋난다
    const noWood = makeNatal({
      ratio: { wood: 0, fire: 0.25, earth: 0.25, metal: 0.38, water: 0.12 },
      strongest: "metal",
      weakest: "wood",
    });
    expect(natalPlainLines(noWood).balance).toBe(
      "쇠가 넉넉하고, 나무는 아예 없어요"
    );
  });

  test("차이가 작으면 단정하지 않는다", () => {
    const flat = makeNatal({
      ratio: { wood: 0.2, fire: 0.2, earth: 0.21, metal: 0.2, water: 0.19 },
      strongest: "earth",
      weakest: "water",
    });
    expect(natalPlainLines(flat).balance).toBe("다섯 기운이 고르게 퍼져 있어요");
  });

  test("최고가 동률이면 강한 쪽을 말하지 않는다", () => {
    const tied = makeNatal({
      ratio: { wood: 0.3, fire: 0.3, earth: 0.2, metal: 0.15, water: 0.05 },
      strongest: "wood",
      weakest: "water",
      strongestIsTied: true,
    });
    const line = natalPlainLines(tied).balance;
    expect(line).toBe("물이 적은 편이에요");
    expect(line).not.toContain("넉넉");
  });

  test("최저가 동률이면 약한 쪽을 말하지 않는다", () => {
    const tied = makeNatal({
      ratio: { wood: 0.4, fire: 0.2, earth: 0.2, metal: 0.1, water: 0.1 },
      strongest: "wood",
      weakest: "metal",
      weakestIsTied: true,
    });
    const line = natalPlainLines(tied).balance;
    expect(line).toBe("나무가 넉넉한 편이에요");
    expect(line).not.toContain("적은");
  });

  test("어느 경우에도 '가장'이라고 단정하지 않는다", () => {
    for (const n of [SKEWED]) {
      expect(natalPlainLines(n).balance).not.toContain("가장");
    }
  });
});
