"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { happinessTier, type Areas, type States } from "@/lib/entry";
import { useEffect, useState } from "react";
import type { CalendarMonth } from "@/lib/calendar";
import { CalendarDayDetail } from "@/components/CalendarDayDetail";
import type { ForecastCard } from "@/components/BestWorstDays";
import { celebrate } from "@/lib/fx";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export interface DayInfo {
  ganjiKo: string;
  entry: { happiness: number; moods: string[]; note: string | null; areas?: Areas | null; states?: States | null; tomorrowNote?: string | null } | null;
}

/** 행복도 세 단계 (2026-10-10 Q2 = A): 7~10 high(금빛) · 4~6 mid(옅은 녹갈) · 1~3 low(차분한 남색). 빨강 없음 */

/**
 * 나 화면 달력 (v3.15). 날짜를 누르면 서버를 거치지 않고 아래 상세가 바로 바뀐다 — 그 달 기록(행복도·기분·메모·간지)을 서버가 미리 담아 준다
 * (예전엔 ?d= 링크라 누를 때마다 나 화면 전체를 다시 받아 렉). 주소의 ?d=는 replaceState로만 맞춘다(새로고침해도 같은 날).
 * 달 이동(‹ ›)은 링크(서버) 그대로. 오늘 기록이 있고 이 세션에서 처음 보면 오늘 칸에 data-stamp-in(도장 꽝 한 번, CSS).
 * 모양은 디자이너(.cal*). 칸: data-tier, data-selected, data-today, data-future.
 * 명세 47 (톤 v3.51): 앞날 칸 가운데 좋을 날 셋 · 조심할 날 셋에만 도장(옥색 · 주홍), 나머지 앞날은 빈 칸. 도장 찍힌 앞날 칸은 누를 수 있고,
 * 날짜 상세 자리에 그날을 그렇게 본 까닭 한 줄(ForecastCard.reason)이 나온다 — 점수는 없다. 위의 칩을 누르면 주소에 fd=날짜가 실려 오고
 * (MeForecastChips), 그 칸이 골라지며 도장이 한 번 "꽝"(오늘 도장과 같은 cal-stamp-in).
 */
export function MonthCalendar({
  cal,
  days,
  initialSelected = null,
  today,
  forecast = {},
  forecastCards,
}: {
  cal: CalendarMonth;
  days: Record<string, DayInfo>;
  initialSelected?: string | null;
  today: string;
  /** 앞으로 30일의 좋을 날(best)·조심할 날(worst) 여섯 날 (명세 47). 미래 칸에 data-forecast로 표시 */
  forecast?: Record<string, "best" | "worst">;
  /** 같은 여섯 날의 얼굴 · 간지 · 까닭 — 앞날 칸을 골랐을 때 상세 자리에 쓴다 */
  forecastCards?: { best: ForecastCard[]; worst: ForecastCard[] };
}) {
  const cardOf = (date: string | null): ForecastCard | undefined => (date ? [...(forecastCards?.best ?? []), ...(forecastCards?.worst ?? [])].find((f) => f.date === date) : undefined);
  // 칩이 실어 보낸 날 (?fd=). 이 달의 예상 날일 때만 받는다
  const fdParam = useSearchParams().get("fd");
  const fd = fdParam && forecast[fdParam] && fdParam.startsWith(cal.ym) ? fdParam : null;
  const [selected, setSelected] = useState<string | null>(initialSelected ?? fd);
  const [stampIn, setStampIn] = useState(false);
  const [slam, setSlam] = useState<string | null>(null);

  // 칩을 눌러 넘어왔을 때: 그 칸을 고르고 도장을 한 번 찍는다
  useEffect(() => {
    setSlam(fd);
    if (fd) setSelected(fd);
  }, [fd]);

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

  const pick = (date: string, future = false) => {
    const next = selected === date ? null : date;
    setSelected(next);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("m", cal.ym);
      // 앞날 칸은 주소에 남기지 않는다(?d=는 기록이 있을 수 있는 날만, ?fd=는 칩이 싣는다)
      url.searchParams.delete("fd");
      if (next && !future) url.searchParams.set("d", next);
      else url.searchParams.delete("d");
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {
      /* 주소를 못 고쳐도 화면은 바뀐다 */
    }
  };

  const info = selected ? days[selected] : undefined;
  const picked = selected && selected.startsWith(cal.ym) && forecast[selected] ? cardOf(selected) : undefined;

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
            forecast[c.date] ? (
              <li key={c.date}>
                <button
                  type="button"
                  onClick={() => pick(c.date!, true)}
                  className="cal__cell w-full"
                  data-future=""
                  data-forecast={forecast[c.date]}
                  data-selected={selected === c.date ? "" : undefined}
                  aria-pressed={selected === c.date}
                  data-stamp-in={slam === c.date ? "" : undefined}
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
      {/* 앞날 칸: 기록이 없으니 상세 자리에 그날을 그렇게 본 까닭 한 줄. 인장(1px 선 + 같은 색 글자)이 좋을 날 · 조심할 날을 말한다 */}
      {picked && selected && (
        <section className="cal-forecast mt-4" data-kind={forecast[selected]} aria-label={`${picked.label} ${picked.ganjiKo}일, 사주로 본 예상`} aria-live="polite">
          <img src={picked.faceSrc} alt="" width={48} height={48} className="cal-forecast__face" />
          <div className="cal-forecast__text">
            <p className="cal-forecast__top">
              <span className="cal-forecast__seal">{forecast[selected] === "best" ? "좋을 날" : "조심할 날"}</span>
              <span className="cal-forecast__date">
                {picked.label} <span className="text-ganji">{picked.ganjiKo}일</span>
              </span>
            </p>
            <p className="cal-forecast__reason">{picked.reason}</p>
          </div>
        </section>
      )}
    </div>
  );
}
