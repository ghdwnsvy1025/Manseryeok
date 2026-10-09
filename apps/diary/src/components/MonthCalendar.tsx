"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CalendarMonth } from "@/lib/calendar";
import { CalendarDayDetail } from "@/components/CalendarDayDetail";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export interface DayInfo {
  ganjiKo: string;
  entry: { happiness: number; moods: string[]; note: string | null } | null;
}

/** 행복도 세 단계 (2026-10-10 Q2 = A): 7~10 high(금빛) · 4~6 mid(옅은 녹갈) · 1~3 low(차분한 남색). 빨강 없음 */
export function happinessTier(h: number): "high" | "mid" | "low" {
  return h >= 7 ? "high" : h >= 4 ? "mid" : "low";
}

/**
 * 나 화면 달력 (v3.15). 날짜를 누르면 서버를 거치지 않고 아래 상세가 바로 바뀐다 — 그 달 기록(행복도·기분·메모·간지)을 서버가 미리 담아 준다
 * (예전엔 ?d= 링크라 누를 때마다 나 화면 전체를 다시 받아 렉). 주소의 ?d=는 replaceState로만 맞춘다(새로고침해도 같은 날).
 * 달 이동(‹ ›)은 링크(서버) 그대로. 오늘 기록이 있고 이 세션에서 처음 보면 오늘 칸에 data-stamp-in(도장 꽝 한 번, CSS).
 * 모양은 디자이너(.cal*). 칸: data-tier, data-selected, data-today, data-future.
 */
export function MonthCalendar({ cal, days, initialSelected = null, today }: { cal: CalendarMonth; days: Record<string, DayInfo>; initialSelected?: string | null; today: string }) {
  const [selected, setSelected] = useState<string | null>(initialSelected);
  const [stampIn, setStampIn] = useState(false);

  useEffect(() => {
    if (!days[today]?.entry) return;
    try {
      const key = `saju-cal-stamped:${today}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setStampIn(true);
    } catch {
      /* 저장소를 못 쓰면 연출 없이 */
    }
  }, [days, today]);

  const pick = (date: string) => {
    const next = selected === date ? null : date;
    setSelected(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("m", cal.ym);
      if (next) url.searchParams.set("d", next);
      else url.searchParams.delete("d");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* 주소를 못 고쳐도 화면은 바뀐다 */
    }
  };

  const info = selected ? days[selected] : undefined;

  return (
    <div className="cal">
      <div className="cal__head flex items-center justify-between">
        {cal.prev ? (
          <Link href={`/me?m=${cal.prev}`} scroll={false} className="tap tap--box" aria-label="이전 달">
            ‹
          </Link>
        ) : (
          <span className="tap tap--box" />
        )}
        <p className="cal__title font-serif text-[20px]">
          {cal.year}년 {cal.month}월
        </p>
        {cal.next ? (
          <Link href={`/me?m=${cal.next}`} scroll={false} className="tap tap--box" aria-label="다음 달">
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
              <button
                type="button"
                onClick={() => pick(c.date!)}
                className="cal__cell w-full"
                data-selected={selected === c.date ? "" : undefined}
                aria-pressed={selected === c.date}
                data-today={c.isToday ? "" : undefined}
                data-has={c.happiness !== null ? "" : undefined}
                data-tier={c.happiness !== null ? happinessTier(c.happiness) : undefined}
                data-stamp-in={c.isToday && stampIn ? "" : undefined}
                style={c.happiness !== null ? ({ "--h": (c.happiness - 1) / 9 } as React.CSSProperties) : undefined}
                aria-label={`${cal.month}월 ${c.day}일 ${c.happiness !== null ? `행복도 ${c.happiness}` : "기록 없음"}`}
              >
                <span className="cal__day">{c.day}</span>
                {c.happiness !== null && <span className="cal__stamp">{c.happiness}</span>}
              </button>
            </li>
          ),
        )}
      </ol>
      {selected && info && <CalendarDayDetail date={selected} ganjiKo={info.ganjiKo} entry={info.entry} />}
    </div>
  );
}
