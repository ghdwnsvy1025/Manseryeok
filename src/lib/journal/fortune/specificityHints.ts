/**
 * 오늘의 운세 구체화 힌트 — 원국·오늘 글자에서 LLM이 쓸 생활 장면/부위 경향만 압축.
 * 진단·확정이 아니라 "그 사람에게 닿을 수 있는 결"용.
 */
import type { SajuProfile } from "@/lib/diary/types";
import { STEM_META, BRANCH_META, type Element } from "@/lib/saju/constants";
import type { NatalDayInsight } from "@/lib/journal/fortune/natalDaySignal";
import { TEN_GOD_PLAIN } from "@/lib/journal/fortune/natalDaySignal";

const ELEMENT_KO: Record<Element, string> = {
  wood: "목",
  fire: "화",
  earth: "토",
  metal: "금",
  water: "수",
};

/** sajubase 오행↔신체 요약 (생활어) */
const ELEMENT_BODY: Record<
  Element,
  { organsPlain: string; carePlain: string }
> = {
  wood: {
    organsPlain: "목·어깨·척추·근육·간·담 쪽",
    carePlain: "무리한 스트레칭·장시간 고정 자세를 줄이고 흐름을 풀어 주세요",
  },
  fire: {
    organsPlain: "가슴·심장 박동감·눈·열감·혈압 들뜸 쪽",
    carePlain: "과자극·야식·늦은 화면을 줄이고 숨을 고르는 틈을 두세요",
  },
  earth: {
    organsPlain: "위·소화·피부 트러블·더부룩함 쪽",
    carePlain: "식사 리듬을 단순하게 두고 급하게 먹지 마세요",
  },
  metal: {
    organsPlain: "호흡·목·기관지·대장·건조함 쪽",
    carePlain: "환기·수분·말하기 과부하를 조절해 주세요",
  },
  water: {
    organsPlain: "수면·허리·하체·신장·방광·정신 소모 쪽",
    carePlain: "수면 시간과 수분·과로한 밤 작업을 먼저 지켜 주세요",
  },
};

const DOMAIN_SCENE: Record<
  string,
  { whenTension: string; whenSupport: string }
> = {
  overall: {
    whenTension: "선택이 겹치거나 속도가 빨라질 때 중심이 흔들리기 쉬운 결",
    whenSupport: "작은 결정을 밀고 나가기 좋은 결",
  },
  work: {
    whenTension: "회의·마감·피드백이 몰릴 때 말이 길어지거나 판단이 흔들리기 쉬운 결",
    whenSupport: "한 가지 업무를 끊어내기 좋은 결",
  },
  relationships: {
    whenTension: "부탁·조율·눈치 보는 대화에서 소모가 커지기 쉬운 결",
    whenSupport: "짧은 확인 한 번으로 관계가 풀리기 쉬운 결",
  },
  love: {
    whenTension: "기대와 온도 차가 드러날 때 말이 날카로워지기 쉬운 결",
    whenSupport: "솔직한 한 문장이 닿기 쉬운 결",
  },
  money: {
    whenTension: "충동 결제·비교 소비·불확실한 약속에서 새기 쉬운 결",
    whenSupport: "고정비·할 일 목록을 정리하기 좋은 결",
  },
  health: {
    whenTension: "수면·식사·움직임이 깨질 때 약한 부위가 먼저 신호 나기 쉬운 결",
    whenSupport: "리듬을 단순하게 가져가면 회복이 붙기 쉬운 결",
  },
};

function countElements(
  profile: SajuProfile | null | undefined
): Partial<Record<Element, number>> {
  const counts: Partial<Record<Element, number>> = {};
  if (!profile?.pillars) return counts;
  const add = (el: Element | null | undefined) => {
    if (!el) return;
    counts[el] = (counts[el] ?? 0) + 1;
  };
  for (const key of ["year", "month", "day", "hour"] as const) {
    const p = profile.pillars[key];
    if (!p) continue;
    add(STEM_META[p.stemHanja]?.element);
    add(BRANCH_META[p.branchHanja]?.element);
  }
  return counts;
}

function weakestElements(
  counts: Partial<Record<Element, number>>
): Element[] {
  const all: Element[] = ["wood", "fire", "earth", "metal", "water"];
  const scored = all.map((el) => ({ el, n: counts[el] ?? 0 }));
  const min = Math.min(...scored.map((s) => s.n));
  return scored.filter((s) => s.n === min).map((s) => s.el);
}

function strongestElements(
  counts: Partial<Record<Element, number>>
): Element[] {
  const all: Element[] = ["wood", "fire", "earth", "metal", "water"];
  const scored = all.map((el) => ({ el, n: counts[el] ?? 0 }));
  const max = Math.max(...scored.map((s) => s.n));
  if (max <= 0) return [];
  return scored.filter((s) => s.n === max).map((s) => s.el);
}

export type FortuneSpecificityHints = {
  version: string;
  dayMasterElement: string | null;
  weakElements: string[];
  strongElements: string[];
  /** 건강: 그 사람 기준 먼저 볼 부위 경향 (진단 아님) */
  healthFocus: Array<{
    elementKo: string;
    organsPlain: string;
    carePlain: string;
    whyPlain: string;
  }>;
  /** 영역별 장면 힌트 */
  domainScenes: Record<
    string,
    { scenePlain: string; rationalePlain: string }
  >;
  writingRules: string[];
};

export function buildFortuneSpecificityHints(
  natalDay: NatalDayInsight | null,
  sajuProfile: SajuProfile | null | undefined
): FortuneSpecificityHints {
  const counts = countElements(sajuProfile);
  const weak = weakestElements(counts);
  const strong = strongestElements(counts);
  const dayStem = sajuProfile?.pillars?.day?.stemHanja;
  const dayEl = dayStem ? STEM_META[dayStem]?.element ?? null : null;

  const healthFocus = (weak.length ? weak : strong.slice(0, 1)).map((el) => {
    const body = ELEMENT_BODY[el];
    const why =
      weak.includes(el)
        ? `원국에서 ${ELEMENT_KO[el]} 기운이 상대적으로 옅어, 과로·리듬 붕괴 때 이 쪽이 먼저 예민해질 수 있음`
        : `원국에서 ${ELEMENT_KO[el]} 기운이 두드러져, 과하면 이 쪽이 과열·소모로 드러날 수 있음`;
    return {
      elementKo: ELEMENT_KO[el],
      organsPlain: body.organsPlain,
      carePlain: body.carePlain,
      whyPlain: why,
    };
  });

  // 오늘 촉발이 건강 영역에 긴장/지지면 그 장면 우선
  const healthSig = natalDay?.byDomain?.health;
  if (healthSig?.todayPlain?.[0] && healthFocus[0]) {
    healthFocus[0] = {
      ...healthFocus[0],
      whyPlain: `${healthFocus[0].whyPlain}. 오늘은 ${healthSig.todayPlain[0]} 결이 닿음`,
    };
  }

  const domainScenes: FortuneSpecificityHints["domainScenes"] = {};
  for (const [domain, scenes] of Object.entries(DOMAIN_SCENE)) {
    const sig = natalDay?.byDomain?.[domain as keyof typeof natalDay.byDomain];
    const tension = sig?.tensionKind === "tension";
    const scenePlain = tension ? scenes.whenTension : scenes.whenSupport;
    const god =
      sig?.todayStemGod && TEN_GOD_PLAIN[sig.todayStemGod]
        ? TEN_GOD_PLAIN[sig.todayStemGod]
        : natalDay?.todayStemGod
          ? TEN_GOD_PLAIN[natalDay.todayStemGod]
          : null;
    const rationalePlain = [
      natalDay?.ganjiKo ? `오늘 ${natalDay.ganjiKo}` : null,
      god ? `촉발: ${god}` : null,
      sig?.tensionPlain ? sig.tensionPlain.slice(0, 80) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    domainScenes[domain] = {
      scenePlain,
      rationalePlain: rationalePlain || "원국×오늘 글자 결",
    };
  }

  return {
    version: "fortune-specificity-v1",
    dayMasterElement: dayEl ? ELEMENT_KO[dayEl] : null,
    weakElements: weak.map((e) => ELEMENT_KO[e]),
    strongElements: strong.map((e) => ELEMENT_KO[e]),
    healthFocus,
    domainScenes,
    writingRules: [
      "각 영역 interpretation 안에 생활 장면(예시) 1개를 넣되, 문장 전체를 예시로 채우지 말 것.",
      "핵심 1곳에만 근거 힌트를 생활어로 반 줄 정도 붙일 것. 십신·용신·격국 용어 금지.",
      "건강은 질병명·진단 금지. healthFocus의 부위 경향 + carePlain을 그 사람 기준으로 말할 것.",
      "막연한 '안 좋다/좋다' 대신 무엇이 어떻게 드러날 수 있는지 말할 것.",
      "확정 예언 금지. '~할 수 있다', '~쪽 신호' 표현.",
    ],
  };
}
