/**
 * 용신(用神) 판정.
 *
 * 사장님이 정한 규칙 (2026-09-11). 명리 판단이라 임의로 바꾸지 않는다.
 *
 *   1. 이 사람 원국에서 **가장 많은 오행**을 찾는다.
 *   2. 그 오행을 **극(克)하는 오행**이 용신 오행이다.
 *   3. 그 오행에 해당하는 간지가 **T존**에 있으면 → 그 간지가 용신.
 *   4. T존에 없으면 → 그 오행에 해당하는 **모든 간지**가 용신.
 *
 * T존 = **시간(時干) · 일지(日支) · 월간(月干)** 세 자리.
 * 사주 표에 놓고 보면 가로 두 끝과 그 사이 아래 한 칸이라 T자가 된다.
 *
 *      시   일   월   년
 *      ─────────────────
 *      時干 日干 月干 年干     ← 시간, 월간
 *           日支            ← 일지
 *
 * 오행을 세는 방법 —
 * `elementDistribution.ts` 의 원국 분포율을 그대로 쓴다. 사주 원국 화면이 보여주는
 * 바로 그 숫자다. 가설 엔진(`natalSummary`)은 여덟 자리를 한 개씩 세는 다른 방식이라
 * 답이 달라진다. **용신은 화면에 보이는 숫자와 같은 근거에서 나와야 한다.**
 */
import {
  BRANCH_META,
  STEM_META,
  type Element,
} from "./constants";
import {
  ELEMENT_EN_TO_KO,
  ELEMENT_KO_TO_EN,
  ELEMENT_ORDER,
  calculateElementDistribution,
  type ElementKo,
  type ElementVector,
} from "./elementDistribution";

/** A를 극하는 오행 (elementDistribution 의 controls 를 뒤집은 것) */
const CONTROLLED_BY: Record<ElementKo, ElementKo> = {
  토: "목", // 목극토
  금: "화", // 화극금
  수: "토", // 토극수
  목: "금", // 금극목
  화: "수", // 수극화
};

/** T존의 세 자리 */
export const T_ZONE_SLOTS = ["시간", "일지", "월간"] as const;
export type TZoneSlot = (typeof T_ZONE_SLOTS)[number];

export type YongsinGanji = {
  /** 한자 — 辛, 寅 … */
  hanja: string;
  /** 한글 — 신, 인 … */
  ko: string;
  kind: "stem" | "branch";
  /** 원국의 어느 자리인가 — 원국에 없으면 null */
  slot: TZoneSlot | "그 밖" | null;
};

export type YongsinResult = {
  /** 원국에서 가장 많은 오행 */
  dominant: ElementKo;
  dominantPercent: number;
  /** 그것을 극하는 오행 = 용신 오행 */
  element: ElementKo;
  /** 용신으로 확정된 간지들 */
  ganji: YongsinGanji[];
  /**
   * 어디서 나왔나.
   * "tzone" = T존에서 찾음 (더 구체적)
   * "all"   = T존에 없어서 그 오행의 모든 간지
   */
  source: "tzone" | "all";
  /**
   * 가장 많은 오행이 동률이라 임의로 갈랐는가.
   * 사장님은 "그럴 수 없다"고 했지만 계산상 0.0001 차이도 동률로 보일 수 있어
   * 순서(목화토금수)로 정하고 여기 표시만 남긴다.
   */
  tieBroken: boolean;
  /** 화면에 그대로 보여줄 수 있는 원국 오행 분포 (%) */
  distribution: ElementVector;
};

/** 용신 계산에 필요한 최소 입력 — 한글 간지 */
export type YongsinPillars = {
  year: { stemKo: string; branchKo: string };
  month: { stemKo: string; branchKo: string };
  day: { stemKo: string; branchKo: string };
  hour?: { stemKo: string; branchKo: string } | null;
};

/** 오행별 천간 (한자) */
const STEMS_BY_ELEMENT: Record<Element, string[]> = {
  wood: [],
  fire: [],
  earth: [],
  metal: [],
  water: [],
};
for (const [hanja, meta] of Object.entries(STEM_META)) {
  STEMS_BY_ELEMENT[meta.element].push(hanja);
}

/** 오행별 지지 (한자) */
const BRANCHES_BY_ELEMENT: Record<Element, string[]> = {
  wood: [],
  fire: [],
  earth: [],
  metal: [],
  water: [],
};
for (const [hanja, meta] of Object.entries(BRANCH_META)) {
  BRANCHES_BY_ELEMENT[meta.element].push(hanja);
}

const STEM_KO_TO_HANJA = new Map<string, string>();
for (const [hanja, meta] of Object.entries(STEM_META)) {
  STEM_KO_TO_HANJA.set(meta.ko, hanja);
}
const BRANCH_KO_TO_HANJA = new Map<string, string>();
for (const [hanja, meta] of Object.entries(BRANCH_META)) {
  BRANCH_KO_TO_HANJA.set(meta.ko, hanja);
}

/**
 * 가장 많은 오행.
 * 동률이면 목→화→토→금→수 순서로 앞엣것을 고른다.
 * (사장님: "그럴 수가 없어. 만약 그러면 임의로 하나를 조금 더 높여서 구해줘")
 */
function pickDominant(percentage: ElementVector): {
  element: ElementKo;
  percent: number;
  tieBroken: boolean;
} {
  let best: ElementKo = ELEMENT_ORDER[0]!;
  let bestValue = percentage[best];
  let tied = false;

  for (const el of ELEMENT_ORDER.slice(1)) {
    const value = percentage[el];
    // 소수점 오차를 동률로 보지 않도록 여유를 둔다
    if (value > bestValue + 1e-9) {
      best = el;
      bestValue = value;
      tied = false;
    } else if (Math.abs(value - bestValue) <= 1e-9) {
      tied = true;
    }
  }

  return { element: best, percent: bestValue, tieBroken: tied };
}

/** 원국 여덟 자리를 T존 표시와 함께 펼친다 */
function layout(pillars: YongsinPillars): {
  stems: string;
  branches: string;
  slotOf: Map<string, TZoneSlot | "그 밖">;
} {
  // elementDistribution 은 시 → 일 → 월 → 년 순서를 받는다
  const order: Array<{
    key: "hour" | "day" | "month" | "year";
    p: { stemKo: string; branchKo: string } | null | undefined;
  }> = [
    { key: "hour", p: pillars.hour },
    { key: "day", p: pillars.day },
    { key: "month", p: pillars.month },
    { key: "year", p: pillars.year },
  ];

  let stems = "";
  let branches = "";
  const slotOf = new Map<string, TZoneSlot | "그 밖">();

  const mark = (hanja: string | undefined, slot: TZoneSlot | "그 밖") => {
    if (!hanja) return;
    // T존이 "그 밖"에 덮이지 않게 한다
    const prev = slotOf.get(hanja);
    if (prev && prev !== "그 밖") return;
    slotOf.set(hanja, slot);
  };

  for (const { key, p } of order) {
    if (!p) continue;
    stems += p.stemKo;
    branches += p.branchKo;

    const stemHanja = STEM_KO_TO_HANJA.get(p.stemKo);
    const branchHanja = BRANCH_KO_TO_HANJA.get(p.branchKo);

    mark(stemHanja, key === "hour" ? "시간" : key === "month" ? "월간" : "그 밖");
    mark(branchHanja, key === "day" ? "일지" : "그 밖");
  }

  return { stems, branches, slotOf };
}

/**
 * 용신을 구한다.
 * 원국이 모자라거나 계산이 안 되면 null — 부르는 쪽에서 이 기능만 건너뛴다.
 */
export function findYongsin(pillars: YongsinPillars): YongsinResult | null {
  let distribution: ElementVector;
  let slotOf: Map<string, TZoneSlot | "그 밖">;

  try {
    const { stems, branches, slotOf: slots } = layout(pillars);
    if (stems.length === 0) return null;
    const result = calculateElementDistribution(stems, branches);
    distribution = result.originalPercentage;
    slotOf = slots;
  } catch {
    return null;
  }

  const dominant = pickDominant(distribution);
  const element = CONTROLLED_BY[dominant.element];
  const elementEn = ELEMENT_KO_TO_EN[element];

  const candidates: YongsinGanji[] = [
    ...STEMS_BY_ELEMENT[elementEn].map((hanja) => ({
      hanja,
      ko: STEM_META[hanja]!.ko,
      kind: "stem" as const,
      slot: slotOf.get(hanja) ?? null,
    })),
    ...BRANCHES_BY_ELEMENT[elementEn].map((hanja) => ({
      hanja,
      ko: BRANCH_META[hanja]!.ko,
      kind: "branch" as const,
      slot: slotOf.get(hanja) ?? null,
    })),
  ];

  const inTZone = candidates.filter(
    (c) => c.slot !== null && c.slot !== "그 밖"
  );

  return {
    dominant: dominant.element,
    dominantPercent: Math.round(dominant.percent * 10) / 10,
    element,
    ganji: inTZone.length > 0 ? inTZone : candidates,
    source: inTZone.length > 0 ? "tzone" : "all",
    tieBroken: dominant.tieBroken,
    distribution,
  };
}

/**
 * 사람이 읽을 한 줄.
 *
 * 오행 이름 뒤에 조사를 바로 붙이면 "나무(木)이" 처럼 틀린다(나무는 받침이 없다).
 * 그래서 항상 **"기운이"** 를 사이에 둔다 — 기운은 받침이 있어 조사가 하나로 고정된다.
 */
export function yongsinPlainLine(result: YongsinResult): string {
  const word: Record<ElementKo, string> = {
    목: "나무(木)",
    화: "불(火)",
    토: "흙(土)",
    금: "쇠(金)",
    수: "물(水)",
  };
  return `${word[result.dominant]} 기운이 가장 많아요. 그걸 눌러 주는 ${word[result.element]} 기운이 용신이에요`;
}

/** 오행 한글 ↔ 영문이 필요할 때 */
export { ELEMENT_EN_TO_KO, ELEMENT_KO_TO_EN };
