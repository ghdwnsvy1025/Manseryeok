"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, openSheet } from "@/components/Sheet";
import { CalendarDayDetail } from "@/components/CalendarDayDetail";
import type { DayInfo } from "@/components/MonthCalendar";
import type { ForecastCard } from "@/components/BestWorstDays";
import { happinessTier, moodTone } from "@/lib/entry";

/**
 * 날짜 낱장과 전체 목록 (명세 50, 톤 v3.54). 앱 주인: "캘린더 클릭했을 때 아래에 정보들 나오는데 팝업으로 하고, 팝업창에 전체 보기도 해서 목록으로 쫙".
 * 달력 칸 · "나는 언제 행복했지?"의 두 날 · "예상은 맞았을까?"의 날 줄 · 목록의 줄 — 어디서 누르든 같은 낱장이 뜬다(openDay). 주소 ?d=로 들어와도 뜬 채 시작한다.
 * 낱장 틀은 Sheet 그대로(닫기 · 포커스 동작을 바꾸지 않는다). 이 조각이 맡는 것:
 *   - 어느 날을 보여 줄지(기록은 records에서, 없으면 달력 달의 days, 앞날은 forecastCards) · 날짜 ↔ 목록 바꾸기(같은 낱장 안, 120ms 흐려짐)
 *   - 다른 낱장(행복했지 · 예상)이 떠 있으면 그것을 걷고 뜬다 — 그 dialog를 바로 닫는다(Sheet는 건드리지 않는다)
 *   - 달력의 고른 칸 표시(낱장이 떠 있는 동안만)와 주소 ?d= 맞추기
 * 목록은 400줄이어도 가볍게: 처음 60줄만 그리고 "더 보기"로 60줄씩 늘린다. 달마다 작은 머리말.
 */
const SHEET_ID = "sheet-day";
const OPEN_DAY = "day:open";
const OPEN_LIST = "day:list";
/** 달력이 듣는다: 지금 낱장에 뜬 날(없으면 null) */
export const DAY_STATE = "day:state";
const PAGE = 60;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 그 날의 날짜 낱장을 연다. 어디서든 부른다 */
export function openDay(date: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_DAY, { detail: date }));
}
/** 전체 목록을 연다 */
export function openDayList(): void {
  window.dispatchEvent(new CustomEvent(OPEN_LIST));
}

export interface DayRecord {
  date: string;
  ganjiKo: string;
  entry: NonNullable<DayInfo["entry"]>;
}

const dowOf = (date: string): string => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
const mdOf = (date: string): string => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export function DaySheet({
  records,
  days,
  forecast = {},
  forecastCards,
  today,
  writeHref = "/write",
}: {
  /** 전체 기록(최근 것부터, 최대 400) */
  records: DayRecord[];
  /** 지금 달력에 보이는 달의 날들(기록 없는 날도 일진 이름이 있다) */
  days: Record<string, DayInfo>;
  forecast?: Record<string, "best" | "worst">;
  forecastCards?: { best: ForecastCard[]; worst: ForecastCard[] };
  today: string;
  writeHref?: string;
}) {
  const [view, setView] = useState<"day" | "list">("day");
  const [date, setDate] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const dateRef = useRef<string | null>(null);
  const params = useSearchParams();
  const dParam = params.get("d");
  const saved = params.get("saved");

  const byDate = useMemo(() => new Map(records.map((r) => [r.date, r])), [records]);
  const cards = useMemo(() => [...(forecastCards?.best ?? []), ...(forecastCards?.worst ?? [])], [forecastCards]);

  /** 주소의 ?d=를 낱장과 맞춘다(지난 날만). 새로고침해도 같은 날 */
  const syncUrl = useCallback(
    (d: string | null) => {
      try {
        const url = new URL(window.location.href);
        if (d && d <= today) url.searchParams.set("d", d);
        else url.searchParams.delete("d");
        url.searchParams.delete("fd");
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        /* 주소를 못 고쳐도 화면은 바뀐다 */
      }
    },
    [today],
  );

  const show = useCallback(
    (next: { view: "day" | "list"; date?: string | null }) => {
      const dialog = document.getElementById(SHEET_ID) as HTMLDialogElement | null;
      if (!dialog) return;
      if (next.view === "day") {
        const d = next.date ?? null;
        if (!d) return;
        // 낱장에 그릴 자료가 없는 날(400개 밖의 옛 기록)은 예전처럼 주소로 보낸다
        if (!byDate.has(d) && !days[d] && !cards.some((c) => c.date === d)) {
          window.location.assign(`/me?d=${d}`);
          return;
        }
        dateRef.current = d;
        setDate(d);
        setView("day");
        syncUrl(d);
        window.dispatchEvent(new CustomEvent(DAY_STATE, { detail: d }));
      } else {
        setShown(PAGE);
        setView("list");
        window.dispatchEvent(new CustomEvent(DAY_STATE, { detail: null }));
      }
      dialog.querySelector<HTMLElement>(".sheet__body")?.scrollTo(0, 0);
      if (!dialog.open) {
        // 다른 낱장(행복했지 · 예상 · 만세력)이 떠 있으면 걷는다 — 포커스는 그 낱장을 연 버튼으로 돌아가고, 날짜 낱장이 닫히면 다시 거기로 돌아온다
        document.querySelectorAll<HTMLDialogElement>("dialog.sheet[open]").forEach((o) => o !== dialog && o.close());
        openSheet(SHEET_ID);
      }
    },
    [byDate, days, cards, syncUrl],
  );

  useEffect(() => {
    const onDay = (e: Event) => show({ view: "day", date: (e as CustomEvent<string>).detail });
    const onList = () => show({ view: "list" });
    window.addEventListener(OPEN_DAY, onDay);
    window.addEventListener(OPEN_LIST, onList);
    return () => {
      window.removeEventListener(OPEN_DAY, onDay);
      window.removeEventListener(OPEN_LIST, onList);
    };
  }, [show]);

  // 낱장이 닫히면: 달력의 고른 칸 표시를 지우고 주소의 ?d=도 지운다
  useEffect(() => {
    const dialog = document.getElementById(SHEET_ID);
    if (!dialog) return;
    const watch = new MutationObserver(() => {
      if (dialog.hasAttribute("open")) return;
      dateRef.current = null;
      syncUrl(null);
      window.dispatchEvent(new CustomEvent(DAY_STATE, { detail: null }));
    });
    watch.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, [syncUrl]);

  // 주소 ?d=로 들어왔을 때(기존 링크 · 60갑자 보기에서 온 날). 저장 직후(?saved=)에는 팡이 먼저라 저절로 띄우지 않는다
  useEffect(() => {
    if (!dParam || saved || dParam === dateRef.current) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dParam) && dParam <= today) show({ view: "day", date: dParam });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dParam, saved]);

  const record = date ? byDate.get(date) : undefined;
  const info: DayInfo | undefined = date ? (record ? { ganjiKo: record.ganjiKo, entry: record.entry } : days[date]) : undefined;
  const card = date ? cards.find((c) => c.date === date) : undefined;
  const ganjiKo = info?.ganjiKo ?? card?.ganjiKo ?? "";
  // 전날 · 다음 날: 기록이 있는 날끼리 오간다
  const older = date ? records.find((r) => r.date < date) : undefined;
  const newer = date ? [...records].reverse().find((r) => r.date > date) : undefined;

  const title = view === "list" ? "내 기록 전체" : date ? `${mdOf(date)} ${dowOf(date)}요일${ganjiKo ? ` ${ganjiKo}일` : ""}` : "날짜";

  // 목록: 처음 60줄, 달마다 머리말
  const rows = records.slice(0, shown);
  const monthCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + 1);
    return m;
  }, [records]);

  return (
    <Sheet id={SHEET_ID} name="day" title={title}>
      {view === "day" ? (
        <div key={`day-${date}`} className="day-sheet">
          {date && info && <CalendarDayDetail date={date} ganjiKo={info.ganjiKo} entry={info.entry} />}
          {/* 앞날 도장 칸: 기록이 없으니 그날을 그렇게 본 까닭 한 줄. 점수는 없다 */}
          {date && !info && card && (
            <section className="cal-forecast" data-kind={forecast[date]} aria-label={`${card.label} ${card.ganjiKo}일, 사주로 본 예상`}>
              <img src={card.faceSrc} alt="" width={48} height={48} className="cal-forecast__face" />
              <div className="cal-forecast__text">
                <p className="cal-forecast__top">
                  <span className="cal-forecast__seal">{forecast[date] === "worst" ? "조심할 날" : "좋을 날"}</span>
                  <span className="cal-forecast__date">사주로 본 예상이에요</span>
                </p>
                <p className="cal-forecast__reason">{card.reason}</p>
              </div>
            </section>
          )}
          <nav className="day-sheet__nav" aria-label="다른 날">
            <button type="button" className="day-sheet__step tap" disabled={!older} onClick={() => older && show({ view: "day", date: older.date })}>
              ‹ 전날
            </button>
            <button type="button" className="day-sheet__all" onClick={() => show({ view: "list" })}>
              전체 보기
            </button>
            <button type="button" className="day-sheet__step tap" disabled={!newer} onClick={() => newer && show({ view: "day", date: newer.date })}>
              다음 날 ›
            </button>
          </nav>
        </div>
      ) : (
        <div key="list" className="day-sheet day-list">
          {date && (
            <button type="button" className="day-list__back tap" onClick={() => show({ view: "day", date })}>
              ‹ 돌아가기
            </button>
          )}
          {records.length === 0 ? (
            <div className="day-list__empty">
              <p>아직 기록이 없어요</p>
              <Link href={writeHref} className="tap underline underline-offset-4">
                오늘 기록하기
              </Link>
            </div>
          ) : (
            <ol className="day-list__rows">
              {rows.map((r, i) => {
                const ym = r.date.slice(0, 7);
                const head = i === 0 || rows[i - 1]!.date.slice(0, 7) !== ym;
                const first = (r.entry.note ?? "").split("\n")[0] ?? "";
                return (
                  <li key={r.date}>
                    {head && (
                      <p className="day-list__month">
                        <span>
                          {Number(ym.slice(0, 4))}년 {Number(ym.slice(5))}월
                        </span>
                        <span>{monthCount.get(ym)}일</span>
                      </p>
                    )}
                    <button type="button" className="day-list__row" onClick={() => show({ view: "day", date: r.date })} aria-label={`${mdOf(r.date)} ${dowOf(r.date)}요일, 행복도 ${r.entry.happiness}`}>
                      <span className="day-list__stamp" data-tier={happinessTier(r.entry.happiness)} aria-hidden>
                        {r.entry.happiness}
                      </span>
                      <span className="day-list__main">
                        <span className="day-list__top">
                          <span className="day-list__date">
                            {mdOf(r.date)} <small>{dowOf(r.date)}</small>
                          </span>
                          {r.entry.moods.slice(0, 2).map((m) => (
                            <span key={m} className="metric__chip" data-tone={moodTone(m)}>
                              {m}
                            </span>
                          ))}
                        </span>
                        {first && <span className="day-list__note">{first}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {shown < records.length && (
            <button type="button" className="day-list__more tap" onClick={() => setShown((n) => n + PAGE)}>
              더 보기 <small>{records.length - shown}일 남음</small>
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** 날짜 낱장을 여는 버튼 — 서버 조각(두 날 칸 등) 안에서 쓴다 */
export function DayButton({ date, className, children, "aria-label": ariaLabel }: { date: string; className?: string; children: React.ReactNode; "aria-label"?: string }) {
  return (
    <button type="button" className={className} aria-label={ariaLabel} aria-haspopup="dialog" onClick={() => openDay(date)}>
      {children}
    </button>
  );
}
