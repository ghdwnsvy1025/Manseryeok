/**
 * 홈이 지금 무엇을 크게 보여줄지 정한다.
 *
 * 왜 시간으로 가르는가.
 * 이 앱의 하루는 둘로 갈린다 — 아침엔 "오늘 어떻게 보내지"(운세), 밤엔 "오늘 어땠지"(기록).
 * 한 화면에 둘을 같이 두면 둘 다 흐려진다. 아침에 기록 버튼이 크고, 밤에 운세가 크다.
 *
 * 다만 **"아침엔 운세, 밤엔 기록"은 아직 추측이다.** 실제 사용 데이터가 없다.
 * 그래서 접힌 것은 한 번 눌러 펼 수 있게 하고, 화면에 "지금은 밤이라 기록부터
 * 보여드려요"를 항상 노출한다. 틀려도 사용자가 1초 만에 되돌릴 수 있어야 한다.
 */

export type HomePhase =
  /** 낮 — 오늘의 운세가 주인공 */
  | "day"
  /** 밤, 아직 기록 전 — 기록이 주인공 */
  | "night"
  /** 오늘 기록을 마침 — 보상이 주인공 */
  | "done";

/** 밤이 시작되는 시각 (이 시각부터 기록을 먼저 보여준다) */
export const NIGHT_START_HOUR = 18;
/** 밤이 끝나는 시각 (이 시각부터 낮) */
export const NIGHT_END_HOUR = 5;

/** 지금이 밤인가 — 18시 ~ 다음날 5시 */
export function isNightHour(hour: number): boolean {
  if (!Number.isFinite(hour)) return false;
  const h = Math.floor(hour);
  return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
}

export function resolveHomePhase(opts: {
  /** 0~23 */
  hour: number;
  /** 오늘 기록을 이미 했는가 */
  hasTodayEntry: boolean;
}): HomePhase {
  if (opts.hasTodayEntry) return "done";
  return isNightHour(opts.hour) ? "night" : "day";
}

/** 화면 맨 위 인사 — 시간대에 맞춘 한마디 */
export function greeting(hour: number, hasTodayEntry: boolean): string {
  if (hasTodayEntry) return "오늘 기록, 고마워요";

  // "오늘 하루, 어땠어요?"는 밤 화면의 큰 제목이 쓴다.
  // 인사말까지 같은 말이면 한 화면에서 두 번 반복된다.
  const h = Math.floor(hour);
  if (h >= 5 && h < 11) return "좋은 아침이에요";
  if (h >= 11 && h < 17) return "오후예요";
  if (h >= 17 && h < 22) return "저녁이에요";
  return "늦은 밤이네요";
}

/**
 * "지금 왜 이 화면인지" 안내 + 반대쪽으로 가는 길.
 * 시간 판정이 사용자 상황과 어긋났을 때 빠져나갈 문이다.
 */
export function phaseHint(phase: HomePhase): { text: string; toggleLabel: string } {
  switch (phase) {
    case "night":
      return { text: "밤이라 기록을 먼저 보여드려요", toggleLabel: "운세 보기" };
    case "done":
      return { text: "오늘은 다 하셨어요", toggleLabel: "운세 다시 보기" };
    default:
      return { text: "", toggleLabel: "오늘 기록하기" };
  }
}
