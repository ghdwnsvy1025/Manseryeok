import { describe, expect, test } from "@jest/globals";
import {
  calculateElementDistribution,
  computeBranchWeightedPosition,
  getBranchBaseDistribution,
  stemHelpValue,
} from "@/lib/saju/elementDistribution";

function vec(
  목: number,
  화: number,
  토: number,
  금: number,
  수: number
) {
  return { 목, 화, 토, 금, 수 };
}

function expectVecCloseTo(
  received: ReturnType<typeof vec>,
  expected: ReturnType<typeof vec>,
  precision = 10
) {
  expect(received.목).toBeCloseTo(expected.목, precision);
  expect(received.화).toBeCloseTo(expected.화, precision);
  expect(received.토).toBeCloseTo(expected.토, precision);
  expect(received.금).toBeCloseTo(expected.금, precision);
  expect(received.수).toBeCloseTo(expected.수, precision);
}

const NO_BANGHAP = {
  applied: false,
  groups: [],
  boostedBranches: [],
};

describe("getBranchBaseDistribution", () => {
  test("미 기본 오행 분포", () => {
    expect(getBranchBaseDistribution("미")).toEqual(vec(0.3, 0.2, 0.5, 0, 0));
  });

  test("축 기본 오행 분포", () => {
    expect(getBranchBaseDistribution("축")).toEqual(vec(0, 0, 0.5, 0.3, 0.2));
  });

  test("술 기본 오행 분포", () => {
    expect(getBranchBaseDistribution("술")).toEqual(vec(0, 0.3, 0.5, 0.2, 0));
  });

  test("해 기본 오행 분포", () => {
    expect(getBranchBaseDistribution("해")).toEqual(vec(0.3, 0, 0.2, 0, 0.5));
  });

  test("각 지지 기본 분포 합계는 1", () => {
    const branches = ["미", "축", "술", "해", "자", "인", "묘", "진", "사", "오", "신", "유"];
    for (const b of branches) {
      const d = getBranchBaseDistribution(b);
      const sum = d.목 + d.화 + d.토 + d.금 + d.수;
      expect(sum).toBeCloseTo(1, 10);
    }
  });
});

describe("지지 실제 가중합 (방합 없음)", () => {
  const branches = ["미", "축", "술", "해"];
  const branchBase = branches.map(getBranchBaseDistribution);

  test("미 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(0, branches, branchBase, NO_BANGHAP),
      vec(0.3, 0.2, 0.6, 0.06, 0.04)
    );
  });

  test("축 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(1, branches, branchBase, NO_BANGHAP),
      vec(0.06, 0.1, 0.7, 0.34, 0.2)
    );
  });

  test("술 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(2, branches, branchBase, NO_BANGHAP),
      vec(0.06, 0.3, 0.64, 0.26, 0.14)
    );
  });

  test("해 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(3, branches, branchBase, NO_BANGHAP),
      vec(0.3, 0.06, 0.3, 0.04, 0.5)
    );
  });
});

describe("천간 실제 가중합", () => {
  const branchBase = ["미", "축", "술", "해"].map(getBranchBaseDistribution);

  test("신(金) 도움값", () => {
    const mi = stemHelpValue("신", branchBase[0]);
    const chuk = stemHelpValue("신", branchBase[1]);
    expect(mi).toBeCloseTo(0.25, 10);
    expect(chuk).toBeCloseTo(0.55, 10);
    expect(mi * 1 + chuk * 0.2).toBeCloseTo(0.36, 10);
  });

  test("기(土) 도움값", () => {
    const mi = stemHelpValue("기", branchBase[0]);
    const chuk = stemHelpValue("기", branchBase[1]);
    const sul = stemHelpValue("기", branchBase[2]);
    expect(mi).toBeCloseTo(0.6, 10);
    expect(chuk).toBeCloseTo(0.5, 10);
    expect(sul).toBeCloseTo(0.65, 10);
    expect(mi * 0.2 + chuk * 1 + sul * 0.2).toBeCloseTo(0.75, 10);
  });

  test("병(火) 도움값", () => {
    const chuk = stemHelpValue("병", branchBase[1]);
    const sul = stemHelpValue("병", branchBase[2]);
    const hae = stemHelpValue("병", branchBase[3]);
    expect(chuk * 0.2 + sul * 1 + hae * 0.2).toBeCloseTo(0.33, 10);
  });

  test("을(木) 도움값", () => {
    const sul = stemHelpValue("을", branchBase[2]);
    const hae = stemHelpValue("을", branchBase[3]);
    expect(sul * 0.2 + hae * 1).toBeCloseTo(0.55, 10);
  });
});

describe("calculateElementDistribution 검증 테스트", () => {
  const stems = "신기병을";
  const branches = "미축술해";

  test("테스트 1: 원국만", () => {
    const result = calculateElementDistribution(stems, branches);

    expect(result.detail.banghap.applied).toBe(true);
    expect(result.detail.banghap.boostedBranches).toEqual(
      expect.arrayContaining([
        { branch: "해", multiplier: 1.2 },
        { branch: "축", multiplier: 1.2 },
      ])
    );

    expect(result.detail.stemScores[0].rawScore).toBeCloseTo(0.36, 10);
    expect(result.detail.stemScores[0].minAdjustedScore).toBeCloseTo(0.4, 10);
    expect(result.detail.stemScores[0].finalScore).toBeCloseTo(0.4, 10);

    expect(result.detail.stemScores[1].finalScore).toBeCloseTo(0.75, 10);
    expect(result.detail.stemScores[2].finalScore).toBeCloseTo(0.4, 10);
    expect(result.detail.stemScores[3].finalScore).toBeCloseTo(0.55, 10);

    expectVecCloseTo(result.originalRaw, vec(1.342, 1.06, 3.178, 1.184, 1.056));
    expectVecCloseTo(result.raw, vec(1.342, 1.06, 3.178, 1.184, 1.056));

    const sum =
      result.raw.목 + result.raw.화 + result.raw.토 + result.raw.금 + result.raw.수;
    expect(sum).toBeCloseTo(7.82, 10);

    expect(result.originalPercentage).toEqual(vec(17.16, 13.55, 40.64, 15.14, 13.5));
    expect(result.percentage).toEqual(vec(17.16, 13.55, 40.64, 15.14, 13.5));
    expect(result.detail.daewoon.applied).toBe(false);
  });

  test('테스트 2: 대운 "신오"', () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "신",
      branch: "오",
    });

    expect(result.originalPercentage).toEqual(vec(17.16, 13.55, 40.64, 15.14, 13.5));

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.relation).toBe("branch_controls_stem");
    expect(result.detail.daewoon.stemGanjiMultiplier).toBe(0.75);
    expect(result.detail.daewoon.branchGanjiMultiplier).toBe(1);
    expect(result.detail.daewoon.stemSameCharMultiplier).toBe(1.2);
    expect(result.detail.daewoon.stemFinalMultiplier).toBeCloseTo(0.9, 10);
    expect(result.detail.daewoon.branchBanghapMultiplier).toBe(1.15);
    expect(result.detail.daewoon.branchExternalMultiplier).toBe(1.15);
    expect(result.detail.daewoon.branchFinalMultiplier).toBeCloseTo(1.15, 10);

    expectVecCloseTo(
      result.detail.daewoon.daewoonRaw!,
      vec(0, 0.805, 0.345, 0.9, 0)
    );
    expect(result.detail.daewoon.daewoonPercentage).toEqual(
      vec(0, 39.27, 16.83, 43.9, 0)
    );

    expect(result.percentage).toEqual(vec(12.87, 19.98, 34.69, 22.33, 10.13));
  });

  test("대운 한자 간지 입력도 처리한다", () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "辛",
      branch: "午",
    });

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.stem).toBe("신");
    expect(result.detail.daewoon.branch).toBe("오");
    expect(result.percentage).toEqual(vec(12.87, 19.98, 34.69, 22.33, 10.13));
  });

  test('테스트 3: 대운 "갑축"', () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "갑",
      branch: "축",
    });

    expect(result.originalPercentage).toEqual(vec(17.16, 13.55, 40.64, 15.14, 13.5));

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.relation).toBe("stem_controls_branch");
    expect(result.detail.daewoon.stemFinalMultiplier).toBe(1);
    expect(result.detail.daewoon.branchSameCharMultiplier).toBe(1.2);
    expect(result.detail.daewoon.branchBanghapMultiplier).toBe(1.15);
    expect(result.detail.daewoon.branchExternalMultiplier).toBe(1.2);
    expect(result.detail.daewoon.branchFinalMultiplier).toBeCloseTo(0.9, 10);

    expectVecCloseTo(
      result.detail.daewoon.daewoonRaw!,
      vec(1, 0, 0.45, 0.27, 0.18)
    );
    expect(result.detail.daewoon.daewoonPercentage).toEqual(
      vec(52.63, 0, 23.68, 14.21, 9.47)
    );

    expect(result.percentage).toEqual(vec(26.03, 10.17, 36.4, 14.91, 12.5));
  });
});
