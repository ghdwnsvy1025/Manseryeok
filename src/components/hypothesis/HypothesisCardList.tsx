"use client";

/**
 * 나에게 오는 날들 — 카드 목록 (겉껍데기 없음).
 *
 * 같은 목록을 두 곳에서 쓴다.
 *   · 홈에서 띄우는 전체화면 시트 (HypothesisDeckSheet)
 *   · "나" 탭 안의 한 구역 (MePage)
 *
 * 설계 원칙
 *
 * 1. **상태를 사주가 아니라 사용자로 말한다.**
 *    "맞았습니다"는 사주가 주어인 말이라, 사용자가 궁금한
 *    "그래서 이런 날 나는 어떤데?"에 답하지 못한다.
 *
 * 2. **목록은 훑는 곳, 상세는 읽는 곳.**
 *    한 장에 3줄만 두고, 긴 문장과 근거 수치는 눌렀을 때 펼친다.
 *
 * 3. **같은 날짜는 한 곳에 모은다.** (2026-09-11 사장님 지적)
 *    전에는 날짜를 맨 왼쪽 첫 칸에 두고 정렬은 '차이 큰 순'으로 했다.
 *    그러면 `9/16, 9/13, 9/13, 9/11, 9/13…` 처럼 보여서 **고장 난 목록**으로 읽힌다.
 *    실제로는 9/13(경인일) 하나가 세 조건에 동시에 걸린 것이다.
 *    날짜로 묶으면 그 사실이 오히려 정보가 된다 — "9/13은 나한테 세 겹으로 오는 날".
 *
 *    다만 **확인 중인 카드는 묶지 않는다.** 아직 모르는 날을 "이 날은 3가지"에
 *    같이 세면 확정된 것처럼 보인다. 아래 별도 구역으로 내린다.
 */
import { useMemo, useState } from "react";
import type { SajuProfilePillars } from "@/lib/diary/types";
import { getPillarsForDate, todayDateString } from "@/lib/diary/dayPillar";
import { buildNatalSummary } from "@/lib/hypothesis/natalSummary";
import {
  findWhenDays,
  frequencyLabel,
  shortDate,
  type WhenDays,
} from "@/lib/hypothesis/whenDays";
import {
  METRICS,
  type HypothesisCard,
} from "@/lib/hypothesis/types";
import { groupCardsByDay } from "@/lib/hypothesis/groupByDay";
import type { Day0Answers } from "@/lib/hypothesis/day0Answers";
import {
  compareDay0,
  summarizeDay0,
  type Day0Verdict,
} from "@/lib/hypothesis/day0Compare";

type Props = {
  cards: HypothesisCard[];
  /** 날짜 계산에 필요 — 없으면 날짜로 묶지 않고 한 줄로 늘어놓는다 */
  pillars?: SajuProfilePillars | null;
  /**
   * 첫날(Day 0) 짐작 — 있으면 확인이 끝난 카드 옆에 "내 짐작대로 / 달라요"를 붙인다.
   * 판정에는 쓰지 않는다. 대조만 한다 (day0Compare.ts).
   */
  day0?: Day0Answers | null;
};

/** 짐작 표시 색 — 같으면 금빛, 다르면 연보라(주의가 아니라 발견이라 빨강은 안 쓴다) */
const DAY0_CHIP_COLOR: Partial<Record<Day0Verdict, string>> = {
  match: "var(--px-accent)",
  differ: "#c9a7ff",
  found: "var(--px-text2)",
};

/** 이 카드가 사용자에게 무슨 일이 일어난다고 말하는가 */
export function userFact(card: HypothesisCard): {
  text: string;
  tone: "up" | "down" | "flat";
} {
  const meta = METRICS[card.rule.metric];
  if (card.status === "neutral") return { text: "차이 없어요", tone: "flat" };
  if (card.status === "collecting") return { text: "확인 중", tone: "flat" };

  // confirmed = 이론 방향대로, exception = 반대 방향
  const wentUp =
    card.status === "confirmed"
      ? card.rule.direction === "higher"
      : card.rule.direction !== "higher";

  return wentUp ? { text: meta.up, tone: "up" } : { text: meta.down, tone: "down" };
}

const TONE_COLOR = {
  up: "#4ade80",
  down: "#f87171",
  flat: "var(--px-text2)",
} as const;

export default function HypothesisCardList({ cards, pillars, day0 }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  // "이런 날이 언제인지" — 카드마다 한 번만 계산한다
  const whenByRule = useMemo(() => {
    const map = new Map<string, WhenDays>();
    if (!pillars) return map;
    try {
      const natal = buildNatalSummary(pillars);
      for (const card of cards) {
        map.set(
          card.rule.id,
          findWhenDays({ condition: card.rule.condition, pillars, natal })
        );
      }
    } catch {
      // 계산 실패해도 목록은 그대로 보여준다
    }
    return map;
  }, [cards, pillars]);

  const { groups, waiting } = useMemo(() => {
    const today = todayDateString();
    let todayGanjiKo: string | null = null;
    try {
      todayGanjiKo = getPillarsForDate(today).dayPillar.ganjiKo;
    } catch {
      todayGanjiKo = null;
    }
    return groupCardsByDay({ cards, whenByRule, today, todayGanjiKo });
  }, [cards, whenByRule]);

  const day0Summary = useMemo(() => summarizeDay0(cards, day0), [cards, day0]);

  if (cards.length === 0) {
    return (
      <p className="ui-guide p-2">
        생년월일을 등록하면 당신의 날들이 만들어집니다.
      </p>
    );
  }

  const renderCard = (card: HypothesisCard) => {
    const fact = userFact(card);
    const when = whenByRule.get(card.rule.id);
    const isOpen = openId === card.rule.id;
    const isException = card.status === "exception";
    const guess = compareDay0(card, day0);

    return (
      <article
        key={card.rule.id}
        style={{
          background: "var(--px-bg2)",
          border: "2px solid var(--px-border)",
          borderLeft: `4px solid ${TONE_COLOR[fact.tone]}`,
        }}
      >
        <button
          type="button"
          className="w-full text-left p-3 flex items-start gap-3"
          aria-expanded={isOpen}
          onClick={() => setOpenId(isOpen ? null : card.rule.id)}
        >
          <span className="flex-1 min-w-0 space-y-0.5">
            {/* 제목 줄 — 짐작 표시는 제목 옆에 붙여 한 장이 3줄을 넘지 않게 한다 */}
            <span className="flex items-baseline gap-1.5 min-w-0">
              <span
                className="text-sm font-bold truncate"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {card.rule.title}
              </span>
              {/*
                "내 짐작대로"는 목록에 붙이지 않는다. 대부분 카드에 반복돼 시끄럽고,
                놀라운 건 **달랐던** 카드다. 같았던 건 맨 위 요약 줄과 펼친 문장이 말한다.
              */}
              {guess.chip && guess.verdict !== "match" && (
                <span
                  className="shrink-0 text-[10px] font-bold px-1.5 py-px"
                  style={{
                    color: DAY0_CHIP_COLOR[guess.verdict],
                    background: "var(--px-bg3)",
                    borderRadius: 999,
                  }}
                >
                  {guess.chip}
                </span>
              )}
            </span>
            <span
              className="block text-sm font-bold"
              style={{ color: TONE_COLOR[fact.tone] }}
            >
              {fact.text}
              {isException && (
                <span
                  className="ml-1.5 text-[10px] font-medium align-middle"
                  style={{ color: "#60a5fa" }}
                >
                  사주 예상과 반대
                </span>
              )}
            </span>
            <span className="block ui-hint tabular-nums">
              {card.status === "collecting"
                ? `확인까지 ${card.evidence.matchedDays}/${card.evidence.needMatched}일`
                : `${METRICS[card.rule.metric].label} · ${card.evidence.matchedDays}일 기준`}
              {when && ` · ${frequencyLabel(when)}`}
            </span>
          </span>

          {/* 오른쪽 — 얼마나 */}
          <span
            className="text-sm font-black shrink-0 tabular-nums pt-0.5"
            style={{ color: TONE_COLOR[fact.tone] }}
          >
            {/*
              아직 확인 중인 카드에 ▲1 을 띄우면 확정된 카드와 똑같아 보인다.
              표본이 모자란 동안의 차이는 뒤집힐 수 있는 값이라 결과처럼 보이면 안 된다.
            */}
            {card.status === "collecting"
              ? `${Math.round(card.progress * 100)}%`
              : card.evidence.gap != null
                ? `${card.evidence.gap > 0 ? "▲" : "▼"}${Math.abs(card.evidence.gap)}`
                : "—"}
          </span>
        </button>

        {/* 눌렀을 때만 — 긴 문장과 근거 */}
        {isOpen && (
          // 펼친 부분은 점선 대신 위 여백으로 구분한다
          <div className="px-3 pb-3 pt-1 space-y-2">
            {guess.sentence && (
              <p
                className="text-xs font-bold leading-relaxed pt-2"
                style={{
                  color: DAY0_CHIP_COLOR[guess.verdict] ?? "var(--px-text2)",
                }}
              >
                {guess.sentence}
              </p>
            )}
            <p className="ui-hint leading-relaxed pt-2">{card.headline}</p>

            {card.evidence.gap != null && (
              <p className="ui-hint tabular-nums">
                해당한 날 {card.evidence.matchedDays}일 평균{" "}
                {card.evidence.matchedMean} · 그 외 평균{" "}
                {card.evidence.unmatchedMean}
              </p>
            )}

            <p className="ui-hint leading-relaxed">{card.rule.copy.basis}</p>

            {when && when.upcoming.length > 0 && (
              <p className="ui-hint tabular-nums">
                다음 날들 · {when.upcoming.map(shortDate).join("  ")}
              </p>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-4">
      {/* 첫날 짐작 vs 기록 한 줄 — 대조할 카드가 2장 이상일 때만 */}
      {day0Summary.line && (
        <p
          className="text-sm font-bold leading-relaxed px-3 py-2.5"
          style={{
            color: "var(--px-text-on-panel)",
            background: "var(--px-bg3)",
            borderRadius: 12,
          }}
        >
          {day0Summary.line}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.label || "flat"} className="space-y-2">
          {g.label && (
            <div className="flex items-baseline gap-2 px-0.5">
              <span
                className="text-sm font-black tabular-nums"
                style={{
                  color: g.isToday ? "var(--px-accent)" : "var(--px-text)",
                }}
              >
                {g.label}
              </span>
              {g.ganjiKo && <span className="ui-hint">{g.ganjiKo}일</span>}
              {/*
                여러 개가 같은 날인 이유를 여기서 밝힌다.
                하루가 여러 종류인 게 이상한 게 아니라 이 앱이 아는 사실이다.
              */}
              {g.cards.length > 1 && (
                <span
                  className="text-xs font-bold ml-auto shrink-0"
                  style={{ color: "var(--px-text2)" }}
                >
                  이 날은 {g.cards.length}가지
                </span>
              )}
            </div>
          )}
          <div className="space-y-2">{g.cards.map(renderCard)}</div>
        </section>
      ))}

      {waiting.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline gap-2 px-0.5 pt-1">
            <span
              className="text-sm font-black"
              style={{ color: "var(--px-text2)" }}
            >
              아직 확인 중
            </span>
            <span className="ui-hint">기록이 더 쌓이면 여기서 올라와요</span>
          </div>
          <div className="space-y-2">{waiting.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}
