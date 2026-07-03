import {
  BRANCHES,
  BRANCH_META,
  STEMS,
  STEM_META,
  type Element,
  type YinYang,
} from "./constants";

export type StemHanja = typeof STEMS[number];
export type BranchHanja = typeof BRANCHES[number];
export type HiddenStemRole = "residual" | "middle" | "main";
export type HiddenStemProfile = "koreanStandardThreeStage";
export type TenGod =
  | "비견"
  | "겁재"
  | "식신"
  | "상관"
  | "편재"
  | "정재"
  | "편관"
  | "정관"
  | "편인"
  | "정인";

export const HIDDEN_STEM_ROLE_KO: Record<HiddenStemRole, "여기" | "중기" | "정기"> = {
  residual: "여기",
  middle: "중기",
  main: "정기",
} as const;

export type HiddenStem = {
  stem: StemHanja;
  stemKo: string;
  role: HiddenStemRole;
  roleKo: "여기" | "중기" | "정기";
  element: Element;
  yinYang: YinYang;
  order: number;
};

export type HiddenStemWithTenGod = HiddenStem & {
  tenGod: TenGod | null;
};

export type PillarInput = {
  stem: {
    hanja: string;
  };
  branch: {
    hanja: string;
  };
  ganji: string;
};

export type FourPillarsInput = {
  year: PillarInput;
  month: PillarInput;
  day: PillarInput;
  hour: PillarInput | null;
};

export type HiddenStemByPillar = {
  pillar: "year" | "month" | "day" | "hour";
  pillarKo: "년지" | "월지" | "일지" | "시지";
  branch: BranchHanja;
  branchKo: string;
  hiddenStems: HiddenStemWithTenGod[];
};

export type HiddenStemResult = {
  profile: HiddenStemProfile;
  items: HiddenStemByPillar[];
  debug: {
    profile: HiddenStemProfile;
    ruleSummary: string;
    warnings: string[];
  };
};

export const BRANCH_KO: Record<BranchHanja, string> = {
  子: "자",
  丑: "축",
  寅: "인",
  卯: "묘",
  辰: "진",
  巳: "사",
  午: "오",
  未: "미",
  申: "신",
  酉: "유",
  戌: "술",
  亥: "해",
} as const;

const ELEMENT_GENERATES: Record<Element, Element> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
} as const;

const ELEMENT_CONTROLS: Record<Element, Element> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
} as const;

function isStemHanja(value: string): value is StemHanja {
  return STEMS.includes(value as StemHanja);
}

function isBranchHanja(value: string): value is BranchHanja {
  return BRANCHES.includes(value as BranchHanja);
}

function makeHiddenStem(
  stem: StemHanja,
  role: HiddenStemRole,
  order: number
): HiddenStem {
  const meta = STEM_META[stem];

  if (!meta) {
    throw new Error(`Invalid hidden stem: ${stem}`);
  }

  return {
    stem,
    stemKo: meta.ko,
    role,
    roleKo: HIDDEN_STEM_ROLE_KO[role],
    element: meta.element,
    yinYang: meta.yinYang,
    order,
  };
}

export const HIDDEN_STEMS_BY_BRANCH: Record<BranchHanja, HiddenStem[]> = {
  子: [
    makeHiddenStem("壬", "residual", 1),
    makeHiddenStem("癸", "main", 3),
  ],
  丑: [
    makeHiddenStem("癸", "residual", 1),
    makeHiddenStem("辛", "middle", 2),
    makeHiddenStem("己", "main", 3),
  ],
  寅: [
    makeHiddenStem("戊", "residual", 1),
    makeHiddenStem("丙", "middle", 2),
    makeHiddenStem("甲", "main", 3),
  ],
  卯: [
    makeHiddenStem("甲", "residual", 1),
    makeHiddenStem("乙", "main", 3),
  ],
  辰: [
    makeHiddenStem("乙", "residual", 1),
    makeHiddenStem("癸", "middle", 2),
    makeHiddenStem("戊", "main", 3),
  ],
  巳: [
    makeHiddenStem("戊", "residual", 1),
    makeHiddenStem("庚", "middle", 2),
    makeHiddenStem("丙", "main", 3),
  ],
  午: [
    makeHiddenStem("丙", "residual", 1),
    makeHiddenStem("己", "middle", 2),
    makeHiddenStem("丁", "main", 3),
  ],
  未: [
    makeHiddenStem("丁", "residual", 1),
    makeHiddenStem("乙", "middle", 2),
    makeHiddenStem("己", "main", 3),
  ],
  申: [
    makeHiddenStem("戊", "residual", 1),
    makeHiddenStem("壬", "middle", 2),
    makeHiddenStem("庚", "main", 3),
  ],
  酉: [
    makeHiddenStem("庚", "residual", 1),
    makeHiddenStem("辛", "main", 3),
  ],
  戌: [
    makeHiddenStem("辛", "residual", 1),
    makeHiddenStem("丁", "middle", 2),
    makeHiddenStem("戊", "main", 3),
  ],
  亥: [
    makeHiddenStem("戊", "residual", 1),
    makeHiddenStem("甲", "middle", 2),
    makeHiddenStem("壬", "main", 3),
  ],
};

export function getHiddenStemsByBranch(branch: string): HiddenStem[] {
  if (!isBranchHanja(branch)) {
    throw new Error(
      "올바르지 않은 지지입니다. 지지는 子, 丑, 寅, 卯, 辰, 巳, 午, 未, 申, 酉, 戌, 亥 중 하나여야 합니다."
    );
  }

  const hiddenStems = HIDDEN_STEMS_BY_BRANCH[branch];

  if (!hiddenStems) {
    throw new Error(`Missing hidden stem constants for branch: ${branch}`);
  }

  return hiddenStems;
}

export function getTenGod(dayStem: StemHanja, targetStem: StemHanja): TenGod {
  const day = STEM_META[dayStem];
  const target = STEM_META[targetStem];

  if (!day) {
    throw new Error(`Invalid day stem for ten god calculation: ${dayStem}`);
  }

  if (!target) {
    throw new Error(`Invalid target stem for ten god calculation: ${targetStem}`);
  }

  const sameYinYang = day.yinYang === target.yinYang;

  if (day.element === target.element) {
    return sameYinYang ? "비견" : "겁재";
  }

  if (ELEMENT_GENERATES[day.element] === target.element) {
    return sameYinYang ? "식신" : "상관";
  }

  if (ELEMENT_CONTROLS[day.element] === target.element) {
    return sameYinYang ? "편재" : "정재";
  }

  if (ELEMENT_CONTROLS[target.element] === day.element) {
    return sameYinYang ? "편관" : "정관";
  }

  if (ELEMENT_GENERATES[target.element] === day.element) {
    return sameYinYang ? "편인" : "정인";
  }

  throw new Error(`Cannot calculate ten god: ${dayStem} -> ${targetStem}`);
}

export function calculateHiddenStems(
  pillars: FourPillarsInput
): HiddenStemResult {
  const entries = [
    { key: "year", label: "년지", pillar: pillars.year },
    { key: "month", label: "월지", pillar: pillars.month },
    { key: "day", label: "일지", pillar: pillars.day },
    { key: "hour", label: "시지", pillar: pillars.hour },
  ] as const;
  const dayStem = pillars.day.stem.hanja;
  const validDayStem = isStemHanja(dayStem) ? dayStem : null;

  if (!validDayStem) {
    throw new Error(`Invalid day stem for hidden stem ten god calculation: ${dayStem}`);
  }

  const items: HiddenStemByPillar[] = entries.flatMap((entry) => {
      if (entry.pillar === null) {
        return [];
      }

      const branch = entry.pillar.branch.hanja;

      if (!isBranchHanja(branch)) {
        throw new Error(`Invalid branch in ${entry.key} pillar: ${branch}`);
      }

      const branchMeta = BRANCH_META[branch];
      if (!branchMeta) {
        throw new Error(`Missing branch metadata: ${branch}`);
      }

      return {
        pillar: entry.key,
        pillarKo: entry.label,
        branch,
        branchKo: BRANCH_KO[branch],
        hiddenStems: getHiddenStemsByBranch(branch).map((hiddenStem) => ({
          ...hiddenStem,
          tenGod: getTenGod(validDayStem, hiddenStem.stem),
        })),
      };
    });

  return {
    profile: "koreanStandardThreeStage",
    items,
    debug: {
      profile: "koreanStandardThreeStage",
      ruleSummary:
        "지지별 지장간을 여기·중기·정기 기준으로 분류한 koreanStandardThreeStage 표를 사용했습니다.",
      warnings: [
        "지장간 표기는 유파와 교재에 따라 일부 차이가 있을 수 있습니다.",
        "이 프로젝트는 子·卯·酉에도 여기를 표시하고, 午는 丙·己·丁으로 표시하는 표준을 사용합니다.",
        "십성은 지장간 자체의 속성이 아니라 일간 기준으로 본 지장간의 관계입니다.",
      ],
    },
  };
}
