// 운세 개편 Phase 1 (2026-11-01, ChatGPT 개편 검토): 오늘 7개 운세 영역 원자료(core.todayAreaProfile) → 기록 화면과 같은 6개 영역.
// 화면 표현용이다 — level은 예측 점수가 아니라 "오늘 계산에서 그 영역을 위아래로 움직이는 신호"의 도장 위치다.
// active가 아닌 영역의 level 3은 "보통일 것"이 아니라 "특별한 신호 없음"이다. 기록하지 않은 영역도 3으로 채우지 않는다(missing ≠ neutral).
import { AREAS, type AreaKey, type Areas } from "../entry";
import { areaReason } from "./areaReasons";
import { batchim } from "./text";
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

export interface SixAreaView extends SixAreaSignal { reason: string | null; /** 0~100, 50 = 보통 (areaGaugeOf) */ gauge: number }

/**
 * 2026-11-04 (앱 주인 결정): 숫자 하나로 뭉개지던 날을 카드에 말해 준다. 전부 코드가 정하는 문구이고 AI를 부르지 않는다.
 * 엇갈리는 날 = 단계와 영역 막대가 어긋나거나 좋은 막대와 조심 막대가 함께 있는 날("조심하라면서 왜 돈은 좋아요?"가 생기는 날).
 * 흔들리기 쉬운 날 = 오늘이 대운·세운·월운과 충인 날. 코어 답_Q72-Q75대로 사건을 말하지 않고 체감이 들쭉날쭉할 수 있다고만 한다.
 */
export interface DayShape {
  crossed: boolean;
  shaky: boolean;
  /** 카드에 보일 한 줄. 둘 다 아니면 이 값 자체가 null */
  line: string;
  /** 2026-11-15 (명세 40): 엇갈리고 흔들리기도 하는 날, 흔들림 쪽 한 줄 — 펼친 카드가 두 줄로 보여 준다 */
  shakyLine?: string;
}
const joinAreas = (labels: readonly string[]): string =>
  labels.length < 2 ? (labels[0] ?? "") : `${labels[0]}${batchim(labels[0]!) ? "과" : "와"} ${labels[1]}`;

export function dayShapeView(content: Pick<FortuneContent, "core" | "band">): DayShape | null {
  const { core, band } = content;
  if (!core?.todayAreaProfile) return null;
  const active = sixAreaSignals(core.todayAreaProfile).filter((s) => s.active).sort((a, b) => Math.abs(b.strength) - Math.abs(a.strength));
  const up = joinAreas(active.filter((s) => s.strength > 0).slice(0, 2).map((s) => s.label));
  const down = joinAreas(active.filter((s) => s.strength < 0).slice(0, 2).map((s) => s.label));
  const crossLine =
    band === "주의" && up ? `전체로는 조심할 편이지만 ${up} 쪽은 괜찮아요.`
    : band === "좋음" && down ? `전체로는 수월한 편이지만 ${down} 쪽은 조심해요.`
    : band === "무난" && up && down ? `${up} 쪽은 괜찮고 ${down} 쪽은 조심해요.`
    : null;
  const shaky = !!(core.context.daeun?.clash || core.context.seun.clash || core.context.wolun?.clash);
  if (!crossLine && !shaky) return null;
  const shakyText = "큰 흐름과 오늘이 어긋나 평소보다 들쭉날쭉하게 느껴질 수 있어요.";
  return { crossed: !!crossLine, shaky, line: crossLine ?? shakyText, ...(crossLine && shaky ? { shakyLine: shakyText } : {}) };
}

/**
 * 2026-11-14 카드 시험 2안: 6개 영역을 10점 숫자로. 신호 세기(영역 합, ±3에서 끝)를 5점을 가운데로 옮긴 것 — +1 → 7, +2 → 8, +3 이상 → 10, −1 → 3, −2 → 2, −3 이하 → 1.
 * 신호 없는 영역은 5이고 active가 거짓이다("보통일 것"이 아니라 "특별한 신호 없음" — 화면이 흐리게 그리도록).
 * 주의: 이 숫자는 예측 점수가 아니라 신호 세기를 옮긴 값이다. 실제 기록 96편과 견줬을 때 운세 점수는 기록과 상관이 없었다(시험용)
 */
export function areaScoreOf(strength: number, active: boolean): number {
  if (!active) return 5;
  return Math.max(1, Math.min(10, Math.round(5 + (Math.max(-3, Math.min(3, strength)) * 5) / 3)));
}
export interface AreaScoreView extends SixAreaView { score: number }

/**
 * 2026-11-15 앱 주인: "막대를 세로(가운데에서 양쪽)가 아니라 가로로, − 없이 +로만. 50을 보통으로."
 * 신호 세기(영역 합)를 0~100 게이지로 옮긴다 — 신호 없음 50, 한 단계마다 15: +1 → 65, +2 → 80, +3 이상 → 95, −1 → 35, −2 → 20, −3 이하 → 5.
 * 0과 100은 쓰지 않는다(막대가 비거나 꽉 차 "확실하다"로 읽히지 않게). 예측 점수가 아니라 신호 세기다 — 숫자로 보여 주지 않는다
 */
export function areaGaugeOf(strength: number, active: boolean): number {
  if (!active) return 50;
  // 좋은 쪽과 조심할 쪽을 같은 길이로: 절댓값을 반올림한다(Math.round는 −1.5를 −1로 올려 +1.5 → 80, −1.5 → 35로 어긋났다 — 디자이너 보고 42)
  const step = Math.sign(strength) * Math.min(3, Math.round(Math.abs(strength)));
  return 50 + step * 15;
}
export function areaScoreView(content: Pick<FortuneContent, "core">): AreaScoreView[] | null {
  const six = sixAreaView(content);
  return six ? six.map((s) => ({ ...s, score: areaScoreOf(s.strength, s.active) })) : null;
}

/** 카드용 6개 영역 (+ 신호 있는 영역의 이유 한 줄). todayAreaProfile이 없는 옛 캐시는 null — 카드가 예전 영역 줄을 그린다 */
export function sixAreaView(content: Pick<FortuneContent, "core">): SixAreaView[] | null {
  const prof = content.core?.todayAreaProfile;
  if (!prof) return null;
  return sixAreaSignals(prof).map((s) => ({ ...s, reason: s.active && s.sources[0] ? areaReason(s.sources[0], prof[s.sources[0]]) : null, gauge: areaGaugeOf(s.strength, s.active) }));
}
