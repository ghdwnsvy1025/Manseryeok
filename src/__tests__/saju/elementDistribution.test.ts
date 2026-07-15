import { describe, expect, test } from "@jest/globals";
import {
  calculateElementDistribution,
  computeBranchWeightedPosition,
  getBranchBaseDistribution,
  getBranchFireWaterElementMultipliers,
  getBranchPeerElementMultipliers,
  getContiguousSameElementGroupSize,
  getGanjiFireWaterMultipliers,
  getPeerInteractionMultipliers,
  getSamhapMatches,
  getSamhapElementMultiplierMap,
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

describe("getBranchBaseDistribution — 토 지지 + 지장간 양/음 보정", () => {
  test("미 기본 오행 분포 (토 지지, 대표 지장간 모두 음 → 기존과 동일)", () => {
    expect(getBranchBaseDistribution("미")).toEqual(vec(0.25, 0.35, 0.4, 0, 0));
  });

  test("축 기본 오행 분포 (토 지지, 대표 지장간 모두 음 → 기존과 동일)", () => {
    expect(getBranchBaseDistribution("축")).toEqual(vec(0, 0, 0.4, 0.25, 0.35));
  });

  test("진 기본 오행 분포 (토 지지, 양/음 보정 후 normalize)", () => {
    expectVecCloseTo(
      getBranchBaseDistribution("진"),
      vec(0.3387096774193548, 0, 0.41935483870967744, 0, 0.24193548387096772)
    );
  });

  test("술 기본 오행 분포 (토 지지, 양/음 보정 후 normalize)", () => {
    expectVecCloseTo(
      getBranchBaseDistribution("술"),
      vec(0, 0.3387096774193548, 0.41935483870967744, 0.24193548387096772, 0)
    );
  });

  test("해 기본 오행 분포 (일반 지장간, 모두 양 → 기존과 동일)", () => {
    expect(getBranchBaseDistribution("해")).toEqual(vec(0.3, 0, 0.2, 0, 0.5));
  });

  test("인 기본 오행 분포 (일반 지장간, 모두 양 → 기존과 동일)", () => {
    expect(getBranchBaseDistribution("인")).toEqual(vec(0.5, 0.3, 0.2, 0, 0));
  });

  test("오 기본 오행 분포 (양/음 혼합 → 보정 후 normalize)", () => {
    expectVecCloseTo(
      getBranchBaseDistribution("오"),
      vec(0, 0.7049180327868853, 0.29508196721311475, 0, 0)
    );
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

describe("삼합 감지 — 거리 보정", () => {
  test("해미 → 해묘미 양끝, span=3 → multiplier 1.044", () => {
    const matches = getSamhapMatches(["미", "축", "술", "해"]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      name: "해묘미",
      element: "목",
      type: "partial_edge_only",
      baseMultiplier: 1.08,
      span: 3,
      distanceFactor: 0.55,
      multiplier: 1.044,
      matchedIndexes: [3, 0],
    });
    expect(matches[0].matchedBranches.sort()).toEqual(["미", "해"]);
  });

  test("해묘 → 가운데 있음, span=1 → multiplier 1.18", () => {
    const matches = getSamhapMatches(["해", "묘"]);
    expect(matches[0]).toMatchObject({
      name: "해묘미",
      type: "partial_with_middle",
      baseMultiplier: 1.18,
      span: 1,
      distanceFactor: 1,
      multiplier: 1.18,
    });
  });

  test("해묘미 완성 — span=2 → distanceFactor 0.75, multiplier 1.2625", () => {
    const matches = getSamhapMatches(["해", "묘", "미"]);
    expect(matches[0].type).toBe("full");
    expect(matches[0].baseMultiplier).toBe(1.35);
    expect(matches[0].span).toBe(2);
    expect(matches[0].distanceFactor).toBe(0.75);
    expect(matches[0].multiplier).toBeCloseTo(1.2625, 10);
  });

  test("삼합 배수 맵 — 해·미의 목에 1.044", () => {
    const { map } = getSamhapElementMultiplierMap(["미", "축", "술", "해"]);
    expect(map["해"].목).toBe(1.044);
    expect(map["미"].목).toBe(1.044);
    expect(map["축"].목).toBe(1);
    expect(map["술"].화).toBe(1);
  });

  test("중복 지지면 span이 가장 작은 조합을 선택", () => {
    const matches = getSamhapMatches(["해", "미", "축", "해"]);
    expect(matches[0]).toMatchObject({
      type: "partial_edge_only",
      span: 1,
      distanceFactor: 1,
      multiplier: 1.08,
      matchedIndexes: [0, 1],
    });
  });
});

describe("원국 peer 생극 보정", () => {
  test("연속 같은 오행 그룹 크기", () => {
    const elements: Array<"화" | "금"> = ["화", "금", "화", "화"];
    expect(getContiguousSameElementGroupSize(elements, 0)).toBe(1);
    expect(getContiguousSameElementGroupSize(elements, 1)).toBe(1);
    expect(getContiguousSameElementGroupSize(elements, 2)).toBe(2);
    expect(getContiguousSameElementGroupSize(elements, 3)).toBe(2);
  });

  test("오유오오 — 유금이 연속 화에 극당해 clamp 0.72", () => {
    const peers = getPeerInteractionMultipliers(["화", "금", "화", "화"]);
    expect(peers[1].rawMultiplier).toBeCloseTo(0.71775, 10);
    expect(peers[1].multiplier).toBe(0.72);
    expect(peers[1].effects).toHaveLength(3);
  });

  test("지지 peer는 지장간 분포 기준으로 오행별 multiplier", () => {
    const bases = ["술", "해"].map(getBranchBaseDistribution);
    const peers = getBranchPeerElementMultipliers(bases);
    // 술의 화 성분은 해의 수에 극당함
    expect(peers[0].화).toBeLessThan(1);
    // 해의 수 성분은 술의 토에 극당함
    expect(peers[1].수).toBeLessThan(1);
    // 단일 대표오행 multiplier가 아님
    expect(peers[0].토).not.toBe(peers[0].화);
  });
});

describe("지지 실제 가중합 (방합·삼합 없음, 지지 양/음 반영)", () => {
  const branches = ["미", "축", "술", "해"];
  const branchBase = branches.map(getBranchBaseDistribution);

  test("미 위치 (음지 0.97)", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(0, branches, branchBase, NO_BANGHAP),
      vec(0.2425, 0.3395, 0.4656, 0.0485, 0.0679)
    );
  });

  test("축 위치 (음지·인접 술 양지 반영)", () => {
    expectVecCloseTo(
      computeBranchWeightedPosition(1, branches, branchBase, NO_BANGHAP),
      vec(0.0485, 0.13767419354838709, 0.5519870967741936, 0.2923387096774194, 0.3395)
    );
  });
});

describe("천간 실제 가중합 (토 지지 + 지장간 양/음 반영)", () => {
  const branchBase = ["미", "축", "술", "해"].map(getBranchBaseDistribution);

  test("신(金) 도움값", () => {
    const mi = stemHelpValue("신", branchBase[0]);
    const chuk = stemHelpValue("신", branchBase[1]);
    expect(mi).toBeCloseTo(0.2, 10);
    expect(chuk).toBeCloseTo(0.45, 10);
  });

  test("기(土) 도움값", () => {
    const mi = stemHelpValue("기", branchBase[0]);
    const chuk = stemHelpValue("기", branchBase[1]);
    const sul = stemHelpValue("기", branchBase[2]);
    expect(mi).toBeCloseTo(0.575, 10);
    expect(chuk).toBeCloseTo(0.4, 10);
    expect(sul).toBeCloseTo(0.5887096774193549, 10);
  });

  test("을(木) 도움값", () => {
    const sul = stemHelpValue("을", branchBase[2]);
    const hae = stemHelpValue("을", branchBase[3]);
    expect(sul * 0.2 + hae * 1).toBeCloseTo(0.55, 10);
  });
});

describe("화수·간지 보정 — 지장간 분포 기준", () => {
  test("테스트 1: 술해 화수 보정", () => {
    const bases = ["술", "해", "축", "미"].map(getBranchBaseDistribution);
    const fw = getBranchFireWaterElementMultipliers(bases);

    expect(bases[0].화).toBeGreaterThan(0);
    expect(bases[1].수).toBeGreaterThan(0);
    expect(fw.applied).toBe(true);
    expect(fw.elementMultipliers[0].화).toBeLessThan(1);
    expect(fw.elementMultipliers[1].수).toBeLessThan(1);
    // 토·금 등 비화수 성분은 화수 보정으로 줄지 않음
    expect(fw.elementMultipliers[0].토).toBe(1);
    expect(fw.elementMultipliers[0].금).toBe(1);
    expect(fw.elementMultipliers[1].목).toBe(1);
    expect(fw.elementMultipliers[1].토).toBe(1);

    const result = calculateElementDistribution("갑갑갑갑", "술해축미");
    expect(result.detail.fireWaterExtreme.branch.mode).toBe("hidden_stem_distribution");
  });

  test("테스트 2: 진해는 화수 충돌이 아니라 수 증가", () => {
    const bases = ["진", "해", "축", "자"].map(getBranchBaseDistribution);
    const fw = getBranchFireWaterElementMultipliers(bases);

    expect(fw.fireTotal).toBeLessThan(0.15);
    expect(fw.applied).toBe(false);
    for (const m of fw.elementMultipliers) {
      expect(m.화).toBe(1);
      expect(m.수).toBe(1);
    }
  });

  test("테스트 3: 사해 화수 보정", () => {
    const bases = ["사", "해", "축", "미"].map(getBranchBaseDistribution);
    const fw = getBranchFireWaterElementMultipliers(bases);

    expect(bases[0].화).toBeGreaterThan(0);
    expect(bases[0].금).toBeGreaterThan(0);
    expect(bases[1].수).toBeGreaterThan(0);
    expect(fw.applied).toBe(true);
    expect(fw.elementMultipliers[0].화).toBeLessThan(1);
    expect(fw.elementMultipliers[1].수).toBeLessThan(1);
    // 사의 금은 화수 보정의 직접 대상이 아님
    expect(fw.elementMultipliers[0].금).toBe(1);
  });

  test("테스트 4: 간지 병해", () => {
    const bases = [getBranchBaseDistribution("해")];
    const ganji = getGanjiFireWaterMultipliers(["병"], ["해"], bases);

    expect(ganji.stemMultipliers[0]).toBe(0.92);
    expect(ganji.branchElementMultipliers[0].수).toBe(0.97);
    expect(ganji.branchElementMultipliers[0].목).toBe(1);
    expect(ganji.branchElementMultipliers[0].토).toBe(1);
  });

  test("테스트 5: 간지 임술", () => {
    const bases = [getBranchBaseDistribution("술")];
    const ganji = getGanjiFireWaterMultipliers(["임"], ["술"], bases);

    expect(ganji.stemMultipliers[0]).toBe(0.97);
    expect(ganji.branchElementMultipliers[0].화).toBe(0.92);
    expect(ganji.branchElementMultipliers[0].토).toBe(1);
    expect(ganji.branchElementMultipliers[0].금).toBe(1);
  });
});

describe("calculateElementDistribution — peer·화수·분포 기준", () => {
  const stems = "신기병을";
  const branches = "미축술해";
  const originalPct = vec(16.94, 15.75, 36.01, 16.56, 14.73);

  test("테스트 1: 원국만 (미축술해)", () => {
    const result = calculateElementDistribution(stems, branches);

    expect(result.detail.earthBranchAdjustment.applied).toBe(true);
    expect(result.detail.earthBranchAdjustment.adjustedBranches.map((b) => b.branch).sort()).toEqual(
      ["미", "술", "축"]
    );

    expect(result.detail.banghap.applied).toBe(true);
    expect(result.detail.banghap.boostedBranches).toEqual(
      expect.arrayContaining([
        { branch: "해", multiplier: 1.2 },
        { branch: "축", multiplier: 1.2 },
      ])
    );

    expect(result.detail.samhap.applied).toBe(true);
    expect(result.detail.samhap.groups).toEqual([
      expect.objectContaining({
        name: "해묘미",
        element: "목",
        type: "partial_edge_only",
        multiplier: 1.044,
      }),
    ]);

    expect(result.detail.stemPeerInteraction.elements).toEqual(["금", "토", "화", "목"]);
    expect(result.detail.stemPeerInteraction.multipliers[0]).toMatchObject({
      stem: "신",
      multiplier: 1.045,
    });
    expect(result.detail.stemPeerInteraction.multipliers[2]).toMatchObject({
      stem: "병",
      multiplier: 1.08,
    });

    expect(result.detail.branchPeerInteraction.mode).toBe("hidden_stem_distribution");
    expect(result.detail.branchPeerInteraction.multipliers[3]).toMatchObject({
      branch: "해",
    });
    expect(result.detail.branchPeerInteraction.multipliers[3].elementMultiplier.수).toBeLessThan(1);
    expect(result.detail.branchPeerInteraction.multipliers[2].baseDistribution.화).toBeGreaterThan(0);

    expect(result.detail.fireWaterExtreme.branch.mode).toBe("hidden_stem_distribution");
    expect(result.detail.fireWaterExtreme.branch.applied).toBe(true);
    expect(result.detail.fireWaterExtreme.branch.multipliers[2].fireMultiplier).toBeLessThan(1);
    expect(result.detail.fireWaterExtreme.branch.multipliers[3].waterMultiplier).toBeLessThan(1);

    expect(result.detail.stemScores[0]).toMatchObject({
      stem: "신",
      polarity: "yin",
      stemPolarityMultiplier: 0.96,
      stemPeerInteractionMultiplier: 1.045,
      stemGanjiFireWaterMultiplier: 1,
    });
    expect(result.detail.stemScores[0].finalScore).toBeCloseTo(0.40128, 5);

    expect(result.detail.stemScores[2]).toMatchObject({
      stem: "병",
      polarity: "yang",
      stemPolarityMultiplier: 1.04,
      stemPeerInteractionMultiplier: 1.08,
    });
    expect(result.detail.stemScores[2].finalScore).toBeCloseTo(0.44928, 5);

    expect(result.detail.branchWeightedDetail[0].contributions[0]).toMatchObject({
      sourceBranch: "미",
      sourceBranchPolarity: "yin",
      branchPolarityMultiplier: 0.97,
    });
    expect(result.detail.branchWeightedDetail[0].contributions[0].branchPeerElementMultiplier).toBeDefined();

    expectVecCloseTo(
      result.detail.branchTotal,
      vec(0.7227157781531612, 0.7063706081419354, 2.006793250709677, 0.8132894916774193, 1.0806229318588345),
      5
    );
    expectVecCloseTo(
      result.detail.stemTotal,
      vec(0.52008, 0.44928, 0.6347667096774193, 0.40128, 0),
      5
    );

    expectVecCloseTo(result.originalPercentage, originalPct, 2);
    expect(result.percentage).toEqual(result.originalPercentage);
    expect(result.detail.daewoon.applied).toBe(false);
  });

  test('테스트 2: 대운 "신오"', () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "신",
      branch: "오",
    });

    expectVecCloseTo(result.originalPercentage, originalPct, 2);

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.influenceRate).toBe(0.5);
    expect(result.detail.daewoon.selfRate).toBe(0.4);
    expect(result.detail.daewoon.pillarInteractionRate).toBe(0.6);
    expect(result.detail.daewoon.relation).toBe("branch_controls_stem");
    expect(result.detail.daewoon.stemFinalMultiplier).toBeCloseTo(0.9, 10);
    expect(result.detail.daewoon.branchFinalMultiplier).toBeCloseTo(1.15, 10);
    expect(result.detail.daewoon.stemPolarityMultiplier).toBe(0.96);
    expect(result.detail.daewoon.branchPolarityMultiplier).toBe(1.03);
    expect(result.detail.daewoon.branchFireWaterElementMultiplier?.화).toBeLessThan(1);

    expect(result.detail.daewoon.pillarInteraction?.byPillar).toHaveLength(4);
    expect(result.detail.daewoon.pillarInteraction?.pillarWeights).toEqual({
      time: 0.25,
      day: 0.25,
      month: 0.25,
      year: 0.25,
    });
    expect(result.detail.daewoon.pillarInteraction?.byPillar[0]).toMatchObject({
      pillar: "time",
      nativeStem: "신",
      nativeStemElement: "금",
      stemRelation: "same_element",
      pillarWeight: 0.25,
    });
    // 대운 지지 오는 지장간 분포로 element별 배수 적용 (대표오행 단일 처리 아님)
    const timeBranchMult =
      result.detail.daewoon.pillarInteraction!.byPillar[0].branchElementMultipliers;
    expect(timeBranchMult.화).not.toBe(timeBranchMult.토);
    expect(timeBranchMult.목).toBeDefined();

    expectVecCloseTo(
      result.detail.daewoon.daewoonSelfRaw!,
      vec(0, 0.901352823760246, 0.3495245901639344, 0.864, 0),
      4
    );

    // final = original*0.50 + daewoonPercentage*0.50
    const dae = result.detail.daewoon.daewoonPercentage!;
    expectVecCloseTo(
      result.percentage,
      vec(
        round2(result.originalPercentage.목 * 0.5 + dae.목 * 0.5),
        round2(result.originalPercentage.화 * 0.5 + dae.화 * 0.5),
        round2(result.originalPercentage.토 * 0.5 + dae.토 * 0.5),
        round2(result.originalPercentage.금 * 0.5 + dae.금 * 0.5),
        round2(result.originalPercentage.수 * 0.5 + dae.수 * 0.5)
      ),
      2
    );
    expect(result.percentage).toEqual(vec(13.41, 21.17, 32.3, 21.39, 11.74));
  });

  test("대운 한자 간지 입력도 처리한다", () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "辛",
      branch: "午",
    });

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.stem).toBe("신");
    expect(result.detail.daewoon.branch).toBe("오");
    expect(result.percentage).toEqual(vec(13.41, 21.17, 32.3, 21.39, 11.74));
  });

  test('테스트 3: 대운 "갑축"', () => {
    const result = calculateElementDistribution(stems, branches, {
      stem: "갑",
      branch: "축",
    });

    expectVecCloseTo(result.originalPercentage, originalPct, 2);

    expect(result.detail.daewoon.applied).toBe(true);
    expect(result.detail.daewoon.influenceRate).toBe(0.5);
    expect(result.detail.daewoon.stemFinalMultiplier).toBe(1);
    expect(result.detail.daewoon.branchFinalMultiplier).toBeCloseTo(0.9, 10);
    expect(result.detail.daewoon.stemPolarityMultiplier).toBe(1.04);
    expect(result.detail.daewoon.branchPolarityMultiplier).toBe(0.97);

    expect(result.detail.daewoon.branchSamhapDetail?.applied).toBe(false);
    expectVecCloseTo(
      result.detail.daewoon.daewoonSelfRaw!,
      vec(1.04, 0, 0.3492, 0.21825, 0.29191483124999995),
      5
    );

    expect(result.percentage).toEqual(vec(24.56, 12.61, 32.39, 15.6, 14.85));
  });
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
