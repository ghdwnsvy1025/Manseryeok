/**
 * 운세 맞춤도 — "당신의 운세는 지금 23% 맞춰졌습니다"
 *
 * 왜 이게 필요한가.
 * 지금 홈은 "레벨이 높아질수록 운세가 더 정확해져요"라고 약속하면서
 * 그 근거로 XP를 보여준다. 그런데 XP는 기록을 하면 오르는 점수일 뿐,
 * 운세를 실제로 정확하게 만드는 것은 **데이터의 양과 다양성**이다.
 * 즉 지금 그 문장은 사실이 아니다.
 *
 * 이 파일은 그 약속을 참말로 만든다. 여기 들어가는 네 축은 전부
 * 운세 개인화에 실제로 쓰이는 재료다.
 *
 *   기록 일수   기본 표본. 없으면 아무것도 못 한다
 *   가설 판정   "이 사람에게 맞는 규칙"이 몇 개나 확정됐는가
 *   간지 수집   60갑자 중 몇 개를 겪어봤는가 (일진별 반응을 알려면 겪어야 한다)
 *   다양성      요일·기분이 한쪽에 몰려 있지 않은가
 *
 * 100%는 도달점이 아니라 "이제 운세가 당신 것"이라는 뜻이다.
 */
import type { HypothesisCard } from "./types";

export const COMPLETION_VERSION = "fortune-fit-v1";

/**
 * 각 축의 만점 기준
 *
 * days 가 120인 이유 — 60이면 간지 축(60갑자)과 사실상 같은 축이 된다.
 * 매일 기록하면 "기록 30일"과 "겪어본 간지 30개"가 항상 같은 값이라,
 * 두 축이 합쳐서 절반이 넘는 가중치를 한 방향으로 밀어 올린다.
 * 실제로 30일에 69%가 나와서 60일 마일스톤이 무의미해졌다.
 * days 를 120으로 늘리면 60일 이후에도 갈 길이 남는다.
 */
export const COMPLETION_TARGETS = {
  /**
   * 이 정도 쌓이면 표본으로 충분하다 (약 5개월).
   * 100%가 60일에 오면, 습관이 막 붙은 시점에 매일의 동기가 사라진다.
   */
  days: 150,
  /** 60갑자 한 바퀴 — 60일 마일스톤과 맞물린다 */
  ganji: 60,
  /** 요일별로 이만큼씩 겪어야 "골고루"로 본다 (약 10주) */
  perWeekday: 10,
  /** 기분 태그를 이만큼 써보면 만점 (전체 13종을 다 쓰는 건 비현실적) */
  moodKinds: 10,
} as const;

/**
 * 축별 가중치 — 합이 1
 *
 * 기록에 가장 큰 가중치를 준다. 이 앱이 사용자에게 요구하는 유일한 행동이고,
 * 나머지 세 축은 전부 기록의 부산물이기 때문이다.
 */
export const COMPLETION_WEIGHTS = {
  days: 0.35,
  hypotheses: 0.25,
  ganji: 0.15,
  variety: 0.25,
} as const;

export type CompletionInput = {
  /** 기록한 날의 수 (중복 없는 날짜 기준) */
  recordedDays: number;
  /** 판정이 끝난 가설 카드 (collecting 은 부분 점수로 들어간다) */
  cards: HypothesisCard[];
  /** 겪어본 간지 수 (0~60) */
  collectedGanji: number;
  /** 기록한 날들의 요일 종류 (0~7) */
  weekdayCoverage: number;
  /** 사용한 기분 태그 종류 */
  moodVariety: number;
  /** 기분 태그 총 가짓수 */
  moodTotal: number;
  /**
   * 기록한 날짜 목록 — 요일별로 몇 번씩 겪었는지 세는 데 쓴다.
   * 없으면 요일 종류(weekdayCoverage)만으로 계산한다(구버전 호환).
   */
  recordDates?: string[];
};

export type CompletionAxis = {
  key: keyof typeof COMPLETION_WEIGHTS;
  label: string;
  /** 0~1 */
  ratio: number;
  /** 사용자에게 보여줄 현재 상태 */
  detail: string;
};

export type CompletionResult = {
  /** 0~100 정수 */
  percent: number;
  axes: CompletionAxis[];
  /** 다음에 무엇을 하면 가장 많이 오르는가 */
  nextStep: string;
  version: string;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * 요일 7개 중 가장 적게 겪은 요일의 횟수.
 * "월요일만 30번" 같은 편식을 걸러내기 위해 최솟값을 쓴다.
 */
function minVisitsPerWeekday(dates: string[]): number {
  const counts = new Array<number>(7).fill(0);
  for (const date of dates) {
    const d = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    counts[d.getUTCDay()] += 1;
  }
  return Math.min(...counts);
}

/**
 * 가설 축 — **판정이 끝난 카드만** 센다.
 *
 * 예전에는 "확인 중" 카드도 진행률만큼 점수를 줬는데, 그러면 7일째에 이미
 * 38%가 차서 곡선이 앞으로 쏠렸다. 화면에는 "확인된 날 0/9"라고 적혀 있는데
 * 숫자는 38%를 반영하고 있으니 **화면과 계산이 어긋나기도** 했다.
 * 세는 기준을 화면에 쓴 그대로 맞춘다.
 */
export function hypothesisAxisRatio(cards: HypothesisCard[]): number {
  if (cards.length === 0) return 0;
  const settled = cards.filter((card) => card.status !== "collecting").length;
  return clamp01(settled / cards.length);
}

export function computeCompletion(input: CompletionInput): CompletionResult {
  const daysRatio = clamp01(input.recordedDays / COMPLETION_TARGETS.days);
  const hypothesisRatio = hypothesisAxisRatio(input.cards);
  const ganjiRatio = clamp01(input.collectedGanji / COMPLETION_TARGETS.ganji);

  // 다양성 — 요일 골고루 + 기분 골고루
  //
  // 요일은 "종류를 다 채웠나"가 아니라 "요일마다 몇 번씩 겪었나"로 본다.
  // 종류만 세면 일주일 만에 7/7이 되어 축이 공짜로 차버린다.
  const weekdayRatio = input.recordDates?.length
    ? clamp01(
        minVisitsPerWeekday(input.recordDates) / COMPLETION_TARGETS.perWeekday
      )
    : clamp01(input.weekdayCoverage / 7);

  const moodRatio = clamp01(input.moodVariety / COMPLETION_TARGETS.moodKinds);
  const varietyRatio = clamp01((weekdayRatio + moodRatio) / 2);

  const settled = input.cards.filter((c) => c.status !== "collecting").length;

  const axes: CompletionAxis[] = [
    {
      key: "days",
      label: "기록",
      ratio: daysRatio,
      detail: `${input.recordedDays}일`,
    },
    {
      key: "hypotheses",
      label: "확인된 날",
      ratio: hypothesisRatio,
      detail:
        input.cards.length > 0
          ? `${settled}/${input.cards.length}개`
          : "아직 없음",
    },
    {
      key: "ganji",
      label: "겪어본 간지",
      ratio: ganjiRatio,
      detail: `${input.collectedGanji}/60`,
    },
    {
      key: "variety",
      label: "고른 정도",
      ratio: varietyRatio,
      detail: `요일 ${input.weekdayCoverage}/7`,
    },
  ];

  const weighted = axes.reduce(
    (sum, axis) => sum + axis.ratio * COMPLETION_WEIGHTS[axis.key],
    0
  );

  return {
    percent: Math.round(clamp01(weighted) * 100),
    axes,
    nextStep: buildNextStep(axes, input),
    version: COMPLETION_VERSION,
  };
}

/**
 * 다음에 뭘 하면 되는지 한 줄.
 * 가장 덜 찬 축을 집어 구체적인 행동으로 바꾼다.
 */
function buildNextStep(axes: CompletionAxis[], input: CompletionInput): string {
  if (input.recordedDays === 0) {
    return "오늘 30초만 기록하면 시작됩니다.";
  }

  const lowest = [...axes].sort((a, b) => a.ratio - b.ratio)[0]!;

  switch (lowest.key) {
    case "days": {
      const left = Math.max(0, COMPLETION_TARGETS.days - input.recordedDays);
      return `${left}일 더 기록하면 운세가 확실히 당신 것이 됩니다.`;
    }
    case "hypotheses": {
      const waiting = input.cards.filter((c) => c.status === "collecting").length;
      return waiting > 0
        ? `${waiting}가지 날이 확인을 기다리고 있어요.`
        : "기록이 쌓이면 어떤 날인지 하나씩 밝혀집니다.";
    }
    case "ganji": {
      const left = Math.max(0, COMPLETION_TARGETS.ganji - input.collectedGanji);
      return `아직 안 겪어본 날이 ${left}개 남았어요.`;
    }
    case "variety":
      return input.weekdayCoverage < 7
        ? "안 써본 요일에도 기록하면 더 정확해져요."
        : "기분을 다양하게 남길수록 더 정확해져요.";
    default:
      return "오늘도 기록해 주세요.";
  }
}

/** 사용자에게 보여줄 한 줄 요약 */
export function completionHeadline(percent: number): string {
  if (percent === 0) return "당신의 운세는 아직 남들과 같습니다";
  if (percent < 25) return `당신의 운세가 ${percent}% 맞춰졌습니다`;
  if (percent < 60) return `당신의 운세가 ${percent}% 당신 것이 됐습니다`;
  if (percent < 100) return `당신의 운세는 ${percent}% — 거의 당신 것입니다`;
  return "당신의 운세는 이제 완전히 당신 것입니다";
}
