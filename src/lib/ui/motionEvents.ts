/**
 * UI 모션·팝업 이벤트 버스 (브라우저 CustomEvent)
 */

export const PROGRESS_CELEBRATION_EVENT = "manseryeok_progress_celebration";
export const HEADER_BADGE_PULSE_EVENT = "manseryeok_header_badge_pulse";

export type ProgressCelebrationDetail = {
  gainedXp: number;
  leveledUp: boolean;
  level: number;
  previousLevel: number;
  wasFirstSaveOfDay: boolean;
  /** 개인화(운세 맞춤도) 변화 — 새 기록일에만 상승 */
  personalization?: { before: number; after: number };
  /**
   * 저장 완료 모달처럼 화면 안에서 XP를 보여줄 때
   * 우측 상단 플로팅 토스트는 생략한다.
   */
  suppressXpToast?: boolean;
};

export type HeaderBadgePulseDetail = {
  streak?: boolean;
  ring?: boolean;
};

export function notifyProgressCelebration(
  detail: ProgressCelebrationDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROGRESS_CELEBRATION_EVENT, { detail })
  );
}

export function notifyHeaderBadgePulse(
  detail: HeaderBadgePulseDetail = { streak: true, ring: true }
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HEADER_BADGE_PULSE_EVENT, { detail }));
}

const MILESTONE_KEY = "manseryeok:level_milestones_seen_v1";
const HOME_TIP_KEY = "manseryeok:home_motion_tip_seen_v1";

export const LEVEL_MILESTONE_COPY: Record<
  number,
  { title: string; body: string }
> = {
  1: {
    title: "Lv 1 달성",
    body: "기록이 시작됐어요. 앞으로 운세와 상태 해석이 조금씩 당신에게 맞춰집니다.",
  },
  3: {
    title: "Lv 3 달성",
    body: "패턴이 보이기 시작해요. 카테고리 점수와 키워드가 운세에 더 반영됩니다.",
  },
  5: {
    title: "Lv 5 달성",
    body: "중간 지점이에요. 개인 데이터 비중이 커져 운세가 더 정교해집니다.",
  },
  7: {
    title: "Lv 7 달성",
    body: "꾸준함이 쌓였어요. 통계·운세가 당신만의 리듬을 더 잘 읽습니다.",
  },
  10: {
    title: "Lv 10 MAX",
    body: "최고 레벨이에요. 이제 기록이 쌓일수록 해석의 결이 더 섬세해집니다.",
  },
};

export function hasSeenMilestone(level: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(MILESTONE_KEY);
    const seen = raw ? (JSON.parse(raw) as number[]) : [];
    return seen.includes(level);
  } catch {
    return true;
  }
}

export function markMilestoneSeen(level: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MILESTONE_KEY);
    const seen = raw ? (JSON.parse(raw) as number[]) : [];
    if (!seen.includes(level)) {
      seen.push(level);
      window.localStorage.setItem(MILESTONE_KEY, JSON.stringify(seen));
    }
  } catch {
    /* ignore */
  }
}

export function hasSeenHomeMotionTip(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HOME_TIP_KEY) === "1";
  } catch {
    return true;
  }
}

export function markHomeMotionTipSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_TIP_KEY, "1");
  } catch {
    /* ignore */
  }
}
