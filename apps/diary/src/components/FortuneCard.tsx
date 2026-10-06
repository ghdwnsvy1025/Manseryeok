import { Fragment } from "react";
import { fortuneVoteAction } from "@/app/actions";
import { AREA_WORD } from "@/lib/fortune/core";
import type { AreaSignal, FortuneContent } from "@/lib/fortune/types";

/** 화살표 색: ↑ 금색, → 보조, ↓ 먹색. 빨강 없음 (톤 결정표 "길흉을 색으로 말하지 않는다") */
const SIGNAL_COLOR: Record<AreaSignal, string> = { "↑": "text-gold", "→": "text-muted", "↓": "text-ink" };
const SIGNAL_WORD: Record<AreaSignal, string> = { "↑": "좋아요", "→": "보통이에요", "↓": "조심해요" };

interface Props {
  fortune: FortuneContent;
  /** 카드 머리에 들어가는 날짜 ("10월 5일") */
  dateLabel: string;
  /** 카드 머리에 들어가는 간지 한글 ("임자"). 카드 머리 오른쪽 동물 그림도 이 이름으로 찾는다 */
  ganjiKo: string;
  /** 로그인한 사용자만 투표할 수 있다 */
  canVote: boolean;
  vote: 1 | -1 | null;
  /** 기본으로 펼쳐 둘지 */
  defaultOpen: boolean;
}

/**
 * 오늘의 운세. 한지 카드에 금색 이중 테두리 (톤 v3.1 — 밤 패널 없음).
 * 이 화면에서 그림이 있는 카드는 이것뿐: 머리 오른쪽에 그날 일진의 동물(바이럴 60갑자 세트) 하나.
 * 닫혀 있어도 날짜·간지와 밴드 단어·동물까지는 보이고, 숫자·눈금·본문은 열어야 보인다.
 * 접힘/펼침은 details 요소로 처리해 자바스크립트 없이도 열린다.
 * 열리는 전환은 globals.css의 .fortune-body (디자인 명세 02).
 */
export function FortuneCard({ fortune, dateLabel, ganjiKo, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  const filled = Math.max(0, Math.min(10, Math.round(fortune.score)));
  const areas = (fortune.areas ?? []).slice(0, 3);
  return (
    <details open={defaultOpen} className="group card-gold card-paper text-ink">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-muted">
            {dateLabel} · {ganjiKo}일의 운세
          </span>
          {/* 카드의 주인공 — 밴드 단어. 좋음/무난/주의 모두 같은 색, 색으로 길흉을 말하지 않는다 */}
          <span className="mt-1 block font-serif text-[44px] leading-none">{fortune.band}</span>
        </span>
        {/* 이 화면의 유일한 그림 — 그날 일진의 동물 */}
        <img
          src={`/characters/${ganjiKo}.webp`}
          alt={`${ganjiKo} 동물`}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 object-contain"
        />
        <span aria-hidden className="mt-1 text-2xl leading-none text-gold transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="fortune-body">
        <div>
          <div className="px-5 pb-5">
            {/* 점수 눈금: 0~10 열 칸, 점수까지 금색. 숫자는 오른쪽에 작게 */}
            <div className="mb-5 flex items-center gap-3">
              <div aria-hidden className="flex flex-1 gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < filled ? "bg-gold" : "bg-line/20"}`} />
                ))}
              </div>
              <span className="font-serif text-[17px] tabular-nums">
                {scoreText}
                <span className="text-[13px] text-muted">/10</span>
              </span>
            </div>

            <h2 className="border-l-2 border-gold pl-3 font-serif text-[24px] leading-snug">{fortune.headline}</h2>
            <p className="mt-3 text-[16px] leading-[1.7] text-ink/90">{fortune.body}</p>

            {/* 영역 줄 (v4): 신호 있는 영역 1~3개. 화살표는 글자, 색으로 길흉을 말하지 않는다(↓도 ink) */}
            {areas.length > 0 && (
              <dl className="mt-5 grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-2 text-[16px] leading-[1.5]">
                {areas.map((a) => (
                  <Fragment key={a.area}>
                    <dt className="flex items-baseline gap-1.5 font-serif text-[17px] text-ink">
                      <span>{AREA_WORD[a.area]}</span>
                      <span aria-hidden className={SIGNAL_COLOR[a.signal]}>
                        {a.signal}
                      </span>
                      <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
                    </dt>
                    <dd className="min-w-0 break-keep text-ink/90">{a.line}</dd>
                  </Fragment>
                ))}
              </dl>
            )}

            <dl className="mt-5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-[15px]">
              <dt className="text-muted">하면 좋아요</dt>
              <dd>{fortune.do}</dd>
              <dt className="text-muted">피해요</dt>
              <dd className="text-ink/85">{fortune.dont}</dd>
            </dl>

            {/* 카드 안 붓선은 이 한 곳뿐 — 표와 맨 아래 흐린 한 줄 사이 */}
            <span aria-hidden className="rule rule--light mt-5" />
            <p className="mt-4 text-sm text-muted">
              {fortune.personal.n > 0
                ? `내 기록 ${fortune.personal.n}일이 오늘 점수의 ${Math.round(fortune.personal.weight * 100)}%를 정했어요 · 맞춤도 ${fortune.fitPercent}%`
                : "아직 내 기록이 없어 사주만으로 계산했어요"}
              {fortune.fitNote ? ` · ${fortune.fitNote}` : null}
            </p>

            {canVote && (
              <form action={fortuneVoteAction} className="mt-4 flex items-center gap-2 text-sm text-muted">
                <input type="hidden" name="date" value={fortune.date} />
                <span className="mr-1">오늘과 맞았어요?</span>
                <button
                  type="submit"
                  name="vote"
                  value="1"
                  aria-pressed={vote === 1}
                  className={`h-9 rounded-full border px-4 ${vote === 1 ? "border-gold font-bold text-ink" : "border-frame/50 text-ink"}`}
                >
                  맞아요
                </button>
                <button
                  type="submit"
                  name="vote"
                  value="-1"
                  aria-pressed={vote === -1}
                  className={`h-9 rounded-full border px-4 ${vote === -1 ? "border-gold font-bold text-ink" : "border-frame/50 text-ink"}`}
                >
                  아니에요
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
