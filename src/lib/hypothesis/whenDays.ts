/**
 * "그 날이 대체 언제인데?" — 카드가 가리키는 날짜를 실제로 찾아준다.
 *
 * 이게 없으면 카드는 쓸모가 없다. "역할이 주어지는 날"이라고만 하면
 * 사용자는 오늘이 그 날인지도, 다음이 언제인지도 알 수 없다.
 * (제품 주인도 못 알아봤다 — 그게 이 파일이 생긴 이유다.)
 *
 * 저장하지 않는다. 생년월일과 날짜만 있으면 항상 같은 답이 나오므로 매번 계산한다.
 */
import { getPillarsForDate, todayDateString } from "@/lib/diary/dayPillar";
import type { SajuProfilePillars } from "@/lib/diary/types";

import { buildDayFacts, matchesCondition } from "./dayFacts";
import type { DayCondition, NatalSummary } from "./types";

/** 앞으로 며칠까지 내다볼지 — 한 달이면 "이달에 며칠"을 말하기 충분하다 */
export const LOOKAHEAD_DAYS = 30;

export type WhenDays = {
  /** 오늘이 그 날인가 */
  isToday: boolean;
  /** 다음에 오는 그 날 (오늘 제외). 30일 안에 없으면 null */
  nextDate: string | null;
  /** 그날의 간지 (예: "정해") */
  nextGanjiKo: string | null;
  /** 앞으로 30일 중 며칠이 해당하는가 */
  countAhead: number;
  /** 가까운 순서로 최대 6개 */
  upcoming: string[];
};

function addDays(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T00:00:00Z`);
  const next = new Date(base.getTime() + days * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${p(next.getUTCMonth() + 1)}-${p(next.getUTCDate())}`;
}

/**
 * 이 조건에 해당하는 날이 언제인지 찾는다.
 *
 * @param from 기준일 (기본: 오늘)
 */
export function findWhenDays(opts: {
  condition: DayCondition;
  pillars: SajuProfilePillars;
  natal: NatalSummary;
  from?: string;
  lookahead?: number;
}): WhenDays {
  const start = opts.from ?? todayDateString();
  const span = opts.lookahead ?? LOOKAHEAD_DAYS;

  const hits: string[] = [];
  let isToday = false;

  for (let i = 0; i <= span; i += 1) {
    const date = addDays(start, i);
    let facts;
    try {
      facts = buildDayFacts(date, opts.pillars, opts.natal);
    } catch {
      continue;
    }
    if (!matchesCondition(facts, opts.condition)) continue;

    if (i === 0) {
      isToday = true;
      continue; // 오늘은 upcoming 에 넣지 않는다
    }
    hits.push(date);
  }

  const nextDate = hits[0] ?? null;
  let nextGanjiKo: string | null = null;
  if (nextDate) {
    try {
      nextGanjiKo = getPillarsForDate(nextDate).dayPillar.ganjiKo;
    } catch {
      nextGanjiKo = null;
    }
  }

  return {
    isToday,
    nextDate,
    nextGanjiKo,
    countAhead: hits.length + (isToday ? 1 : 0),
    upcoming: hits.slice(0, 6),
  };
}

/** "9/13" 처럼 짧게 */
export function shortDate(dateStr: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  return `${Number(m[1])}/${Number(m[2])}`;
}

/** 목록 왼쪽에 붙일 한마디 — "오늘" 또는 다음 날짜 */
export function whenBadge(when: WhenDays): string {
  if (when.isToday) return "오늘";
  if (when.nextDate) return shortDate(when.nextDate);
  return "—";
}

/** "이달에 9일" 처럼 빈도를 한마디로 */
export function frequencyLabel(when: WhenDays): string {
  if (when.countAhead === 0) return "한 달 안엔 없어요";
  return `한 달에 ${when.countAhead}일`;
}
