/**
 * Premium-subtle click burst — tunable in one place.
 * Feel: soft SaaS celebratory feedback (not game confetti).
 */

export const CLICK_BURST_EVENT = "manseryeok:click-burst";

export type ClickBurstVariant = "heart" | "mood" | "ordinal" | "xp";

export type ClickBurstDetail = {
  x: number;
  y: number;
  variant: ClickBurstVariant;
  /** 행복도 0~10 등 — 강도·색 조절용 */
  value?: number;
  /** 기분 등 라벨 기반 색 힌트 */
  label?: string;
};

/** 한곳에서 조절하는 물리·비주얼 파라미터 */
export const BURST_CONFIG = {
  /** 동시에 살아 있을 수 있는 파티클 상한 (풀 크기) */
  poolSize: 96,
  /** 약한 하향 가속도 (px/s²) */
  gravity: 200,
  /** 속도 감쇠 (1/s) — 높을수록 빨리 느려짐 */
  drag: 2.8,
  /** 전체 수명 범위 (ms) — 짧고 정교하게 */
  lifeMs: { min: 450, max: 700 } as const,
  /** 초기 속도 (px/s) */
  speed: { min: 70, max: 180 } as const,
  /** 크기 (px) */
  size: { min: 3, max: 6.5 } as const,
  /** 하트는 점보다 살짝 크게 */
  heartSizeBoost: 1.55,
  /** 회전 속도 (rad/s) */
  spin: { min: -1.4, max: 1.4 } as const,
  /** 변형별 개수 */
  count: {
    heart: { min: 12, max: 16 },
    mood: { min: 10, max: 14 },
    ordinal: { min: 8, max: 12 },
    xp: { min: 10, max: 16 },
  } as const,
  /** 하트 비율 — 행복도는 이전처럼 하트 비중을 유지 */
  heartRatio: 0.55,
  /** 시작 스케일 → 종료 스케일 */
  scale: { start: 1, end: 0.22 } as const,
  /** 버튼 프레스 피드백 */
  press: {
    downScale: 0.965,
    durationMs: 280,
  } as const,
} as const;

/** 채도를 한 단계 더 낮춘 팔레트 */
export const BURST_PALETTE = {
  heartLow: ["#9ca3af", "#a8a29e", "#b0b7c0"],
  heartMid: ["#e8a0bc", "#d4a5b8", "#c9b2c0"],
  heartHigh: ["#e8a0bc", "#d9a0b0", "#c4b5a5", "#b8c4c0"],
  mood: {
    기쁨: "#c4b07a",
    뿌듯함: "#c4b882",
    평온: "#88aeb6",
    설렘: "#c4a8b4",
    불안: "#a49ab6",
    분노: "#b89292",
    짜증남: "#b89a8c",
    답답함: "#9aa2aa",
    슬픔: "#88a0b4",
    우울함: "#7a90a8",
    후회스러움: "#9a96a8",
    지침: "#9a9a9a",
    무덤덤: "#aeb4ba",
  } as Record<string, string>,
  ordinal: ["#8fa09c", "#a0aca8", "#849690"],
  /** 레벨 XP — 노랑→연두 */
  xp: ["#f5d76e", "#d9e35a", "#a3e635", "#c8e86a"],
  accentFallback: "#9aa8a4",
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function notifyClickBurst(detail: ClickBurstDetail): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  window.dispatchEvent(
    new CustomEvent<ClickBurstDetail>(CLICK_BURST_EVENT, { detail })
  );
}

export function elementCenter(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function burstFromEvent(
  e: {
    clientX: number;
    clientY: number;
    currentTarget?: EventTarget | null;
  },
  opts: Omit<ClickBurstDetail, "x" | "y">
): void {
  // 클릭 좌표가 아니라 버튼 중심을 emitter origin으로 사용
  if (e.currentTarget instanceof Element) {
    burstFromElement(e.currentTarget, opts);
    return;
  }
  notifyClickBurst({
    x: e.clientX,
    y: e.clientY,
    ...opts,
  });
}

export function burstFromElement(
  el: Element | null,
  opts: Omit<ClickBurstDetail, "x" | "y">
): void {
  if (!el) return;
  const { x, y } = elementCenter(el);
  notifyClickBurst({ x, y, ...opts });
}

/**
 * 미세 scale-down → spring 복원.
 * reduced-motion 에서는 짧은 opacity만.
 */
export function softPress(el: Element | null): void {
  if (!el || typeof el.animate !== "function") return;
  const reduced = prefersReducedMotion();
  if (reduced) {
    el.animate(
      [{ opacity: 1 }, { opacity: 0.72 }, { opacity: 1 }],
      { duration: 160, easing: "ease-out" }
    );
    return;
  }
  const s = BURST_CONFIG.press.downScale;
  el.animate(
    [
      { transform: "scale(1)" },
      { transform: `scale(${s})`, offset: 0.28 },
      { transform: "scale(1.015)", offset: 0.62 },
      { transform: "scale(1)" },
    ],
    {
      duration: BURST_CONFIG.press.durationMs,
      easing: "cubic-bezier(0.22, 1.4, 0.36, 1)",
    }
  );
}

/** 클릭 + 파티클 + 프레스를 한 번에 (원점은 버튼 중심) */
export function celebrateClick(
  e: { clientX: number; clientY: number; currentTarget?: EventTarget | null },
  opts: Omit<ClickBurstDetail, "x" | "y">
): void {
  const target =
    e.currentTarget instanceof Element ? e.currentTarget : null;
  softPress(target);
  if (target) {
    burstFromElement(target, opts);
  } else {
    burstFromEvent(e, opts);
  }
}

export function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}
