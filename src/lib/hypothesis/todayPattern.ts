/**
 * 오늘에 해당하는 "확인된 날"만 골라낸다.
 *
 * 이 파일이 컨셉을 말에서 동작으로 바꾼다.
 * 지금까지는 카드를 다 뒤집어도 아무 데도 쓰이지 않았다. 기록이 운세에 주는 건
 * 말투뿐이었다(프롬프트 우선순위 6번 "diaryAssist — 기록 톤만").
 * 여기서 나온 결과가 홈 한 줄과 운세 생성에 함께 들어간다.
 *
 * 원칙
 * - **확인이 끝난 카드만** 쓴다. "확인 중"은 아직 사실이 아니다.
 * - **차이가 큰 순서**로 정렬한다. 미미한 것부터 말하면 인상이 흐려진다.
 * - 확인된 게 없으면 빈 배열 → 부르는 쪽에서 이 기능 전체를 건너뛴다(지금과 동일하게 동작).
 */
import type { SajuProfilePillars } from "@/lib/diary/types";
import { todayDateString } from "@/lib/diary/dayPillar";

import { buildDayFacts, matchesCondition } from "./dayFacts";
import { buildNatalSummary } from "./natalSummary";
import { generateHypotheses } from "./generate";
import { evaluateAll } from "./evaluate";
import { toDayRecords } from "./fromJournal";
import {
  METRICS,
  type DayFacts,
  type HypothesisCard,
  type MetricCode,
  type NatalSummary,
} from "./types";

export type TodayPattern = {
  ruleId: string;
  /** "역할이 주어지는 날" */
  dayTitle: string;
  metric: MetricCode;
  /** "집중이 잘 돼요" */
  fact: string;
  /** "집중이 잘 되고" — 문장 중간에 이을 때 */
  factConn: string;
  /** 올라가는 쪽인가 */
  up: boolean;
  /** 평소와의 차이 (절댓값) */
  gap: number;
  /** 근거가 된 날 수 */
  matchedDays: number;
  /** 사주 이론과 반대로 나온 것인가 — 이게 이 앱만의 문장이다 */
  isException: boolean;
};

/** 오늘 해당하는, 확인이 끝난 날들 */
export function findTodayPatterns(opts: {
  cards: HypothesisCard[];
  pillars: SajuProfilePillars;
  natal: NatalSummary;
  date?: string;
}): TodayPattern[] {
  const date = opts.date ?? todayDateString();

  let facts;
  try {
    facts = buildDayFacts(date, opts.pillars, opts.natal);
  } catch {
    return [];
  }

  const out: TodayPattern[] = [];

  for (const card of opts.cards) {
    // 확인 중이거나 차이가 없던 것은 오늘 할 말이 없다
    if (card.status !== "confirmed" && card.status !== "exception") continue;
    if (card.evidence.gap == null) continue;
    if (!matchesCondition(facts, card.rule.condition)) continue;

    const meta = METRICS[card.rule.metric];
    const up = card.evidence.gap > 0;

    out.push({
      ruleId: card.rule.id,
      dayTitle: card.rule.title,
      metric: card.rule.metric,
      fact: up ? meta.up : meta.down,
      factConn: up ? meta.upConn : meta.downConn,
      up,
      gap: Math.abs(card.evidence.gap),
      matchedDays: card.evidence.matchedDays,
      isException: card.status === "exception",
    });
  }

  // 차이가 큰 것부터
  return out.sort((a, b) => b.gap - a.gap);
}

/**
 * 홈에 띄울 한 줄.
 *
 * 두 개까지만 이어 붙인다. 셋을 넘기면 문장이 길어져서 안 읽힌다.
 * 예: "집중이 잘 되고, 마음이 편해요"
 */
export function todayPatternLine(patterns: TodayPattern[]): string | null {
  if (patterns.length === 0) return null;
  if (patterns.length === 1) return patterns[0]!.fact;

  // "집중이 잘 돼요" + "마음이 편해요" → "집중이 잘 되고, 마음이 편해요"
  //
  // 앞엣것만 연결형으로 바꾼다. 예전엔 `요` → `고` 규칙으로 만들었는데
  // "마음이 편해요"가 "마음이 편해고"로 나갔다. 지금은 지표마다 적어 둔 꼴을 쓴다.
  return `${patterns[0]!.factConn}, ${patterns[1]!.fact}`;
}

/**
 * 기록만 있으면 여기서 한 번에 계산한다 — 운세 API 등 서버에서 쓴다.
 *
 * 어떤 단계에서 실패해도 빈 배열을 돌려준다.
 * 이 기능 때문에 운세가 안 나오는 일은 없어야 한다.
 */
export function buildTodayPatternsFromEntries(opts: {
  pillars: SajuProfilePillars | null | undefined;
  entries: Parameters<typeof toDayRecords>[0];
  date?: string;
}): TodayPattern[] {
  if (!opts.pillars) return [];
  try {
    const natal = buildNatalSummary(opts.pillars);
    const records = toDayRecords(opts.entries);
    if (records.length === 0) return [];

    const factsByDate = new Map<string, DayFacts>();
    for (const record of records) {
      try {
        factsByDate.set(record.date, buildDayFacts(record.date, opts.pillars, natal));
      } catch {
        // 이 날짜는 건너뛴다
      }
    }

    const cards = evaluateAll(generateHypotheses(natal), records, factsByDate);
    return findTodayPatterns({ cards, pillars: opts.pillars, natal, date: opts.date });
  } catch {
    return [];
  }
}

/** 운세 생성에 넘길 사실 문장 — LLM 입력용 (사용자에게 안 보임) */
export function toFortuneFacts(patterns: TodayPattern[]): string[] {
  return patterns.map((p) => {
    const dir = p.up ? "높았다" : "낮았다";
    const note = p.isException ? " (사주 이론과는 반대 방향 — 본인 기록이 우선)" : "";
    return `${p.dayTitle}에 이 사람은 ${METRICS[p.metric].label}이(가) 평소보다 ${p.gap} ${dir}. 근거 ${p.matchedDays}일.${note}`;
  });
}
