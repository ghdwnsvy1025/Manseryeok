import { Fragment } from "react";
import { fortuneVoteAction } from "@/app/actions";
import { AREA_WORD } from "@/lib/fortune/core";
import type { AreaSignal, FortuneContent } from "@/lib/fortune/types";

/** 화살표 색: ↑ 금색, → 보조, ↓ 먹색. 빨강 없음 (톤 결정표 "길흉을 색으로 말하지 않는다") */
const SIGNAL_COLOR: Record<AreaSignal, string> = { "↑": "text-gold", "→": "text-muted", "↓": "text-ink" };
const SIGNAL_WORD: Record<AreaSignal, string> = { "↑": "좋아요", "→": "보통이에요", "↓": "조심해요" };
type Period = "오늘" | "이달" | "올해";

/** 받침 유무 — 조사 고르기 */
function batchim(s: string): boolean {
  const code = s.charCodeAt(s.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/**
 * "내 기록으로 본 오늘" 문장 (02 v3.2). 컴포넌트에서 조립한다.
 * 같은 간지 기록이 있으면 "계축일에 N번 기록 · 평균 M", 없으면 "계나 축이 든 날에 N번 · 평균 M",
 * 둘 다 없으면 "아직 기록이 없어 사주만으로 계산했어요".
 * 비교 문장은 |M×(10/9) − score| ≥ 1.5일 때만.
 */
function personalLines(fortune: FortuneContent, ganjiKo: string): { main: string; compare: string | null } {
  const p = fortune.personal;
  const stem = ganjiKo.slice(0, 1);
  const branch = ganjiKo.slice(1);
  let main: string;
  let mean: number | null = null;
  if (p.sameGanjiCount > 0 && p.sameGanjiMean !== null) {
    mean = p.sameGanjiMean;
    main = `${ganjiKo}일에 ${p.sameGanjiCount}번 기록 · 평균 ${mean.toFixed(1)}`;
  } else if (p.n > 0 && p.mean !== null) {
    mean = p.mean;
    main = `${stem}${batchim(stem) ? "이나" : "나"} ${branch}${batchim(branch) ? "이" : "가"} 든 날에 ${p.n}번 · 평균 ${mean.toFixed(1)}`;
  } else {
    return { main: "아직 기록이 없어 사주만으로 계산했어요", compare: null };
  }
  const scaled = mean * (10 / 9);
  const gap = scaled - fortune.score;
  const compare =
    Math.abs(gap) >= 1.5 ? `사주 점수는 ${fortune.score.toFixed(1)}이지만 내 기록은 ${gap > 0 ? "좋은" : "낮은"} 편` : null;
  return { main, compare };
}

interface Props {
  fortune: FortuneContent;
  /** 카드 머리에 들어가는 날짜 ("10월 5일") */
  dateLabel: string;
  /** 카드 머리에 들어가는 간지 한글 ("임자"). 글자로만 쓴다 (그림 없음, v3.3) */
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
 * 닫혀 있어도 날짜·간지와 밴드 단어·점수까지는 보이고, 본문은 열어야 보인다 (v3.4: 눈금 없음, 숫자가 주인공).
 * 접힘/펼침은 details 요소로 처리해 자바스크립트 없이도 열린다.
 * 열리는 전환은 globals.css의 .fortune-body (디자인 명세 02).
 * v3.2: 본문 아래 "내 기록으로 본 오늘" 블록, 맨 아래 "왜 이런 운세인가요?" details.
 * v3.4: 영역 줄(오늘/이달/올해)과 하면/피해요가 "오늘의 신호" 상자 하나에 같은 모양의 띠지로 들어간다.
 */
export function FortuneCard({ fortune, dateLabel, ganjiKo, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  /** 영역 줄 최대 4 (오늘 ≤2 · 이달 1 · 올해 1). period는 기능 쪽이 곧 넣는다 — 없으면 "오늘" */
  const areas = (fortune.areas ?? []).slice(0, 4).map((a) => ({ ...a, period: (a as { period?: Period }).period ?? "오늘" }));
  const personal = personalLines(fortune, ganjiKo);
  const facts = (fortune.core?.facts ?? fortune.base?.facts ?? []).slice(0, 10);
  return (
    <details open={defaultOpen} className="group card-gold card-paper text-ink">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-muted">
            {dateLabel} · {ganjiKo}일의 운세
          </span>
          {/* 카드의 주인공 — 밴드 단어 + 점수 (v3.4). 좋음/무난/주의 모두 같은 색, 색으로 길흉을 말하지 않는다 */}
          <span className="mt-1 flex items-baseline gap-3 font-serif leading-none">
            <span className="text-[44px]">{fortune.band}</span>
            <span className="text-[32px] tabular-nums">
              {scoreText}
              <span className="font-sans text-[14px] text-muted">/10</span>
            </span>
          </span>
        </span>
        {/* 그날 동물은 없다 (v3.3) — 그림은 제목 옆 내 캐릭터 하나. 머리 오른쪽은 +/×만 */}
        <span aria-hidden className="mt-1 text-2xl leading-none text-gold transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="fortune-body">
        <div>
          <div className="px-5 pb-5">
            <h2 className="border-l-2 border-gold pl-3 font-serif text-[24px] leading-snug">{fortune.headline}</h2>
            <p className="mt-3 text-[16px] leading-[1.7] text-ink/90">{fortune.body}</p>

            {/* 내 기록으로 본 오늘 (v3.2): 한지보다 한 단계 어두운 네모. 기록이 없으면 같은 자리에 사주만으로 계산했다는 말 */}
            <div className="mt-5 rounded-[4px] bg-paper-3 px-4 py-3">
              <p className="text-[13px] text-muted">내 기록으로 본 오늘</p>
              <p className="mt-1 text-[16px] leading-[1.6] text-ink">{personal.main}</p>
              {personal.compare && <p className="mt-0.5 text-[15px] leading-[1.6] text-ink/85">{personal.compare}</p>}
              {fortune.fitNote && <p className="mt-1 text-[14px] leading-[1.6] text-muted">{fortune.fitNote}</p>}
            </div>

            {/* 오늘의 신호 (v3.4): 한 상자에 같은 띠지. 영역 = 먹색 테두리, 하면 좋아요 = 금색 면, 피해요 = 먹색 면.
                화살표는 글자, 색으로 길흉을 말하지 않는다(↓도 ink) */}
            <dl className="signal-box mt-5 grid grid-cols-[7rem_1fr] items-start gap-x-3 gap-y-2.5 text-[16px] leading-[1.5]">
              {areas.map((a) => (
                <Fragment key={`${a.period}-${a.area}`}>
                  <dt className="sig sig--line">
                    <span className="text-muted">{a.period}</span>
                    <span aria-hidden className="mx-1 text-faint">·</span>
                    <span>{AREA_WORD[a.area]}</span>
                    <span aria-hidden className={`ml-1 ${SIGNAL_COLOR[a.signal]}`}>
                      {a.signal}
                    </span>
                    <span className="sr-only">{SIGNAL_WORD[a.signal]}</span>
                  </dt>
                  <dd className="min-w-0 break-keep pt-1 text-ink/90">{a.line}</dd>
                </Fragment>
              ))}
              <dt className="sig sig--gold">하면 좋아요</dt>
              <dd className="min-w-0 break-keep pt-1">{fortune.do}</dd>
              <dt className="sig sig--ink">피해요</dt>
              <dd className="min-w-0 break-keep pt-1 text-ink/85">{fortune.dont}</dd>
            </dl>

            {/* 카드 안 붓선은 이 한 곳뿐 — 띠지와 맨 아래(투표·근거) 사이 */}
            <span aria-hidden className="rule rule--light mt-5" />

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

            {/* 왜 이런 운세인가요? — core.facts 6~10줄, 왼쪽 금색 세로선 (v3.2) */}
            {facts.length > 0 && (
              <details className="group/why mt-4">
                <summary className="cursor-pointer list-none text-[15px] text-muted underline underline-offset-4 [&::-webkit-details-marker]:hidden">
                  왜 이런 운세인가요?
                </summary>
                <ul className="mt-3 flex flex-col gap-1.5 border-l-2 border-gold pl-3 text-[14px] leading-[1.6] text-muted">
                  {facts.map((f, i) => (
                    <li key={i} className="break-keep">
                      {f}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
