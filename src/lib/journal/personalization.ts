/**
 * 성장 표시 — Lv/XP가 주인공, 칭호는 Lv 구간 칩.
 * - Lv0~5: 맞춤 챕터 (입문 → 적응 → 심화 → 통달). 운세 비중도 같은 XP.
 * - Lv5+: 습관 챕터 (통달 → 성실 → 체화 → 경지).
 * 홈 막대는 항상 다음 Lv까지 XP 진행도를 쓴다.
 */
import type { JournalEntry } from "@/lib/journal/types";
import {
  computeBlendWeights,
  PERSONALIZATION_MATURITY_LEVEL,
  type DataMaturityTier,
} from "@/lib/journal/insight/dynamicWeights";
import {
  progressFromTotalXp,
  totalJournalXp,
} from "@/lib/product/personalizationLevel";

export type GrowthChapter = "fit" | "habit";

export type PersonalizationStage = {
  /** 0~100 맞춤도 (알고리즘·근거용, 홈에서는 숨김) */
  pct: number;
  tier: DataMaturityTier;
  chapter: GrowthChapter;
  /** 맞춤 챕터 완료 (Lv5+) */
  fitComplete: boolean;
  /** 현재 칭호 */
  stageLabel: string;
  stageIndex: number;
  personalWeightPct: number;
  sajuWeightPct: number;
  level: number;
  totalXp: number;
  maturityLevel: number;
};

/** 전체 칭호 트랙 (참고용) */
export const GROWTH_TITLE_TRACK = [
  "입문",
  "적응",
  "심화",
  "통달",
  "성실",
  "체화",
  "경지",
] as const;

/**
 * Lv 구간 → 칭호
 * 입문(0–1) → 적응(2–3) → 심화(4) → 통달(5) → 성실(6–7) → 체화(8–9) → 경지(10)
 */
export function growthTitleForLevel(level: number): {
  label: string;
  index: number;
  chapter: GrowthChapter;
  fitComplete: boolean;
} {
  const lv = Math.max(0, Math.floor(level));
  if (lv >= 10) {
    return { label: "경지", index: 6, chapter: "habit", fitComplete: true };
  }
  if (lv >= 8) {
    return { label: "체화", index: 5, chapter: "habit", fitComplete: true };
  }
  if (lv >= 6) {
    return { label: "성실", index: 4, chapter: "habit", fitComplete: true };
  }
  if (lv >= 5) {
    return { label: "통달", index: 3, chapter: "habit", fitComplete: true };
  }
  if (lv >= 4) {
    return { label: "심화", index: 2, chapter: "fit", fitComplete: false };
  }
  if (lv >= 2) {
    return { label: "적응", index: 1, chapter: "fit", fitComplete: false };
  }
  return { label: "입문", index: 0, chapter: "fit", fitComplete: false };
}

export function personalizationFromXp(
  totalXp: number,
  onboardingCompleted?: boolean
): PersonalizationStage {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  const w = computeBlendWeights({
    totalXp: xp,
    onboardingCompleted,
  });
  const progress = progressFromTotalXp(xp);
  const personal = Math.round((w.recent + w.keyword) * 100);
  const title = growthTitleForLevel(progress.level);

  return {
    pct: Math.round(w.maturity * 100),
    tier: w.tier,
    chapter: title.chapter,
    fitComplete: title.fitComplete,
    stageLabel: title.label,
    stageIndex: title.index,
    personalWeightPct: personal,
    sajuWeightPct: Math.max(0, 100 - personal),
    level: progress.level,
    totalXp: xp,
    maturityLevel: PERSONALIZATION_MATURITY_LEVEL,
  };
}

export function personalizationFromEntries(
  entries: JournalEntry[],
  onboardingCompleted?: boolean
): PersonalizationStage {
  return personalizationFromXp(totalJournalXp(entries), onboardingCompleted);
}
