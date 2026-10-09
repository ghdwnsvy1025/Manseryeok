import Link from "next/link";
import type { CalendarMonth } from "@/lib/calendar";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 나 화면 달력 보기 (2026-10-10 Q6 = B). 자바스크립트 없이 링크로 달을 옮긴다(?view=cal&m=YYYY-MM).
 * 기록한 날 = 인주 도장(농도 --h = 행복도), 안에 행복도 숫자. 기록 없는 날 = 날짜만. 미래 = 흐림, 누를 수 없음.
 * 날짜를 누르면 그날 쓰기/고치기. 모양은 디자이너(.cal*).
 */
export function MonthCalendar({ cal }: { cal: CalendarMonth }) {
  return (
    <div className="cal">
      <div className="cal__head flex items-center justify-between">
        {cal.prev ? (
          <Link href={`/me?view=cal&m=${cal.prev}`} scroll={false} className="tap tap--box" aria-label="이전 달">
            ‹
          </Link>
        ) : (
          <span className="tap tap--box" />
        )}
        <p className="cal__title font-serif text-[20px]">
          {cal.year}년 {cal.month}월
        </p>
        {cal.next ? (
          <Link href={`/me?view=cal&m=${cal.next}`} scroll={false} className="tap tap--box" aria-label="다음 달">
            ›
          </Link>
        ) : (
          <span className="tap tap--box" />
        )}
      </div>
      <dl className="kv mt-1">
        <div className="kv__row">
          <dt>이 달 기록</dt>
          <dd>{cal.count}일</dd>
        </div>
        {cal.mean !== null && (
          <div className="kv__row">
            <dt>평균 행복도</dt>
            <dd>{cal.mean}</dd>
          </div>
        )}
      </dl>
      <div className="cal__dow mt-3 grid grid-cols-7 text-center text-[12px] text-muted" aria-hidden>
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <ol className="cal__grid mt-1 grid grid-cols-7 gap-1" aria-label={`${cal.year}년 ${cal.month}월 행복도`}>
        {cal.weeks.flat().map((c, i) =>
          c.date === null ? (
            <li key={`e${i}`} className="cal__cell cal__cell--blank" aria-hidden />
          ) : c.isFuture ? (
            <li key={c.date} className="cal__cell" data-future="">
              <span className="cal__day">{c.day}</span>
            </li>
          ) : (
            <li key={c.date}>
              <Link
                href={`/write?date=${c.date}`}
                className="cal__cell"
                data-today={c.isToday ? "" : undefined}
                data-has={c.happiness !== null ? "" : undefined}
                style={c.happiness !== null ? ({ "--h": (c.happiness - 1) / 9 } as React.CSSProperties) : undefined}
                aria-label={`${cal.month}월 ${c.day}일 ${c.happiness !== null ? `행복도 ${c.happiness}` : "기록 없음"}`}
              >
                <span className="cal__day">{c.day}</span>
                {c.happiness !== null && <span className="cal__stamp">{c.happiness}</span>}
              </Link>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
