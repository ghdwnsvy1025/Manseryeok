// 운세 개편 Phase 1 (2026-11-01, ChatGPT 개편 검토): 오늘 7개 운세 영역 원자료(core.todayAreaProfile) → 기록 화면과 같은 6개 영역.
// 화면 표현용이다 — level은 예측 점수가 아니라 "오늘 계산에서 그 영역을 위아래로 움직이는 신호"의 도장 위치다.
// active가 아닌 영역의 level 3은 "보통일 것"이 아니라 "특별한 신호 없음"이다. 기록하지 않은 영역도 3으로 채우지 않는다(missing ≠ neutral).
import { AREAS, type AreaKey, type Areas } from "../entry";
import { areaReason } from "./areaReasons";
import type { AreaName, AreaProfileEntry, FortuneContent } from "./types";

/** 기록 영역 → 운세 영역 (일·공부 = 직업 + 학업) */
const SOURCES: Record<AreaKey, AreaName[]> = {
  work: ["직업", "학업"],
  money: ["재물"],
  health: ["건강"],
  family: ["가족"],
  love: ["연애"],
  people: ["대인"],
};

/** 영역 합 → 도장 위치 1~5. +2 이상 5, +1 4, 신호 없음 3, −1 2, −2 이하 1 */
export function areaSignalLevel(strength: number): 1 | 2 | 3 | 4 | 5 {
  if (strength >= 2) return 5;
  if (strength >= 1) return 4;
  if (strength <= -2) return 1;
  if (strength <= -1) return 2;
  return 3;
}

export interface SixAreaSignal {
  key: AreaKey;
  label: string;
  /** 도장 위치. active가 아니면 3 = 특별한 신호 없음 */
  level: 1 | 2 | 3 | 4 | 5;
  active: boolean;
  /** 다른 방향 기여가 섞였거나(한 영역 안), 일·공부에서 직업·학업이 반대 방향 */
  mixed: boolean;
  strength: number;
  /** 이 도장을 만든 운세 영역 */
  sources: AreaName[];
}

/**
 * 7개 → 6개. 일·공부 병합(5명 × 2026년 1,825일 분석: 둘 다 신호 없음 39%, 한쪽만 44%, 같은 방향 15%, 반대 방향 2%):
 * 한쪽만 active → 그쪽, 둘 다 같은 방향 → 더 센 쪽, 반대 방향 → 신호 없음(3)으로 두고 mixed 표시.
 */
export function sixAreaSignals(profile: Record<AreaName, AreaProfileEntry>): SixAreaSignal[] {
  return AREAS.map(({ key, label }) => {
    const src = SOURCES[key].map((n) => ({ n, e: profile[n] }));
    const act = src.filter((s) => s.e.active);
    if (act.length === 0) return { key, label, level: 3, active: false, mixed: src.some((s) => s.e.mixed), strength: 0, sources: [] };
    if (act.length === 2 && Math.sign(act[0]!.e.strength) !== Math.sign(act[1]!.e.strength))
      return { key, label, level: 3, active: false, mixed: true, strength: 0, sources: act.map((s) => s.n) };
    const top = act.reduce((a, b) => (Math.abs(b.e.strength) > Math.abs(a.e.strength) ? b : a));
    return { key, label, level: areaSignalLevel(top.e.strength), active: true, mixed: top.e.mixed, strength: top.e.strength, sources: [top.n] };
  });
}

/** 기록 후 비교 (Phase 4 재료): 사용자가 매긴 영역만. 매기지 않은 영역은 null — 3으로 채우지 않는다 */
export interface AreaComparison { key: AreaKey; label: string; signal: SixAreaSignal; recorded: number | null }
export function compareAreas(signals: readonly SixAreaSignal[], recorded: Areas | null | undefined): AreaComparison[] {
  return signals.map((s) => ({ key: s.key, label: s.label, signal: s, recorded: typeof recorded?.[s.key] === "number" ? recorded[s.key]! : null }));
}

// ---------- Phase 2 화면 재료 ----------

/**
 * "오늘 흐름 N/10" 숫자 (사용자 Q1 = 다): 반올림한 숫자를 단계 범위 안으로 맞춘다 — 주의 ≤ 4, 무난 5~6, 좋음 ≥ 7.
 * 단계 기준(4.8·6.8)과 반올림이 어긋나 같은 "5"에 주의·무난이 섞이던 날(12월·11월 360편 중 8.6%)을 없앤다. 그날들만 오차가 0.5~0.8(예: 4.7 주의 → 4), 나머지는 반올림 그대로
 */
export function flowNumber(score10: number, band: "좋음" | "무난" | "주의"): number {
  const n = Math.max(0, Math.min(10, Math.round(score10)));
  return band === "주의" ? Math.min(n, 4) : band === "무난" ? Math.min(Math.max(n, 5), 6) : Math.max(n, 7);
}

export interface SixAreaView extends SixAreaSignal { reason: string | null }

/** 카드용 6개 영역 (+ 신호 있는 영역의 이유 한 줄). todayAreaProfile이 없는 옛 캐시는 null — 카드가 예전 영역 줄을 그린다 */
export function sixAreaView(content: Pick<FortuneContent, "core">): SixAreaView[] | null {
  const prof = content.core?.todayAreaProfile;
  if (!prof) return null;
  return sixAreaSignals(prof).map((s) => ({ ...s, reason: s.active && s.sources[0] ? areaReason(s.sources[0], prof[s.sources[0]]) : null }));
}
