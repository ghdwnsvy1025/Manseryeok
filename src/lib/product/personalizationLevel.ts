import type { DiaryEntry } from "@/lib/diary/types";

/** 표시 레벨 범위: L0 ~ L10 */
export const PERSONALIZATION_MAX_LEVEL = 10;

export function formatPersonalizationLevel(level: number): string {
  return `L${Math.max(0, Math.floor(level))}`;
}

/**
 * L → L+1 필요 경험치.
 * 초반은 동기부여, 후반은 장기 목표.
 * 누적 L10 ≈ 20,600 XP
 * ≈ 양질 기록 하루 ~22점 기준 약 2.6년.
 */
export function xpCostToNext(level: number): number {
  if (level < 0 || level >= PERSONALIZATION_MAX_LEVEL) return 0;
  return Math.max(40, Math.floor(80 + 8 * Math.pow(level, 3.1)));
}

/** L0=0 부터 각 레벨에 도달하기 위한 누적 경험치 테이블 */
export function buildCumulativeXpTable(): number[] {
  const table = [0];
  let cum = 0;
  for (let level = 0; level < PERSONALIZATION_MAX_LEVEL; level++) {
    cum += xpCostToNext(level);
    table.push(cum);
  }
  return table;
}

const CUMULATIVE_XP = buildCumulativeXpTable();

export function cumulativeXpForLevel(level: number): number {
  const clamped = Math.max(
    0,
    Math.min(PERSONALIZATION_MAX_LEVEL, Math.floor(level))
  );
  return CUMULATIVE_XP[clamped] ?? CUMULATIVE_XP[PERSONALIZATION_MAX_LEVEL]!;
}

/**
 * 단일 일기의 개인화 경험치.
 * 동기: 매일 쓰게 하되, 수치·감정·본문이 구체할수록 더 많이 쌓이게.
 * demo 데이터는 0.
 */
export function scoreEntryXp(entry: DiaryEntry): number {
  if (entry.dataOrigin === "demo") return 0;

  let xp = 3;

  if (typeof entry.happinessRating === "number") xp += 4;
  if (typeof entry.energyRating === "number") xp += 3;
  if (typeof entry.focusRating === "number") xp += 3;
  if (typeof entry.conditionRating === "number") xp += 3;

  if (entry.primaryArea && entry.primaryArea !== "특별한 일 없음") xp += 2;
  else if (entry.primaryArea === "특별한 일 없음") xp += 1;

  const emotionCount = entry.emotions?.filter(Boolean).length ?? 0;
  xp += Math.min(4, emotionCount * 2);

  const contentLen = (entry.content ?? "").trim().length;
  if (contentLen >= 201) xp += 8;
  else if (contentLen >= 81) xp += 6;
  else if (contentLen >= 21) xp += 4;
  else if (contentLen >= 1) xp += 1;

  const tagCount = entry.tags?.filter(Boolean).length ?? 0;
  xp += Math.min(3, tagCount * 1);

  let lifestyle = 0;
  if (entry.sleepSatisfaction != null || entry.sleepScore != null) lifestyle += 1;
  if (entry.activityLevel != null || entry.exerciseStatus) lifestyle += 1;
  if (entry.socialMet != null || entry.socialActivity) lifestyle += 1;
  if (entry.workIntensity != null) lifestyle += 1;
  xp += Math.min(4, lifestyle);

  return xp;
}

/**
 * 같은 날짜에 여러 기록이 있으면 그날 최고점을 사용 (중복 방지).
 */
export function totalPersonalizationXp(entries: DiaryEntry[]): number {
  const byDate = new Map<string, number>();
  for (const entry of entries) {
    const score = scoreEntryXp(entry);
    if (score <= 0) continue;
    const prev = byDate.get(entry.date) ?? 0;
    if (score > prev) byDate.set(entry.date, score);
  }
  let total = 0;
  for (const v of byDate.values()) total += v;
  return total;
}

export type PersonalizationLevelProgress = {
  level: number;
  totalXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNext: number;
  progressRatio: number;
  overallRatio: number;
  isMax: boolean;
};

export function resolvePersonalizationLevelProgress(
  entries: DiaryEntry[]
): PersonalizationLevelProgress {
  return progressFromTotalXp(totalPersonalizationXp(entries));
}

export function progressFromTotalXp(
  totalXp: number
): PersonalizationLevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  const maxCum = cumulativeXpForLevel(PERSONALIZATION_MAX_LEVEL);

  let level = 0;
  for (let l = PERSONALIZATION_MAX_LEVEL; l >= 0; l--) {
    if (xp >= cumulativeXpForLevel(l)) {
      level = l;
      break;
    }
  }

  const isMax = level >= PERSONALIZATION_MAX_LEVEL;
  const levelStartXp = cumulativeXpForLevel(level);
  const nextLevelXp = isMax ? levelStartXp : cumulativeXpForLevel(level + 1);
  const xpIntoLevel = xp - levelStartXp;
  const xpToNext = isMax ? 0 : nextLevelXp - xp;
  const span = nextLevelXp - levelStartXp;
  const progressRatio = isMax
    ? 1
    : span > 0
      ? Math.min(1, xpIntoLevel / span)
      : 1;

  return {
    level,
    totalXp: xp,
    levelStartXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNext,
    progressRatio,
    overallRatio: maxCum > 0 ? Math.min(1, xp / maxCum) : 1,
    isMax,
  };
}
