/**
 * 오늘이 용신일인가 — 운세와 홈에 쓴다.
 *
 * 왜 `verifiedDayPatterns` 에 같이 넣지 않는가 —
 * 그 자리는 **이 사람 기록으로 확인된 사실**만 들어간다. 용신일은 기록이 하나도
 * 없어도 알 수 있는 **사주 이론**이다. 둘을 한 통에 담으면 검증 안 된 이론이
 * 검증된 사실 행세를 하게 되고, 그건 이 앱이 하지 않기로 한 일이다.
 *
 * 그래서 층을 따로 둔다.
 *   확인된 것   → verifiedDayPatterns (우선순위 0, 이론을 이긴다)
 *   용신일      → todayYongsin        (우선순위 1.5, 이론 중 가장 큰 것)
 *
 * 용신 카드가 나중에 확인되면 그 결과가 위층으로 올라가고, 여기 문장은
 * 자연히 뒤로 밀린다. "사주가 말한다 → 기록이 답한다"가 그렇게 완성된다.
 */
import type { SajuProfilePillars } from "@/lib/diary/types";
import { todayDateString } from "@/lib/diary/dayPillar";

import { buildNatalSummary } from "./natalSummary";
import { buildDayFacts } from "./dayFacts";

export type TodayYongsin = {
  date: string;
  /** 오늘 일주에 용신 간지가 들어왔는가 */
  isYongsinDay: boolean;
  /** "물(水)" */
  elementWord: string;
  /** 용신 간지 (한자) */
  ganjiHanja: string[];
  /** 이미 원국(T존) 안에 있는 용신인가 */
  fromTZone: boolean;
  /**
   * 홈 큰 제목에 쓸 두 줄.
   * 용신일이 아니면 null — 부르는 쪽에서 이 기능만 건너뛴다.
   */
  headline: string | null;
  /** 그 아래 작은 줄 */
  subline: string | null;
  /** LLM 에 넘길 사실 문장 (사용자에게 안 보임) */
  fact: string | null;
};

const ELEMENT_WORD: Record<string, string> = {
  목: "나무(木)",
  화: "불(火)",
  토: "흙(土)",
  금: "쇠(金)",
  수: "물(水)",
};

export function buildTodayYongsin(opts: {
  pillars: SajuProfilePillars | null | undefined;
  date?: string;
}): TodayYongsin | null {
  if (!opts.pillars) return null;
  const date = opts.date ?? todayDateString();

  try {
    const natal = buildNatalSummary(opts.pillars);
    const y = natal.yongsin;
    if (!y) return null;

    const facts = buildDayFacts(date, opts.pillars, natal);
    const elementWord = ELEMENT_WORD[y.elementKo] ?? y.elementKo;

    if (!facts.isYongsin) {
      return {
        date,
        isYongsinDay: false,
        elementWord,
        ganjiHanja: y.ganjiHanja,
        fromTZone: y.fromTZone,
        headline: null,
        subline: null,
        fact: null,
      };
    }

    return {
      date,
      isYongsinDay: true,
      elementWord,
      ganjiHanja: y.ganjiHanja,
      fromTZone: y.fromTZone,
      // 홈 큰 제목은 두 줄. 사주 용어를 쓰지 않는다.
      headline: "힘을 보태 주는\n기운이 들어와요",
      subline: `${elementWord} 기운이 오는 날`,
      // LLM 입력 — 여기는 내부 용어를 써도 된다
      fact:
        `오늘은 이 사람의 용신(${elementWord})이 일진에 들어오는 날이다. ` +
        `용신은 원국에서 가장 많은 ${ELEMENT_WORD[y.dominantKo] ?? y.dominantKo}(${y.dominantPercent}%)를 눌러 균형을 잡는 기운이다. ` +
        (y.fromTZone
          ? "이 사람 원국의 T존에 이미 있는 글자라 작용이 더 직접적이다."
          : "원국에는 없던 기운이라 그날 밖에서 채워지는 형태다."),
    };
  } catch {
    return null;
  }
}
