/**
 * "나에게 오는 날들" 카드를 **같은 날짜끼리 묶는다.**
 *
 * 왜 필요한가 (2026-09-11 사장님 지적) —
 * 전에는 날짜를 카드 맨 왼쪽 첫 칸에 두고 정렬은 '차이 큰 순'으로 했다.
 * 그러면 `9/16, 9/13, 9/13, 9/11, 9/13…` 처럼 보여 **고장 난 목록**으로 읽힌다.
 *
 * 실제로는 9/13(경인일) **하루가 세 조건에 동시에 걸린 것**이다.
 * 庚(일간과 같음) · 寅(목) 이 한 날에 겹치니 당연한 일이고,
 * 묶어서 보여주면 오히려 정보가 된다 — "9/13은 나한테 세 겹으로 오는 날".
 *
 * 확인 중인 카드는 묶지 않는다. 아직 모르는 날을 "이 날은 3가지"에 같이 세면
 * 확정된 것처럼 보인다. 별도 구역으로 내린다.
 *
 * 화면이 아니라 여기에 두는 이유 — 컴포넌트 안에 있으면 테스트를 못 한다.
 */
import type { HypothesisCard } from "./types";
import type { WhenDays } from "./whenDays";
import { shortDate } from "./whenDays";

export type DayGroup = {
  /** 정렬·키용 날짜. 언제인지 모르면 null */
  date: string | null;
  isToday: boolean;
  /** "오늘" 또는 "9/13". 묶지 않은 경우 빈 문자열 */
  label: string;
  /** "경인" — 왜 여러 개가 같은 날인지 설명해 주는 값 */
  ganjiKo: string | null;
  cards: HypothesisCard[];
};

export type GroupedCards = {
  groups: DayGroup[];
  /** 아직 확인 중 — 날짜로 묶지 않는다 */
  waiting: HypothesisCard[];
};

/** 차이 크기 (없으면 0) */
function gapOf(card: HypothesisCard): number {
  return Math.abs(card.evidence.gap ?? 0);
}

export function groupCardsByDay(opts: {
  cards: HypothesisCard[];
  /** rule.id → 언제 오는가. 비어 있으면 묶지 않는다 */
  whenByRule: Map<string, WhenDays>;
  /** 오늘 날짜 (YYYY-MM-DD) */
  today: string;
  /** 오늘의 간지 — 못 구하면 null */
  todayGanjiKo: string | null;
}): GroupedCards {
  const settled = opts.cards.filter((c) => c.status !== "collecting");
  const waiting = opts.cards
    .filter((c) => c.status === "collecting")
    .sort((a, b) => b.progress - a.progress);

  // 날짜를 못 구하면 한 덩어리로 (기존 동작과 같게)
  if (opts.whenByRule.size === 0) {
    const flat = [...settled].sort((a, b) => gapOf(b) - gapOf(a));
    return {
      groups: flat.length
        ? [{ date: null, isToday: false, label: "", ganjiKo: null, cards: flat }]
        : [],
      waiting,
    };
  }

  const byKey = new Map<string, DayGroup>();
  for (const card of settled) {
    const when = opts.whenByRule.get(card.rule.id);
    const isToday = Boolean(when?.isToday);
    const date = isToday ? opts.today : (when?.nextDate ?? null);
    const key = isToday ? "today" : (date ?? "none");

    let group = byKey.get(key);
    if (!group) {
      group = {
        date,
        isToday,
        label: isToday ? "오늘" : date ? shortDate(date) : "한 달 안엔 없어요",
        ganjiKo: isToday ? opts.todayGanjiKo : (when?.nextGanjiKo ?? null),
        cards: [],
      };
      byKey.set(key, group);
    }
    group.cards.push(card);
  }

  const groups = [...byKey.values()].sort((a, b) => {
    // 오늘이 언제나 맨 앞
    if (a.isToday !== b.isToday) return a.isToday ? -1 : 1;
    // 언제인지 모르는 것은 맨 뒤
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  for (const g of groups) {
    g.cards.sort((a, b) => gapOf(b) - gapOf(a));
  }

  return { groups, waiting };
}
