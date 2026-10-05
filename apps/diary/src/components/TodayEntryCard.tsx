import Link from "next/link";

interface Props {
  entry: { happiness: number; moods: string[]; note: string | null };
  /** 오늘 날짜 (고치기 링크) */
  today: string;
  /** 내일 간지 한글 ("계축") */
  tomorrowKo: string;
  /** 방금 저장하고 돌아왔는지 — "저장했어요" 줄이 150ms 늦게 나타난다 */
  justSaved: boolean;
}

/**
 * 오늘의 기록 — 일기장의 오늘 페이지 (톤 v3).
 * 앱 인사말 제목 없이 행복도 숫자, 기분 띠지, 괘선 위 손글씨 메모, 내일 간지 한 줄.
 * 표시만 한다. 데이터는 page.tsx가 읽은 값을 그대로 받는다.
 */
export function TodayEntryCard({ entry, today, tomorrowKo, justSaved }: Props) {
  return (
    <section className="card-frame card-paper p-5">
      {justSaved && <p className="saved-line mb-2 text-sm font-bold text-gold">저장했어요</p>}
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm text-muted">오늘의 기록</h2>
        <Link href={`/write?date=${today}`} className="text-sm text-muted underline underline-offset-4">
          고치기
        </Link>
      </div>

      <p className="mt-2 font-serif leading-none">
        <span className="text-[48px]">{entry.happiness}</span>
        <span className="ml-1 text-[15px] text-muted">/10</span>
        <span className="sr-only">행복도</span>
      </p>

      {entry.moods.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="기분">
          {entry.moods.map((m) => (
            <li key={m} className="tag tag--on h-8 px-1 text-[14px] text-sky-ink">
              {m}
            </li>
          ))}
        </ul>
      )}

      {/* 메모가 없으면 괘선 영역 자체를 생략한다 */}
      {entry.note && <p className="ruled mt-4 line-clamp-3 font-hand text-[22px] text-ink">{entry.note}</p>}

      <span aria-hidden className="rule mt-5" />
      <p className="mt-3 text-[17px]">
        내일은 <b className="font-serif font-normal text-ganji">{tomorrowKo}일</b>이에요
      </p>
    </section>
  );
}
