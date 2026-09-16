/**
 * 홈에 띄울 운세 맞춤도 — 앱의 실제 데이터를 모아 한 번에 계산한다.
 *
 * 저장하지 않는다. 매번 계산한다.
 * (같은 재료면 같은 값이 나오므로 저장할 이유가 없다. `userAppState.ts` 와 같은 방침)
 */
import { getPillarsForDate, todayDateString } from "@/lib/diary/dayPillar";
import { MOOD_OPTIONS, type JournalEntry } from "@/lib/journal/types";
import type { SajuProfilePillars } from "@/lib/diary/types";

import { buildNatalSummary } from "./natalSummary";
import { buildDayFacts } from "./dayFacts";
import { generateHypotheses } from "./generate";
import { evaluateAll } from "./evaluate";
import { toDayRecords } from "./fromJournal";
import { computeCompletion, type CompletionResult } from "./completion";
import { findTodayPatterns, todayPatternLine, type TodayPattern } from "./todayPattern";
import { buildTodayYongsin, type TodayYongsin } from "./todayYongsin";
import type { DayFacts, HypothesisCard } from "./types";

export type HomeCompletion = {
  completion: CompletionResult;
  cards: HypothesisCard[];
  /** 아직 판정을 기다리는 날의 수 — "3가지 날 확인 중" 문구용 */
  waitingCount: number;
  /** 오늘에 해당하는, 확인이 끝난 날들 */
  todayPatterns: TodayPattern[];
  /** 홈에 띄울 한 줄 — 없으면 null */
  todayLine: string | null;
  /**
   * 오늘이 용신일인가.
   *
   * 확인된 패턴(todayLine)이 없을 때 홈이 대신 보여줄 말이다.
   * 확인된 게 있으면 그쪽이 이긴다 — 기록이 이론보다 먼저다.
   */
  todayYongsin: TodayYongsin | null;
  /**
   * 내일. 기록을 마친 뒤 홈이 보여줄 보상이다.
   *
   * `/forecast`(내일 예보)를 여기로 흡수한다. 그 화면은 옛 홈 대시보드를 그대로
   * 띄우던 것이고, 앱 안에서 들어갈 길이 하나도 없었다.
   * 대신 **기록을 마친 밤에 저절로** 내일이 온다 — 그게 "쓰면 돌려받는다"의 실물이다.
   */
  tomorrow: {
    date: string;
    /** "무술일" */
    ganjiKo: string;
    patterns: TodayPattern[];
    /** "집중이 잘 돼요" — 확인된 게 없으면 null */
    line: string | null;
    /** "역할이 주어지는 날" — 확인된 게 없으면 null */
    dayTitle: string | null;
  };
};

/** 하루 뒤 날짜 (YYYY-MM-DD) */
function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** 기록된 날들의 요일 종류 (0~7) */
function countWeekdays(dates: string[]): number {
  const days = new Set<number>();
  for (const date of dates) {
    const d = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) days.add(d.getUTCDay());
  }
  return days.size;
}

/** 사용한 기분 태그 종류 */
function countMoodVariety(entries: JournalEntry[]): number {
  const moods = new Set<string>();
  for (const entry of entries) {
    for (const label of entry.moodLabels ?? []) moods.add(label);
    if (entry.moodLabel) moods.add(entry.moodLabel);
  }
  return moods.size;
}

/** 기록한 날들의 간지 종류 (0~60) */
function countCollectedGanji(dates: string[]): number {
  const indices = new Set<number>();
  for (const date of dates) {
    try {
      indices.add(getPillarsForDate(date).dayPillar.ganjiIndex);
    } catch {
      // 계산 못 하는 날짜는 세지 않는다
    }
  }
  return indices.size;
}

export function buildHomeCompletion(opts: {
  pillars: SajuProfilePillars | null | undefined;
  entries: JournalEntry[];
}): HomeCompletion | null {
  if (!opts.pillars) return null;

  let natal;
  try {
    natal = buildNatalSummary(opts.pillars);
  } catch {
    return null;
  }

  const records = toDayRecords(opts.entries);
  const dates = records.map((r) => r.date);

  // 기록이 있는 날만 사주 사실을 계산한다 (없는 날은 판정에 쓰이지 않는다)
  const factsByDate = new Map<string, DayFacts>();
  for (const date of dates) {
    try {
      factsByDate.set(date, buildDayFacts(date, opts.pillars, natal));
    } catch {
      // 이 날짜는 건너뛴다
    }
  }

  const rules = generateHypotheses(natal);
  const cards = evaluateAll(rules, records, factsByDate);

  const completion = computeCompletion({
    recordedDays: dates.length,
    cards,
    collectedGanji: countCollectedGanji(dates),
    weekdayCoverage: countWeekdays(dates),
    moodVariety: countMoodVariety(opts.entries),
    moodTotal: MOOD_OPTIONS.length,
    // 요일별로 몇 번씩 겪었는지 세려면 날짜가 필요하다
    recordDates: dates,
  });

  const todayPatterns = findTodayPatterns({
    cards,
    pillars: opts.pillars,
    natal,
  });

  // 내일 — 같은 함수에 날짜만 바꿔 넣는다
  const tomorrowDate = nextDay(todayDateString());
  const tomorrowPatterns = findTodayPatterns({
    cards,
    pillars: opts.pillars,
    natal,
    date: tomorrowDate,
  });
  let tomorrowGanjiKo = "";
  try {
    tomorrowGanjiKo = getPillarsForDate(tomorrowDate).dayPillar.ganjiKo;
  } catch {
    // 간지를 못 구해도 나머지는 보여준다
  }

  return {
    completion,
    cards,
    waitingCount: cards.filter((c) => c.status === "collecting").length,
    todayPatterns,
    todayLine: todayPatternLine(todayPatterns),
    todayYongsin: buildTodayYongsin({ pillars: opts.pillars }),
    tomorrow: {
      date: tomorrowDate,
      ganjiKo: tomorrowGanjiKo,
      patterns: tomorrowPatterns,
      line: todayPatternLine(tomorrowPatterns),
      dayTitle: tomorrowPatterns[0]?.dayTitle ?? null,
    },
  };
}
