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
  ],
  2: [
    "잠이 부족하니 모든 게 더 힘들게 느껴졌다.",
    "마음이 무거워 하루가 길게 느껴졌다.",
  ],
  3: [
    "업무가 밀려서 피곤이 쌓였다.",
    "괜히 마음이 무겁고 집중이 잘 안 됐다.",
  ],
  4: [
    "사람들과의 대화가 조금 버거웠다.",
    "해야 할 일을 겨우겨우 끝냈다.",
  ],
  5: [
    "특별한 일은 없었지만 무난하게 지나갔다.",
    "평소와 비슷한 하루였다.",
  ],
  6: [
    "해야 할 일을 마치고 가벼운 휴식을 했다.",
    "무난했고 기분도 괜찮았다.",
  ],
  7: [
    "할 일을 마치고 가벼운 산책도 했다.",
    "친구와 잠깐 이야기하니 기분이 풀렸다.",
  ],
  8: [
    "작은 성과가 있어서 뿌듯했다.",
    "몸이 가뿐하고 하루가 짧게 느껴졌다.",
  ],
  9: [
    "오래 미뤄둔 일을 끝냈고 기분이 좋았다.",
    "좋은 사람들과 시간을 보내 에너지가 찼다.",
  ],
  10: [
    "오늘따라 모든 게 잘 풀려 최고였다.",
    "하루 종일 에너지가 넘쳤다.",
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

/** Supabase diary_entries.id(uuid)용 결정적 UUID */
function seededUuid(key: string): string {
  const h1 = hashString(key);
  const h2 = hashString(`${key}#b`);
  const h3 = hashString(`${key}#c`);
  const h4 = hashString(`${key}#d`);
  const hex = [h1, h2, h3, h4]
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
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
  const bias = weekday === 0 || weekday === 6 ? 1 : 0;
  const roll = (seed % 100) + bias * 8;
  if (roll < 6) return 1;
  if (roll < 14) return 2;
  if (roll < 24) return 3;
  if (roll < 36) return 4;
  if (roll < 50) return 5;
  if (roll < 64) return 6;
  if (roll < 76) return 7;
  if (roll < 86) return 8;
  if (roll < 94) return 9;
  return 10;
}

function emotionsForRating(rating: HappinessRating, seed: number): string[] {
  const byBand: Record<"low" | "mid" | "high", string[]> = {
    low: ["우울", "피곤", "외로움", "불안", "화남"],
    mid: ["평범", "편안", "피곤"],
    high: ["만족", "편안", "행복", "설렘"],
  };
  const band = rating <= 3 ? "low" : rating <= 6 ? "mid" : "high";
  const pool = byBand[band].filter((tag) =>
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
    if (seed % 100 < 18) continue;

    const weekday = cursor.getDay();
    const happinessRating = ratingForDay(date, weekday);
    const score = happinessRatingToScore(happinessRating);
    const analysis = wellbeingToAnalysis(score);
    const emotions = emotionsForRating(happinessRating, seed);
    const tags = tagsForDay(seed, weekday);
    const memo = pick(MEMOS[happinessRating], seed >> 5);
    const createdAt = new Date(
      `${date}T21:${String(seed % 50).padStart(2, "0")}:00+09:00`
    ).toISOString();

    const entry = createDiaryEntry(date, memo, {
      id: seededUuid(`demo-${date}`),
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

/**
 * 오늘 기준 최근 N일 연속 실일기 시드 (dataOrigin: user).
 * 예보 성숙도·통계 테스트용 — 데모와 달리 개인화에 포함됩니다.
 */
export function buildRealTestSeedEntries(
  days = 20,
  endDate: Date = new Date()
): DiaryEntry[] {
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );
  const count = Math.max(1, Math.min(90, Math.floor(days)));
  const entries: DiaryEntry[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const cursor = addDays(end, -i);
    const date = formatDate(cursor);
    const seed = hashString(`test-seed-${date}`);
    const weekday = cursor.getDay();
    const happinessRating = ratingForDay(date, weekday);
    const score = happinessRatingToScore(happinessRating);
    const analysis = wellbeingToAnalysis(score);
    const emotions = emotionsForRating(happinessRating, seed);
    const tags = tagsForDay(seed, weekday);
    const memo =
      pick(MEMOS[happinessRating], seed >> 5) ||
      `테스트 시드 기록 (${date})`;
    const energyRating = ((seed % 4) + 1) as 1 | 2 | 3 | 4;
    const focusRating = happinessRating;
    const createdAt = new Date(
      `${date}T20:${String(seed % 50).padStart(2, "0")}:00+09:00`
    ).toISOString();

    const entry = createDiaryEntry(date, memo, {
      id: seededUuid(`test-seed-${date}`),
      happinessRating,
      energyRating,
      focusRating,
      conditionRating: happinessRating,
      primaryArea: weekday === 0 || weekday === 6 ? "나 자신" : "일",
      emotions,
      tags,
      analysis: {
        ...analysis,
        dominant_emotions: emotions,
        summary: `테스트 시드 · 행복도 ${happinessRating}/10`,
      },
      inputMode: "scores",
      emotionSource: "selected",
      dataOrigin: "user",
    });

    entries.push({
      ...entry,
      content: memo,
      dataOrigin: "user",
      happinessSource: "selected",
      createdAt,
      updatedAt: createdAt,
    });
  }

  return entries;
}
