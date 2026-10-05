import { fortuneVoteAction } from "@/app/actions";
import type { FortuneContent } from "@/lib/fortune/types";

interface Props {
  fortune: FortuneContent;
  /** 로그인한 사용자만 투표할 수 있다 */
  canVote: boolean;
  vote: 1 | -1 | null;
  /** 기본으로 펼쳐 둘지 (낮에는 펼침) */
  defaultOpen: boolean;
}

/**
 * 오늘의 운세. 한지 위에 놓인 밤하늘 패널.
 * 접힘/펼침은 details 요소로 처리해 자바스크립트 없이도 열린다.
 * 열리는 전환은 globals.css의 .fortune-body (디자인 명세 02).
 */
export function FortuneCard({ fortune, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  const filled = Math.max(0, Math.min(10, Math.round(fortune.score)));
  return (
    <details open={defaultOpen} className="group card-frame sky-panel text-sky-ink">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm text-sky-muted">오늘의 운세</span>
          <span className="mt-1 block text-lg font-bold">
            <span className="group-open:hidden">열어 보기</span>
            <span className="hidden group-open:inline">
              {fortune.band} <span className="font-normal text-sky-muted">·</span> {scoreText}
              <span className="text-sm font-normal text-sky-muted">/10</span>
            </span>
          </span>
        </span>
        <span aria-hidden className="text-2xl text-gold transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="fortune-body">
        <div>
          <div className="px-5 pb-5">
            {/* 점수 눈금: 0~10 열 칸, 점수까지 금색. 색으로 길흉을 말하지 않는다 */}
            <div aria-hidden className="mb-5 flex gap-1">
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`h-0.5 flex-1 rounded-full ${i < filled ? "bg-gold" : "bg-sky-muted/30"}`} />
              ))}
            </div>

            <h2 className="border-l-2 border-gold pl-3 font-serif text-[22px] font-bold leading-snug">{fortune.headline}</h2>
            <p className="mt-3 text-[16px] leading-[1.6] text-sky-ink/90">{fortune.body}</p>

            <dl className="mt-5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-[15px]">
              <dt className="text-sky-muted">하면 좋아요</dt>
              <dd>{fortune.do}</dd>
              <dt className="text-sky-muted">피해요</dt>
              <dd className="text-sky-ink/80">{fortune.dont}</dd>
            </dl>

            {/* 카드 안 붓선은 이 한 곳뿐 — 표와 맨 아래 흐린 한 줄 사이 */}
            <span aria-hidden className="rule rule--light mt-5" />
            <p className="mt-4 text-sm text-sky-muted">
              {fortune.personal.n > 0
                ? `내 기록 ${fortune.personal.n}일이 오늘 점수의 ${Math.round(fortune.personal.weight * 100)}%를 정했어요 · 맞춤도 ${fortune.fitPercent}%`
                : "아직 내 기록이 없어 사주만으로 계산했어요"}
            </p>

            {canVote && (
              <form action={fortuneVoteAction} className="mt-4 flex items-center gap-2 text-sm text-sky-muted">
                <input type="hidden" name="date" value={fortune.date} />
                <span className="mr-1">오늘과 맞았어요?</span>
                <button
                  type="submit"
                  name="vote"
                  value="1"
                  aria-pressed={vote === 1}
                  className={`h-9 rounded-full border px-4 ${vote === 1 ? "border-gold text-gold" : "border-sky-muted/50 text-sky-ink"}`}
                >
                  맞아요
                </button>
                <button
                  type="submit"
                  name="vote"
                  value="-1"
                  aria-pressed={vote === -1}
                  className={`h-9 rounded-full border px-4 ${vote === -1 ? "border-gold text-gold" : "border-sky-muted/50 text-sky-ink"}`}
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
