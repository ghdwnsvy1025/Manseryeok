/**
 * Journal 경험치 — 날짜당 1회만 지급 (5A)
 */
import type { JournalEntry, JournalScore } from "./types";
import type { JournalSaveInput } from "./storage";
import { progressFromTotalXp } from "@/lib/product/personalizationLevel";

export function scoreJournalSaveXp(input: {
  content: string;
  overallSatisfaction: JournalScore | null;
  moodLabel: string | null;
  scores: Array<{ isNotApplicable: boolean; userScore: number | null }>;
  tagCodes: string[];
}): number {
  let xp = 5; // 기본 기록

  if (input.overallSatisfaction != null) xp += 3;
  if (input.moodLabel) xp += 2;

  const scored = input.scores.filter(
    (s) => !s.isNotApplicable && s.userScore != null
  ).length;
  const na = input.scores.filter((s) => s.isNotApplicable).length;
  xp += Math.min(12, scored * 2);
  xp += Math.min(2, na); // 해당 없음도 응답으로 인정

  const contentLen = input.content.trim().length;
  if (contentLen >= 201) xp += 8;
  else if (contentLen >= 81) xp += 6;
  else if (contentLen >= 21) xp += 4;
  else if (contentLen >= 1) xp += 1;

  xp += Math.min(3, input.tagCodes.length);

  return xp;
}

export type JournalXpResult = {
  /** 이번 저장에서 새로 지급된 XP (수정이면 0) */
  gainedXp: number;
  /** 이 날짜에 누적 표시할 XP */
  dayXp: number;
  wasFirstSaveOfDay: boolean;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  previousLevel: number;
};

export function applyJournalXpOnSave(opts: {
  existing: JournalEntry | null;
  saveInput: JournalSaveInput;
  /** 전체 journal 목록 (이 저장 반영 전) — 총 XP 계산 */
  allEntries: JournalEntry[];
}): {
  xpGranted: boolean;
  xpAwarded: number;
  result: JournalXpResult;
} {
  const scoreRows = opts.saveInput.scores.map((s) => ({
    isNotApplicable: s.isNotApplicable,
    userScore: (s.userScore ?? s.rawScore ?? null) as number | null,
  }));

  const computed = scoreJournalSaveXp({
    content: opts.saveInput.content,
    overallSatisfaction: opts.saveInput.overallSatisfaction,
    moodLabel: opts.saveInput.moodLabel,
    scores: scoreRows,
    tagCodes: opts.saveInput.tagCodes,
  });

  const wasFirst =
    !opts.existing?.xpGranted &&
    !(opts.existing && opts.existing.xpAwarded > 0);

  const xpGranted = true;
  const xpAwarded = wasFirst
    ? computed
    : opts.existing?.xpAwarded ?? computed;

  const gainedXp = wasFirst ? computed : 0;

  // 총 XP: 날짜별 xpAwarded 합 (이번 저장 날짜는 새 값으로)
  const byDate = new Map<string, number>();
  for (const e of opts.allEntries) {
    if (e.entryDate === opts.saveInput.entryDate) continue;
    if (e.xpAwarded > 0) byDate.set(e.entryDate, e.xpAwarded);
  }
  byDate.set(opts.saveInput.entryDate, xpAwarded);

  let totalXp = 0;
  for (const v of Array.from(byDate.values())) totalXp += v;

  const previousTotal = totalXp - gainedXp;
  const prevProgress = progressFromTotalXp(previousTotal);
  const nextProgress = progressFromTotalXp(totalXp);

  return {
    xpGranted,
    xpAwarded,
    result: {
      gainedXp,
      dayXp: xpAwarded,
      wasFirstSaveOfDay: wasFirst,
      totalXp,
      level: nextProgress.level,
      leveledUp: nextProgress.level > prevProgress.level,
      previousLevel: prevProgress.level,
    },
  };
}
