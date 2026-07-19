import { createDiaryEntry } from "./createEntry";
import { happinessRatingToScore, type HappinessRating } from "./happiness";
import { wellbeingToAnalysis } from "./manualScores";
import {
  RECOMMENDED_EMOTION_TAGS,
  RECOMMENDED_EVENT_TAGS,
} from "./emotionTags";
import type { DiaryEntry } from "./types";

const MEMOS: Record<HappinessRating, string[]> = {
  1: [
    "하루 종일 기운이 없고 아무것도 하기 싫었다.",
    "작은 일에도 예민해져서 혼자 가라앉았다.",
    "잠이 부족하니 모든 게 더 힘들게 느껴졌다.",
  ],
  2: [
    "업무가 밀려서 피곤이 쌓였다.",
    "괜히 마음이 무겁고 집중이 잘 안 됐다.",
    "사람들과의 대화가 조금 버거웠다.",
  ],
  3: [
    "특별한 일은 없었지만 무난하게 지나갔다.",
    "해야 할 일을 겨우겨우 끝냈다.",
    "평소와 비슷한 하루였다.",
  ],
  4: [
    "할 일을 마치고 가벼운 산책도 했다.",
    "친구와 잠깐 이야기하니 기분이 풀렸다.",
    "작은 성과가 있어서 뿌듯했다.",
  ],
  5: [
    "오래 미뤄둔 일을 끝냈고 기분이 좋았다.",
    "좋은 사람들과 시간을 보내 에너지가 찼다.",
    "몸이 가뿐하고 하루가 짧게 느껴졌다.",
  ],
};

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length];
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, delta: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + delta);
  return next;
}

function ratingForDay(date: string, weekday: number): HappinessRating {
  const seed = hashString(date);
  // 주말은 약간 더 높게, 평일은 중간 분포
  const bias = weekday === 0 || weekday === 6 ? 1 : 0;
  const roll = (seed % 100) + bias * 8;
  if (roll < 10) return 1;
  if (roll < 28) return 2;
  if (roll < 58) return 3;
  if (roll < 82) return 4;
  return 5;
}

function emotionsForRating(rating: HappinessRating, seed: number): string[] {
  const byRating: Record<HappinessRating, string[]> = {
    1: ["우울", "피곤", "외로움"],
    2: ["피곤", "불안", "화남"],
    3: ["평범", "편안", "피곤"],
    4: ["만족", "편안", "행복"],
    5: ["행복", "설렘", "만족"],
  };
  const pool = byRating[rating].filter((tag) =>
    (RECOMMENDED_EMOTION_TAGS as readonly string[]).includes(tag)
  );
  const count = 1 + (seed % 3);
  return pool.slice(0, count);
}

function tagsForDay(seed: number, weekday: number): string[] {
  const weekdayish =
    weekday === 0 || weekday === 6
      ? ["휴식", "친구", "여행", "술자리"]
      : ["직장", "공부", "운동", "수면 부족", "돈"];
  const first = pick(weekdayish, seed);
  const second = pick(RECOMMENDED_EVENT_TAGS, seed >> 3);
  return first === second ? [first] : [first, second];
}

/**
 * 오늘 기준 약 2개월(60일) 데모 일기 생성.
 * 일부 날짜는 의도적으로 비워 미기록일 패턴을 남긴다.
 */
export function buildTwoMonthDemoEntries(
  endDate: Date = new Date()
): DiaryEntry[] {
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const start = addDays(end, -59);
  const entries: DiaryEntry[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const date = formatDate(cursor);
    const seed = hashString(`demo-${date}`);
    // ~18% 미기록
    if (seed % 100 < 18) continue;

    const weekday = cursor.getDay();
    const happinessRating = ratingForDay(date, weekday);
    const score = happinessRatingToScore(happinessRating);
    const analysis = wellbeingToAnalysis(score);
    const emotions = emotionsForRating(happinessRating, seed);
    const tags = tagsForDay(seed, weekday);
    const memo = pick(MEMOS[happinessRating], seed >> 5);
    const createdAt = new Date(`${date}T21:${String(seed % 50).padStart(2, "0")}:00+09:00`).toISOString();

    const entry = createDiaryEntry(date, memo, {
      id: `demo-${date}`,
      happinessRating,
      emotions,
      tags,
      analysis: {
        ...analysis,
        dominant_emotions: emotions,
        summary: `오늘의 행복도는 ${score}점이에요.`,
      },
      inputMode: "scores",
      emotionSource: "selected",
    });

    entries.push({
      ...entry,
      dataOrigin: "demo",
      happinessSource: "selected",
      conditionRating: happinessRating,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return entries;
}
