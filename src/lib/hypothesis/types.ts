/**
 * 가설 카드 시스템 — 타입
 *
 * 컨셉: 사주는 "당신은 이럴 겁니다"라고 말한다. 이 시스템은 그 말을
 * 검증 가능한 문장으로 쪼갠 뒤, 사용자의 실제 기록으로 확인한다.
 *
 * 가설 = [사주가 정의하는 날의 조건] × [체크인이 측정하는 지표] × [예측 방향]
 */
import type { TenGod } from "@/lib/saju/hiddenStems";
import type { Element } from "@/lib/saju/constants";

export const HYPOTHESIS_VERSION = "hypothesis-v1.0.0";

// ────────────────────────────────────────────────
// 측정 지표 — 체크인이 실제로 기록하는 것만
// ────────────────────────────────────────────────

/** 행복도(0~10) + 핵심 4 + 조건부 영역 5 */
export type MetricCode =
  | "happiness"
  | "energy"
  | "focus_execution"
  | "physical_condition"
  | "emotional_balance"
  | "recovery_sleep"
  | "work_study"
  | "relationship"
  | "finance_resource"
  | "change_opportunity";

export type MetricMeta = {
  code: MetricCode;
  label: string;
  /** 1~5 서열 지표인지, 0~10 행복도인지 */
  scale: "ordinal5" | "happiness10";
  /** 매일 기록되는지(핵심) — 조건부 영역은 표본이 느리게 쌓인다 */
  daily: boolean;
  /**
   * 카드 목록에 쓸 한마디.
   *
   * "맞았습니다 / 당신은 달랐습니다"는 **사주가 주어**인 말이라
   * 사용자가 궁금한 것("그래서 이런 날 나는 어떤데?")에 답하지 못한다.
   * 그래서 상태 대신 **사용자에게 실제로 일어난 일**을 적는다.
   */
  up: string;
  down: string;
  /**
   * 위 문구를 문장 중간에 이어 붙일 때 쓰는 꼴 ("~고").
   *
   * 왜 손으로 적나 —
   * 처음엔 `요` 를 `고` 로 바꾸는 규칙 하나로 만들었다가 "마음이 편해요"가
   * **"마음이 편해고"** 로 나갔다. 한국어 축약(해요=하+여요, 가벼워요=가볍+어요)은
   * 규칙 하나로 못 되돌린다. 스무 개뿐이니 적어 두고, 새 지표를 넣으면
   * 타입이 막아 준다. 조용히 틀리는 것보다 낫다.
   */
  upConn: string;
  downConn: string;
};

export const METRICS: Record<MetricCode, MetricMeta> = {
  happiness: {
    code: "happiness", label: "행복도", scale: "happiness10", daily: true,
    up: "기분이 좋아요", down: "기분이 가라앉아요",
    upConn: "기분이 좋고", downConn: "기분이 가라앉고",
  },
  energy: {
    code: "energy", label: "에너지·활력", scale: "ordinal5", daily: true,
    up: "힘이 나요", down: "쉽게 지쳐요",
    upConn: "힘이 나고", downConn: "쉽게 지치고",
  },
  focus_execution: {
    code: "focus_execution", label: "집중·실행", scale: "ordinal5", daily: true,
    up: "집중이 잘 돼요", down: "집중이 잘 안 돼요",
    upConn: "집중이 잘 되고", downConn: "집중이 잘 안 되고",
  },
  physical_condition: {
    code: "physical_condition", label: "몸 상태", scale: "ordinal5", daily: true,
    up: "몸이 가벼워요", down: "몸이 무거워요",
    upConn: "몸이 가볍고", downConn: "몸이 무겁고",
  },
  emotional_balance: {
    code: "emotional_balance", label: "마음의 여유", scale: "ordinal5", daily: true,
    up: "마음이 편해요", down: "마음이 좁아져요",
    upConn: "마음이 편하고", downConn: "마음이 좁아지고",
  },
  recovery_sleep: {
    code: "recovery_sleep", label: "수면·회복", scale: "ordinal5", daily: false,
    up: "잘 쉬어져요", down: "잘 못 쉬어요",
    upConn: "잘 쉬어지고", downConn: "잘 못 쉬고",
  },
  work_study: {
    code: "work_study", label: "일·학업", scale: "ordinal5", daily: false,
    up: "일이 잘 풀려요", down: "일이 잘 안 풀려요",
    upConn: "일이 잘 풀리고", downConn: "일이 잘 안 풀리고",
  },
  relationship: {
    code: "relationship", label: "관계·연애", scale: "ordinal5", daily: false,
    up: "사람이 편해요", down: "사람이 불편해요",
    upConn: "사람이 편하고", downConn: "사람이 불편하고",
  },
  finance_resource: {
    code: "finance_resource", label: "돈·자원", scale: "ordinal5", daily: false,
    up: "씀씀이가 잡혀요", down: "돈이 새요",
    upConn: "씀씀이가 잡히고", downConn: "돈이 새고",
  },
  change_opportunity: {
    code: "change_opportunity", label: "변화·기회", scale: "ordinal5", daily: false,
    up: "일이 움직여요", down: "일이 멈춰요",
    upConn: "일이 움직이고", downConn: "일이 멈추고",
  },
};

// ────────────────────────────────────────────────
// 날의 조건 — 그날이 가설의 대상인지 판정
// ────────────────────────────────────────────────

/** 십신 5가족 — 사용자에게는 쉬운 말로만 노출한다 */
export type GodFamily = "peer" | "output" | "wealth" | "officer" | "resource";

export const GOD_FAMILY_OF: Record<TenGod, GodFamily> = {
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

/** 사용자에게 보여줄 날의 이름 — 전문용어 없이 */
export const FAMILY_DAY_LABEL: Record<GodFamily, string> = {
  peer: "나와 같은 기운이 겹치는 날",
  output: "표현하고 싶어지는 날",
  wealth: "성취·자원의 기운이 오는 날",
  officer: "역할·평가의 기운이 오는 날",
  resource: "배움·회복의 기운이 오는 날",
};

export const FAMILY_TERM: Record<GodFamily, string> = {
  peer: "비겁",
  output: "식상",
  wealth: "재성",
  officer: "관성",
  resource: "인성",
};

export type RelationKind = "chung" | "hap" | "hyeong" | "pa" | "hae";

export const RELATION_DAY_LABEL: Record<RelationKind, string> = {
  chung: "부딪치는 날",
  hap: "맞물리는 날",
  hyeong: "엉키는 날",
  pa: "틀어지는 날",
  hae: "어긋나는 날",
};

export const RELATION_TERM: Record<RelationKind, string> = {
  chung: "충(沖)",
  hap: "합(合)",
  hyeong: "형(刑)",
  pa: "파(破)",
  hae: "해(害)",
};

/** 그날이 조건에 해당하는지 판정하는 규칙 */
export type DayCondition =
  /** 일진 천간의 십신이 이 가족인 날 */
  | { kind: "stem_family"; family: GodFamily }
  /** 일진 지지(지장간 정기)의 십신이 이 가족인 날 */
  | { kind: "branch_family"; family: GodFamily }
  /** 천간·지지 어느 쪽이든 이 가족이 오는 날 */
  | { kind: "any_family"; family: GodFamily }
  /** 원국과 일진 사이에 이 관계가 생기는 날 */
  | { kind: "relation"; relation: RelationKind }
  /** 일진의 오행이 원국에서 부족한/과다한 오행일 때 */
  | { kind: "element"; element: Element }
  /**
   * 그날 일주에 이 사람의 용신 간지가 오는 날.
   * 용신은 `saju/yongsin.ts` 가 정한다 (가장 많은 오행을 극하는 오행 → T존 우선).
   */
  | { kind: "yongsin" };

// ────────────────────────────────────────────────
// 원국 요약 — 가설을 뽑을 때 참조
// ────────────────────────────────────────────────

export type NatalSummary = {
  /** 일간 */
  dayMaster: string;
  dayMasterKo: string;
  dayMasterElement: Element;
  /** 원국 십신 개수 (천간 + 지장간) */
  godCounts: Record<TenGod, number>;
  /** 십신 가족별 합계 */
  familyCounts: Record<GodFamily, number>;
  /** 오행 분포 (0~1 정규화) */
  elementRatio: Record<Element, number>;
  /** 원국에서 가장 부족한 오행 */
  weakestElement: Element;
  /** 원국에서 가장 강한 오행 */
  strongestElement: Element;
  /**
   * 최저 비율인 오행이 둘 이상인가.
   * 동률이면 "가장 적다"고 단정할 수 없다 — 문구를 낮춰야 한다.
   */
  weakestIsTied: boolean;
  /** 최고 비율인 오행이 둘 이상인가 */
  strongestIsTied: boolean;
  /**
   * 용신 — 못 구하면 null.
   *
   * 주의: 여기 오행 비율은 위의 `elementRatio` 와 **다른 계산**이다.
   * 위는 여덟 자리를 한 개씩 세고, 용신은 지장간까지 가중한 사주 원국 화면의 숫자를 쓴다.
   * 섞어 쓰면 안 되고, 화면에서도 한 번에 하나만 말한다.
   */
  yongsin: NatalYongsin | null;
};

/** 가설 엔진이 쓰는 용신 요약 (saju/yongsin.ts 결과를 줄인 것) */
export type NatalYongsin = {
  /** 용신 오행 — "목" 처럼 한글 한 글자 */
  elementKo: string;
  /** 가장 많았던 오행 */
  dominantKo: string;
  dominantPercent: number;
  /** 용신 간지 (한자) — 이 중 하나가 그날 일주에 오면 용신일 */
  ganjiHanja: string[];
  /** T존에서 찾았는가 */
  fromTZone: boolean;
};

/** 가설이 이 사람에게 적용될 조건 */
export type NatalRequirement =
  | { kind: "always" }
  /** 이 가족의 십신이 원국에 min개 이상 */
  | { kind: "family_min"; family: GodFamily; min: number }
  /** 이 가족의 십신이 원국에 max개 이하 (부족해서 생기는 패턴) */
  | { kind: "family_max"; family: GodFamily; max: number }
  /** 특정 오행이 원국에서 가장 부족 */
  | { kind: "element_weakest" }
  /** 특정 오행이 원국에서 가장 강함 */
  | { kind: "element_strongest" }
  /** 용신을 구할 수 있는 원국일 것 */
  | { kind: "yongsin_exists" };

// ────────────────────────────────────────────────
// 가설 규칙
// ────────────────────────────────────────────────

export type HypothesisRule = {
  id: string;
  /** 카드 상단 짧은 이름 */
  title: string;
  condition: DayCondition;
  metric: MetricCode;
  /** 조건에 해당하는 날, 지표가 평소보다 높다/낮다 */
  direction: "higher" | "lower";
  requires: NatalRequirement;
  /** 선택 우선순위 — 높을수록 먼저 뽑힌다 */
  weight: number;
  copy: {
    /** Day 0에 던지는 예측 문장 */
    claim: string;
    /** 사주 근거 (전문용어 허용) */
    basis: string;
    /** 방향이 맞았을 때 */
    confirmed: string;
    /** 방향이 반대였을 때 — "틀림"이 아니라 "당신은 달랐다" */
    exception: string;
    /** 차이가 미미했을 때 */
    neutral: string;
  };
};

// ────────────────────────────────────────────────
// 검증 결과
// ────────────────────────────────────────────────

export type HypothesisStatus =
  /** 표본 부족 — 아직 판단하지 않는다 */
  | "collecting"
  /** 이론대로 나왔다 */
  | "confirmed"
  /** 이론과 반대로 나왔다 — 이 사람만의 예외 */
  | "exception"
  /** 유의미한 차이가 없었다 — 이 축은 이 사람에게 영향이 적다 */
  | "neutral";

export type HypothesisEvidence = {
  /** 조건에 해당한 날의 수 */
  matchedDays: number;
  /** 해당하지 않은 날의 수 */
  unmatchedDays: number;
  /** 조건일 평균 */
  matchedMean: number | null;
  /** 비조건일 평균 */
  unmatchedMean: number | null;
  /** matchedMean - unmatchedMean */
  gap: number | null;
  /** 판정에 필요한 최소 조건일 수 */
  needMatched: number;
  /** 판정에 필요한 최소 비조건일 수 */
  needUnmatched: number;
};

export type HypothesisCard = {
  rule: HypothesisRule;
  status: HypothesisStatus;
  evidence: HypothesisEvidence;
  /** 화면에 그대로 쓸 수 있는 문장 */
  headline: string;
  /** 진행 표시용 0~1 */
  progress: number;
};

// ────────────────────────────────────────────────
// 하루치 입력
// ────────────────────────────────────────────────

/** 하루의 사주 사실 — 조건 판정에 쓰인다 */
export type DayFacts = {
  date: string;
  /** 일진 천간 십신 */
  stemGod: TenGod | null;
  /** 일진 지지 정기 십신 */
  branchGod: TenGod | null;
  /** 원국과 오늘 사이에 생긴 관계 */
  relations: RelationKind[];
  /** 일진 천간의 오행 */
  stemElement: Element | null;
  /** 일진 지지의 오행 */
  branchElement: Element | null;
  /** 이 날 일주에 용신 간지가 들어왔는가 */
  isYongsin: boolean;
};

/** 하루의 기록 — 검증 대상 */
export type DayRecord = {
  date: string;
  /** 지표별 값. 기록하지 않은 지표는 없음 */
  metrics: Partial<Record<MetricCode, number>>;
};
