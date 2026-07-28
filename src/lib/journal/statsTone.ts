/**
 * 기록 탭 색 역할
 * - 골드(--px-accent): 브랜드·수집(도감·연속)·행복도 기준선
 * - 파랑(#60a5fa): 링크·보조 액션
 * - 노랑(#fbbf24): 경고 크롬 / 초록(#4ade80): 완료 상태
 * - 아래 4색: 점수 값 표현 전용 (크롬·링크에 쓰지 않음)
 */
export const DATA_TONE = {
  high: "#4ade80",
  mid: "#a3e635",
  low: "#fb923c",
  bad: "#f87171",
} as const;

/** 증감 표시 전용 */
export const DELTA_TONE = {
  up: "#4ade80",
  down: "#f87171",
  flat: "var(--px-text2)",
} as const;

/** 1~10 행복도 → 데이터 색 */
export function happinessTone(score: number): string {
  if (score >= 7) return DATA_TONE.high;
  if (score >= 5) return DATA_TONE.mid;
  if (score >= 3.5) return DATA_TONE.low;
  return DATA_TONE.bad;
}

/** 1~5 서수 점수 → 데이터 색 */
export function ordinalTone(ordinal: number): string {
  if (ordinal >= 4) return DATA_TONE.high;
  if (ordinal >= 3) return DATA_TONE.mid;
  if (ordinal >= 2) return DATA_TONE.low;
  return DATA_TONE.bad;
}

export function deltaTone(delta: number, threshold = 0.3): string {
  if (delta > threshold) return DELTA_TONE.up;
  if (delta < -threshold) return DELTA_TONE.down;
  return DELTA_TONE.flat;
}
