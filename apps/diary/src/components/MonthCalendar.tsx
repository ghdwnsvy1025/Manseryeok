"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { happinessTier, type Areas, type States } from "@/lib/entry";
import { useEffect, useState } from "react";
import type { CalendarMonth } from "@/lib/calendar";
import type { ForecastCard } from "@/components/BestWorstDays";
import { DAY_STATE, openDay, openDayList } from "@/components/DaySheet";
import { celebrate } from "@/lib/fx";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export interface DayInfo {
  ganjiKo: string;
  entry: { happiness: number; moods: string[]; note: string | null; areas?: Areas | null; states?: States | null; tomorrowNote?: string | null } | null;
}

/** 행복도 세 단계 (2026-10-10 Q2 = A): 7~10 high(금빛) · 4~6 mid(옅은 녹갈) · 1~3 low(차분한 남색). 빨강 없음 */

/**
 * 나 화면 달력 (v3.15). 달 이동(‹ ›)은 링크(서버) 그대로. 오늘 기록이 있고 이 세션에서 처음 보면 오늘 칸에 data-stamp-in(도장 꽝 한 번, CSS).
 * 모양은 디자이너(.cal*). 칸: data-tier, data-selected, data-today, data-future.
 * 명세 47 (톤 v3.51): 앞날 칸 가운데 좋을 날 셋 · 조심할 날 셋에만 도장(옥색 · 주홍), 나머지 앞날은 빈 칸. 위의 칩을 누르면 주소에 fd=날짜가 실려 오고
 * (MeForecastChips) 그 칸의 도장이 한 번 "꽝"(오늘 도장과 같은 cal-stamp-in).
 * 명세 50 (톤 v3.54): 칸을 누르면 달력 아래에 펼쳐지던 상세 대신 **날짜 낱장**(DaySheet)이 뜬다 — 지난 날(기록 있음 · 없음)도 앞날 도장 칸도.
 * 고른 칸 표시(data-selected)는 낱장이 떠 있는 동안만(DaySheet가 알려 준다). "이 달 기록" 줄 오른쪽에 전체 목록으로 가는 글자 버튼 "전체 보기",
 * 달력 아래 기호 풀이 한 줄(옥색 점 좋을 날 · 주홍 점 조심할 날 · 사주로 본 예상이에요 — 그 달에 앞날 도장이 있을 때만).
 */
export function MonthCalendar({
  cal,
  days,
  today,
  forecast = {},
}: {
  cal: CalendarMonth;
  days: Record<string, DayInfo>;
  /** 명세 50부터 쓰지 않는다(?d=는 DaySheet가 읽는다). 부르는 쪽 호환으로 남겨 둔다 */
  initialSelected?: string | null;
  today: string;
  /** 앞으로 30일의 좋을 날(best)·조심할 날(worst) 여섯 날 (명세 47). 미래 칸에 data-forecast로 표시 */
  forecast?: Record<string, "best" | "worst">;
  /** 명세 50부터 쓰지 않는다(까닭 한 줄은 DaySheet가 그린다) */
  forecastCards?: { best: ForecastCard[]; worst: ForecastCard[] };
}) {
  // 칩이 실어 보낸 날 (?fd=). 이 달의 예상 날일 때만 받는다
  const fdParam = useSearchParams().get("fd");
  const fd = fdParam && forecast[fdParam] && fdParam.startsWith(cal.ym) ? fdParam : null;
  /** 날짜 낱장에 떠 있는 날 — 낱장이 떠 있는 동안만 칸에 표시한다 */
  const [selected, setSelected] = useState<string | null>(null);
  const [stampIn, setStampIn] = useState(false);

  useEffect(() => {
    const onState = (e: Event) => setSelected((e as CustomEvent<string | null>).detail);
    window.addEventListener(DAY_STATE, onState);
    return () => window.removeEventListener(DAY_STATE, onState);
  }, []);

  useEffect(() => {
    if (!days[today]?.entry) return;
    try {
      const key = `saju-cal-stamped:${today}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      setStampIn(true);
      // v3.20 보상 순간: 도장이 꽝 찍힌 뒤 금빛 가루
      window.setTimeout(() => celebrate(document.querySelector(".cal__cell[data-stamp-in]")), 380);
    } catch {
      /* 저장소를 못 쓰면 연출 없이 */
    }
  }, [days, today]);

  const hasForecast = cal.weeks.flat().some((c) => c.date !== null && c.isFuture && forecast[c.date]);

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
          <dd>
            {cal.count}일
            {/* 명세 50: 전체 목록으로 바로 — 글자 버튼 */}
            <button type="button" className="cal__all tap" aria-haspopup="dialog" onClick={() => openDayList()}>
              전체 보기
            </button>
          </dd>
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
            forecast[c.date] ? (
              <li key={c.date}>
                <button
                  type="button"
                  onClick={() => openDay(c.date!)}
                  className="cal__cell w-full"
                  data-future=""
                  data-forecast={forecast[c.date]}
                  data-selected={selected === c.date ? "" : undefined}
                  aria-haspopup="dialog"
                  data-stamp-in={fd === c.date ? "" : undefined}
                  aria-label={`${cal.month}월 ${c.day}일 ${forecast[c.date] === "best" ? "좋을 날로 봤어요" : "조심할 날로 봤어요"}`}
                >
                  <span className="cal__day">{c.day}</span>
                  {/* 표식은 글자가 아니라 CSS가 그리는 도장 — 좋을 날 옥색 면, 조심할 날 주홍 면 (뜻은 버튼의 aria-label) */}
                  <span className="cal__forecast" aria-hidden />
                </button>
              </li>
            ) : (
              <li key={c.date} className="cal__cell" data-future="">
                <span className="cal__day">{c.day}</span>
              </li>
            )
          ) : (
            <li key={c.date}>
              <button
                type="button"
                onClick={() => openDay(c.date!)}
                className="cal__cell w-full"
                data-selected={selected === c.date ? "" : undefined}
                aria-haspopup="dialog"
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
      {/* 기호 풀이 한 줄 (명세 50 4번) — 이 달에 앞날 도장이 있을 때만 */}
      {hasForecast && (
        <p className="cal__legend">
          <span className="cal__legend-key" data-kind="best">
            좋을 날
          </span>
          <span className="cal__legend-key" data-kind="worst">
            조심할 날
          </span>
          <span>사주로 본 예상이에요</span>
        </p>
      )}
    </div>
  );
}
