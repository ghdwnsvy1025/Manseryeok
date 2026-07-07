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

describe("지지 실제 가중합", () => {
  const branches = ["미", "축", "술", "해"];
  const branchBase = branches.map(getBranchBaseDistribution);

  test("미 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(0, branchBase),
      vec(0.3, 0.2, 0.6, 0.06, 0.04)
    );
  });

  test("축 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(1, branchBase),
      vec(0.06, 0.1, 0.7, 0.34, 0.2)
    );
  });

  test("술 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(2, branchBase),
      vec(0.06, 0.3, 0.64, 0.26, 0.14)
    );
  });

  test("해 위치", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(3, branchBase),
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

describe("calculateElementDistribution 통합 테스트", () => {
  test('천간 "신기병을", 지지 "미축술해"', () => {
    const result = calculateElementDistribution("신기병을", "미축술해");

    expectVecCloseTo(result.detail.branchTotal, vec(0.72, 0.66, 2.24, 0.7, 0.88));
    expectVecCloseTo(result.detail.stemTotal, vec(0.55, 0.33, 0.75, 0.36, 0));
    expect(result.detail.stemScores[0]).toBeCloseTo(0.36, 10);
    expect(result.detail.stemScores[1]).toBeCloseTo(0.75, 10);
    expect(result.detail.stemScores[2]).toBeCloseTo(0.33, 10);
    expect(result.detail.stemScores[3]).toBeCloseTo(0.55, 10);

    expectVecCloseTo(result.raw, vec(1.27, 0.99, 2.99, 1.06, 0.88));

    const sum =
      result.raw.목 + result.raw.화 + result.raw.토 + result.raw.금 + result.raw.수;
    expect(sum).toBeCloseTo(7.19, 10);

    expect(result.percentage).toEqual(vec(17.66, 13.77, 41.59, 14.74, 12.24));
  });
});
