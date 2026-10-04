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
 * 오늘의 운세. 접힘/펼침은 details 요소로 처리해 자바스크립트 없이도 열린다.
 * 디자인 명세 02에서 열리는 전환을 입힌다 (구조·name 값은 유지).
 */
export function FortuneCard({ fortune, canVote, vote, defaultOpen }: Props) {
  const scoreText = fortune.score.toFixed(1);
  return (
    <details open={defaultOpen} className="group rounded-3xl border border-line bg-surface open:border-lamp/60">
      <summary className="flex cursor-pointer list-none items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-sm text-muted">오늘의 운세</span>
          <span className="mt-1 block text-lg font-bold">
            <span className="group-open:hidden">열어 보기</span>
            <span className="hidden group-open:inline">
              {fortune.band} <span className="font-normal text-muted">·</span> {scoreText}
              <span className="text-sm font-normal text-faint">/10</span>
            </span>
          </span>
        </span>
        <span aria-hidden className="text-2xl text-lamp transition-transform group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="border-t border-line px-6 pb-6 pt-5">
        <h2 className="font-serif text-[22px] font-bold leading-snug">{fortune.headline}</h2>
        <p className="mt-3 text-[16px] leading-relaxed text-ink/90">{fortune.body}</p>

        <dl className="mt-5 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-[15px]">
          <dt className="text-lamp">하면 좋아요</dt>
          <dd>{fortune.do}</dd>
          <dt className="text-faint">피해요</dt>
          <dd className="text-muted">{fortune.dont}</dd>
        </dl>

        <p className="mt-5 text-sm text-faint">
          {fortune.personal.n > 0
            ? `내 기록 ${fortune.personal.n}일이 오늘 점수의 ${Math.round(fortune.personal.weight * 100)}%를 정했어요 · 맞춤도 ${fortune.fitPercent}%`
            : "아직 내 기록이 없어 사주만으로 계산했어요"}
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
              className={`h-9 rounded-full border px-4 ${vote === 1 ? "border-lamp text-lamp" : "border-line"}`}
            >
              맞아요
            </button>
            <button
              type="submit"
              name="vote"
              value="-1"
              aria-pressed={vote === -1}
              className={`h-9 rounded-full border px-4 ${vote === -1 ? "border-lamp text-lamp" : "border-line"}`}
            >
              아니에요
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
