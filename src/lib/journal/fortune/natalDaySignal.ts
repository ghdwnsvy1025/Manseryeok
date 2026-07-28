/**
 * 원국 특징 × 오늘 일진(간지) 신호
 * — 콜드스타트 운세의 주 입력. 기록이 쌓이면 score/LLM에서 blend로 비중을 줄인다.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { STEMS, BRANCHES } from "@/lib/saju/constants";
import {
  getHiddenStemsByBranch,
  getTenGod,
  type StemHanja,
  type BranchHanja,
  type TenGod,
} from "@/lib/saju/hiddenStems";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import type { FortuneDomainCode } from "@/lib/journal/insight/types";
import type { KeywordCode } from "@/lib/journal/keywords/catalog";

export const NATAL_DAY_SIGNAL_VERSION = "natal-day-signal-v1.0.0";

const ALL_GODS: TenGod[] = [
  "비견",
  "겁재",
  "식신",
  "상관",
  "편재",
  "정재",
  "편관",
  "정관",
  "편인",
  "정인",
];

/** 십신 → 쉬운 말 (사용자 노출·LLM 힌트) */
export const TEN_GOD_PLAIN: Record<TenGod, string> = {
  비견: "나와 비슷한 기운·동료·자기주장",
  겁재: "경쟁·나누기·속도",
  식신: "표현·창작·여유롭게 만들기",
  상관: "날카로운 표현·반발·예민함",
  편재: "기회·이동·유연한 자원",
  정재: "안정된 성취·현실 관리·책임",
  편관: "압박·도전·긴장 속 실행",
  정관: "역할·평가·질서·신뢰",
  편인: "직감·아이디어·배움의 갈래",
  정인: "보호·학습·회복·근본을 쌓기",
};

type GodFamily = "peer" | "output" | "wealth" | "officer" | "resource";

const GOD_FAMILY: Record<TenGod, GodFamily> = {
  비견: "peer",
  겁재: "peer",
  식신: "output",
  상관: "output",
  편재: "wealth",
  정재: "wealth",
  편관: "officer",
  정관: "officer",
  편인: "resource",
  정인: "resource",
};

/** 영역별 원국에서 볼 십신 가족 */
const DOMAIN_FAMILIES: Record<FortuneDomainCode, GodFamily[]> = {
  overall: ["peer", "output", "wealth", "officer", "resource"],
  work: ["wealth", "officer", "output", "resource"],
  relationship: ["peer", "officer", "output", "resource"],
  finance: ["wealth", "peer", "officer"],
  health: ["resource", "peer", "output"],
};

/** 영역 × 가족 → 키워드 코드 */
const FAMILY_KEYWORD: Record<GodFamily, KeywordCode[]> = {
  peer: ["relation", "conflict", "freedom"],
  output: ["expression", "focus", "growth"],
  wealth: ["money", "work", "decision"],
  officer: ["responsibility", "recognition", "work"],
  resource: ["recovery", "growth", "stability", "rest"],
};

const FAMILY_PLAIN: Record<GodFamily, string> = {
  peer: "관계·자기 경계",
  output: "표현·실행",
  wealth: "성취·자원",
  officer: "역할·규율",
  resource: "배움·회복·근본",
};

export type DomainNatalDaySignal = {
  domain: FortuneDomainCode;
  /** 원국에서 이 영역에 강한 십신 */
  natalGods: TenGod[];
  natalPlain: string[];
  /** 오늘 천간 십신 */
  todayStemGod: TenGod | null;
  /** 오늘 지지 지장간 십신 */
  todayBranchGods: TenGod[];
  todayPlain: string[];
  relationLabels: string[];
  /** 긴장/조화 코드 */
  tensionKind: "support" | "tension" | "neutral";
  /** 쉬운 말 긴장 설명 (전문용어 최소화) */
  tensionPlain: string;
  /** UI·점수용 키워드 */
  keywordCodes: KeywordCode[];
  keywordLabels: string[];
  /** 0~1 사주 기반 영역 점수 */
  natalScore: number;
};

export type NatalDayInsight = {
  version: string;
  dayMasterHanja: string | null;
  ganjiKo: string;
  todayStemGod: TenGod | null;
  todayBranchGods: TenGod[];
  relationLabels: string[];
  natalCounts: Partial<Record<TenGod, number>>;
  /** 원국 상위 십신 */
  natalDominant: TenGod[];
  overallTraitPlain: string;
  byDomain: Record<FortuneDomainCode, DomainNatalDaySignal>;
};

function emptyCounts(): Record<TenGod, number> {
  return Object.fromEntries(ALL_GODS.map((g) => [g, 0])) as Record<
    TenGod,
    number
  >;
}

function isStem(h: string): h is StemHanja {
  return (STEMS as readonly string[]).includes(h);
}

function isBranch(h: string): h is BranchHanja {
  return (BRANCHES as readonly string[]).includes(h);
}

function safeTenGod(day: StemHanja, target: string): TenGod | null {
  if (!isStem(target)) return null;
  try {
    return getTenGod(day, target);
  } catch {
    return null;
  }
}

/** 원국 천간(+지지 정기) 십신 강도 */
export function countNatalTenGods(
  profile: SajuProfile
): Record<TenGod, number> {
  const counts = emptyCounts();
  const dayStem = profile.pillars.day.stemHanja;
  if (!isStem(dayStem)) return counts;

  const stemTargets = [
    profile.pillars.year.stemHanja,
    profile.pillars.month.stemHanja,
    profile.pillars.hour?.stemHanja,
  ];
  for (const s of stemTargets) {
    if (!s || s === dayStem) continue;
    const g = safeTenGod(dayStem, s);
    if (g) counts[g] += 1;
  }

  const pillars = [
    profile.pillars.year,
    profile.pillars.month,
    profile.pillars.day,
    profile.pillars.hour,
  ];
  for (const p of pillars) {
    if (!p?.branchHanja || !isBranch(p.branchHanja)) continue;
    try {
      const hidden = getHiddenStemsByBranch(p.branchHanja);
      const main = hidden.find((h) => h.role === "main") ?? hidden[0];
      if (!main) continue;
      const g = safeTenGod(dayStem, main.stem);
      if (g) counts[g] += 0.6;
    } catch {
      /* ignore */
    }
  }
  return counts;
}

function topGods(
  counts: Record<TenGod, number>,
  n: number,
  familyFilter?: GodFamily[]
): TenGod[] {
  return ALL_GODS.filter((g) => {
    if ((counts[g] ?? 0) <= 0) return false;
    if (!familyFilter) return true;
    return familyFilter.includes(GOD_FAMILY[g]);
  })
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, n);
}

function familiesOf(gods: TenGod[]): Set<GodFamily> {
  return new Set(gods.map((g) => GOD_FAMILY[g]));
}

function tensionBetween(
  natalFamilies: Set<GodFamily>,
  todayFamilies: Set<GodFamily>
): {
  kind: "support" | "tension" | "neutral";
  plain: string;
  score: number;
} {
  if (natalFamilies.size === 0 || todayFamilies.size === 0) {
    return {
      kind: "neutral",
      plain: "원국과 오늘의 흐름이 뚜렷한 충돌 없이 이어집니다.",
      score: 0.52,
    };
  }

  // 같은 가족이 겹치면 지지·강화
  const overlap = [...natalFamilies].filter((f) => todayFamilies.has(f));
  if (overlap.length > 0) {
    const label = overlap.map((f) => FAMILY_PLAIN[f]).join("·");
    return {
      kind: "support",
      plain: `원래 강한 ${label} 성향이 오늘 흐름과 맞물려, 그 방향으로 힘이 모이기 쉽습니다.`,
      score: 0.66,
    };
  }

  // 고전적 긴장 쌍
  const pairs: Array<[GodFamily, GodFamily, string, number]> = [
    [
      "wealth",
      "resource",
      "빨리 이루고 싶은 마음과, 참으며 근본을 쌓는 기운이 만납니다. 오늘은 서두르기보다 한 걸음씩 쌓는 편이 성취에 유리합니다.",
      0.4,
    ],
    [
      "resource",
      "wealth",
      "배우며 회복하려는 바탕 위에, 성과·자원에 대한 자극이 옵니다. 기초를 지키며 기회를 고르면 좋습니다.",
      0.44,
    ],
    [
      "output",
      "officer",
      "자유롭게 표현·실행하고 싶은 기운과, 역할·평가의 틀이 부딪칩니다. 속도보다 기준을 맞추면 결과가 안정됩니다.",
      0.4,
    ],
    [
      "officer",
      "output",
      "책임·질서를 중시하는 성향에, 표현·추진의 자극이 옵니다. 말은 짧게, 실행은 한 가지에 모으세요.",
      0.45,
    ],
    [
      "peer",
      "officer",
      "자기주장·동료 기운과 역할·규율의 기운이 교차합니다. 경계는 지키되 협력의 여지를 남겨 두세요.",
      0.42,
    ],
    [
      "wealth",
      "peer",
      "성취·자원 욕구와 경쟁·나누기의 기운이 겹칩니다. 욕심을 나누면 오히려 흐름이 트일 수 있습니다.",
      0.41,
    ],
    [
      "resource",
      "output",
      "회복·학습의 바탕에 표현·활동 자극이 옵니다. 무리한 출력보다 리듬 있는 실행이 좋습니다.",
      0.46,
    ],
  ];

  for (const [a, b, plain, score] of pairs) {
    if (natalFamilies.has(a) && todayFamilies.has(b)) {
      return { kind: "tension", plain, score };
    }
  }

  const natalL = [...natalFamilies].map((f) => FAMILY_PLAIN[f]).join("·");
  const todayL = [...todayFamilies].map((f) => FAMILY_PLAIN[f]).join("·");
  return {
    kind: "neutral",
    plain: `원국의 ${natalL} 성향 위에, 오늘의 ${todayL} 흐름이 겹칩니다. 어느 한쪽으로 치우치지 않는 중간 속도가 유리합니다.`,
    score: 0.5,
  };
}

function keywordCodesFor(
  natalGods: TenGod[],
  todayGods: TenGod[],
  kind: "support" | "tension" | "neutral"
): KeywordCode[] {
  const codes: KeywordCode[] = [];
  const push = (list: KeywordCode[]) => {
    for (const c of list) {
      if (!codes.includes(c)) codes.push(c);
    }
  };
  for (const g of natalGods) push(FAMILY_KEYWORD[GOD_FAMILY[g]]);
  for (const g of todayGods) push(FAMILY_KEYWORD[GOD_FAMILY[g]]);
  if (kind === "tension") {
    push(["stability", "decision", "recovery"]);
  }
  return codes.slice(0, 4);
}

const LABEL_BY_CODE: Record<KeywordCode, string> = {
  relation: "관계",
  work: "일·성과",
  money: "돈·자원",
  health: "몸·컨디션",
  recovery: "회복",
  expression: "표현",
  decision: "선택·결정",
  conflict: "갈등",
  growth: "성장",
  stability: "안정",
  change: "변화",
  rest: "휴식",
  focus: "집중",
  recognition: "인정",
  responsibility: "책임",
  freedom: "자유",
};

function buildDomainSignal(
  domain: FortuneDomainCode,
  counts: Record<TenGod, number>,
  todayStemGod: TenGod | null,
  todayBranchGods: TenGod[],
  relationLabels: string[]
): DomainNatalDaySignal {
  const families = DOMAIN_FAMILIES[domain];
  const natalGods = topGods(counts, 2, families);
  const todayGods = [
    ...(todayStemGod ? [todayStemGod] : []),
    ...todayBranchGods,
  ].filter((g, i, arr) => arr.indexOf(g) === i);

  const todayRelevant = todayGods.filter((g) =>
    families.includes(GOD_FAMILY[g])
  );
  const todayForTension =
    todayRelevant.length > 0 ? todayRelevant : todayGods.slice(0, 2);

  const { kind, plain, score } = tensionBetween(
    familiesOf(natalGods),
    familiesOf(todayForTension)
  );

  // 합은 소폭 가산, 충·형은 소폭 감산
  let adj = 0;
  if (relationLabels.some((l) => l.includes("합"))) adj += 0.04;
  if (relationLabels.some((l) => /충|형|파|해/.test(l))) adj -= 0.05;
  const natalScore = Math.max(0.15, Math.min(0.9, score + adj));

  const keywordCodes = keywordCodesFor(natalGods, todayForTension, kind);
  return {
    domain,
    natalGods,
    natalPlain: natalGods.map((g) => TEN_GOD_PLAIN[g]),
    todayStemGod,
    todayBranchGods,
    todayPlain: todayForTension.map((g) => TEN_GOD_PLAIN[g]),
    relationLabels,
    tensionKind: kind,
    tensionPlain: plain,
    keywordCodes,
    keywordLabels: keywordCodes.map((c) => LABEL_BY_CODE[c]),
    natalScore: Math.round(natalScore * 100) / 100,
  };
}

/**
 * 프로필 + 날짜 → 원국×일진 영역 신호.
 * 프로필이 없거나 일간이 없으면 null.
 */
export function buildNatalDayInsight(
  eventDate: string,
  sajuProfile?: SajuProfile | null
): NatalDayInsight | null {
  if (!sajuProfile?.pillars?.day?.stemHanja) return null;
  const dayStem = sajuProfile.pillars.day.stemHanja;
  if (!isStem(dayStem)) return null;

  const { dayPillar } = getPillarsForDate(eventDate);
  const todayStem = dayPillar.stem.hanja;
  const todayBranch = dayPillar.branch.hanja;

  const todayStemGod = isStem(todayStem)
    ? safeTenGod(dayStem, todayStem)
    : null;

  const todayBranchGods: TenGod[] = [];
  if (isBranch(todayBranch)) {
    try {
      const hidden = getHiddenStemsByBranch(todayBranch);
      for (const h of hidden) {
        const g = safeTenGod(dayStem, h.stem);
        if (g && !todayBranchGods.includes(g)) todayBranchGods.push(g);
      }
    } catch {
      /* ignore */
    }
  }

  const relationLabels: string[] = [];
  if (sajuProfile.pillars.day.branchHanja) {
    const rels = detectDayRelations({
      natalStemHanja: dayStem,
      natalBranchHanja: sajuProfile.pillars.day.branchHanja,
      todayStemHanja: todayStem,
      todayBranchHanja: todayBranch,
    });
    for (const r of rels) relationLabels.push(r.label);
  }

  const counts = countNatalTenGods(sajuProfile);
  const natalDominant = topGods(counts, 3);
  const overallTraitPlain =
    natalDominant.length > 0
      ? `이 사주는 ${natalDominant
          .map((g) => TEN_GOD_PLAIN[g])
          .join(", ")} 쪽이 비교적 두드러집니다.`
      : "원국의 뚜렷한 편중이 크지 않은 편입니다.";

  const domains: FortuneDomainCode[] = [
    "overall",
    "work",
    "relationship",
    "finance",
    "health",
  ];
  const byDomain = {} as Record<FortuneDomainCode, DomainNatalDaySignal>;
  for (const d of domains) {
    byDomain[d] = buildDomainSignal(
      d,
      counts,
      todayStemGod,
      todayBranchGods,
      relationLabels
    );
  }

  // 종합은 지배 성향 × 오늘 전체
  byDomain.overall = {
    ...byDomain.overall,
    natalGods: natalDominant,
    natalPlain: natalDominant.map((g) => TEN_GOD_PLAIN[g]),
    tensionPlain: `${overallTraitPlain} 오늘은 ${dayPillar.ganjiKo} 흐름(${
      todayStemGod ? TEN_GOD_PLAIN[todayStemGod] : "균형"
    })과 만나 ${byDomain.overall.tensionPlain}`,
  };

  return {
    version: NATAL_DAY_SIGNAL_VERSION,
    dayMasterHanja: dayStem,
    ganjiKo: dayPillar.ganjiKo,
    todayStemGod,
    todayBranchGods,
    relationLabels,
    natalCounts: Object.fromEntries(
      ALL_GODS.filter((g) => (counts[g] ?? 0) > 0).map((g) => [
        g,
        Math.round((counts[g] ?? 0) * 10) / 10,
      ])
    ),
    natalDominant,
    overallTraitPlain,
    byDomain,
  };
}
