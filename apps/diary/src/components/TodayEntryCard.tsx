import Link from "next/link";
import { characterOfGanji } from "@/lib/character";
import type { Promise_ } from "@/lib/entry";

interface Props {
  entry: { happiness: number; moods: string[]; note: string | null; promise?: Promise_ | null };
  /** 오늘 날짜 (고치기 링크) */
  today: string;
  /** 내일 간지 한글 ("계축") */
  tomorrowKo: string;
  /** 방금 저장하고 돌아왔는지 — "저장했어요" 줄이 150ms 늦게 나타난다 */
  justSaved: boolean;
}

/** 약속 줄 (v3.7): 글자 + 점. 지켰어요 = 인주 점, 못 지켰어요 = 먹 점, 해당 없음 = 점 없음 */
const PROMISE_LINE: Record<Promise_, { word: string; dot: string | null }> = {
  kept: { word: "지켰어요", dot: "bg-seal" },
  missed: { word: "못 지켰어요", dot: "bg-ink-stamp" },
  na: { word: "해당 없음", dot: null },
};

/**
 * 오늘의 기록 — 일기장의 오늘 페이지 (톤 v3 → 02 v3.7).
 * 숫자가 주인공: 행복도 Song Myung 56px 가운데, 아래 "행복도" 11px. 기분 띠지도 가운데.
 * 메모는 괘선 두 줄 사이에 손글씨로 — 없으면 괘선째 생략. 약속 줄은 있을 때만. 맨 아래 내일 간지 + 동물.
 * 표시만 한다. 데이터는 page.tsx가 읽은 값을 그대로 받는다.
 */
export function TodayEntryCard({ entry, today, tomorrowKo, justSaved }: Props) {
  const promise = entry.promise ? PROMISE_LINE[entry.promise] : null;
  const tomorrow = characterOfGanji(tomorrowKo);
  return (
    <section className="card-frame card-paper p-5">
      {justSaved && <p className="saved-line mb-2 text-sm font-bold text-gold">저장했어요</p>}
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-muted">오늘의 기록</h2>
        <Link href={`/write?date=${today}`} className="text-sm text-muted underline underline-offset-4">
          고치기
        </Link>
      </div>

      <p className="mt-3 text-center font-serif leading-none">
        <span className="text-[56px] tabular-nums text-ink">{entry.happiness}</span>
        <span className="ml-1 font-sans text-[15px] text-muted">/10</span>
        <span className="mt-1.5 block font-sans text-[11px] text-muted">행복도</span>
      </p>

      {entry.moods.length > 0 && (
        <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label="기분">
          {entry.moods.map((m) => (
            <li key={m} className="tag tag--on h-8 px-1 text-[14px] text-paper-2">
              {m}
            </li>
          ))}
        </ul>
      )}

      {/* 메모가 없으면 괘선까지 통째로 생략한다 — 빈 자리는 비운다 (v3.7) */}
      {entry.note && (
        <>
          <span aria-hidden className="rule rule--light mt-4" />
          <p className="ruled mt-2 line-clamp-3 font-hand text-[22px] text-ink">{entry.note}</p>
          <span aria-hidden className="rule rule--light mt-2" />
        </>
      )}

      {promise && (
        <p className="mt-4 flex items-center gap-1.5 text-[13px] text-muted">
          <span>약속 · {promise.word}</span>
          {promise.dot && <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${promise.dot}`} />}
        </p>
      )}

      <p className={`${promise ? "mt-2" : "mt-4"} text-[17px]`}>
        내일은 <b className="font-serif font-normal text-ganji">{tomorrowKo}일</b>
        {tomorrow.animal && <> · {tomorrow.animal}의 날</>}이에요
      </p>
    </section>
  );
}
