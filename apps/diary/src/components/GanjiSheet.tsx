"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Sheet, openSheet } from "@/components/Sheet";
import { openDay, type DayRecord } from "@/components/DaySheet";
import { characterOfGanji } from "@/lib/character";
import { happinessTier, moodTone } from "@/lib/entry";

/**
 * 간지 낱장 (명세 51, 톤 v3.55). 앱 주인: "60갑자도 팝업으로 뜨게 해 줘."
 * 60갑자 격자의 칸을 누르면 서버를 거치지 않고 이 낱장이 뜬다(전에는 ?cell=N 링크로 화면을 다시 받고 격자 아래에 상세가 펼쳐졌다).
 * 제목 = 간지 이름. 안 = 얼굴 동그라미 크게 + 평균 행복도 도장과 "N번 기록" + 그 간지였던 날 목록(최근 것부터, 전체 목록과 같은 줄).
 * 줄을 누르면 이 낱장이 걷히고 그 날의 날짜 낱장이 뜬다(openDay). 기록 없는 간지는 얼굴 실루엣 + 안내 + 다음에 그 간지가 오는 날.
 * 낱장 틀은 Sheet 그대로(닫으면 누른 칸으로 포커스가 돌아간다). 주소 ?cell=N으로 들어오면 뜬 채 시작하고, 닫으면 주소에서 cell을 지운다.
 */
const SHEET_ID = "sheet-ganji";
const OPEN_GANJI = "ganji:open";
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function openGanji(index: number): void {
  window.dispatchEvent(new CustomEvent(OPEN_GANJI, { detail: index }));
}

export interface GanjiSheetCell {
  index: number;
  ko: string;
  n: number;
  mean: number | null;
}

const dowOf = (date: string): string => DOW[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export function GanjiSheet({ cells, records, todayIndex, today }: { cells: GanjiSheetCell[]; /** 전체 기록(최근 것부터, 최대 400) — 그 간지였던 날을 여기서 고른다 */ records: DayRecord[]; todayIndex: number; today: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const indexRef = useRef<number | null>(null);
  const cellParam = useSearchParams().get("cell");

  const show = useCallback(
    (i: number) => {
      const dialog = document.getElementById(SHEET_ID) as HTMLDialogElement | null;
      if (!dialog || !cells[i]) return;
      indexRef.current = i;
      setIndex(i);
      dialog.querySelector<HTMLElement>(".sheet__body")?.scrollTo(0, 0);
      if (!dialog.open) {
        document.querySelectorAll<HTMLDialogElement>("dialog.sheet[open]").forEach((o) => o !== dialog && o.close());
        openSheet(SHEET_ID);
      }
    },
    [cells],
  );

  useEffect(() => {
    const on = (e: Event) => show((e as CustomEvent<number>).detail);
    window.addEventListener(OPEN_GANJI, on);
    return () => window.removeEventListener(OPEN_GANJI, on);
  }, [show]);

  // 닫히면 주소의 ?cell=을 지운다
  useEffect(() => {
    const dialog = document.getElementById(SHEET_ID);
    if (!dialog) return;
    const watch = new MutationObserver(() => {
      if (dialog.hasAttribute("open")) return;
      indexRef.current = null;
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("cell")) return;
        url.searchParams.delete("cell");
        url.searchParams.set("view", "grid");
        window.history.replaceState(window.history.state, "", url.toString());
      } catch {
        /* 주소를 못 고쳐도 화면은 그대로 */
      }
    });
    watch.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, []);

  // 주소 ?cell=N으로 들어왔을 때(기존 링크)
  useEffect(() => {
    if (cellParam === null || !/^\d{1,2}$/.test(cellParam)) return;
    const i = Number(cellParam);
    if (i < 60 && i !== indexRef.current) show(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellParam]);

  const cell = index !== null ? cells[index] : undefined;
  const days = useMemo(() => (cell ? records.filter((r) => r.ganjiKo === cell.ko) : []), [cell, records]);
  const face = cell ? characterOfGanji(cell.ko) : null;
  const isToday = index === todayIndex;
  // 다음에 이 간지가 오는 날: 60일에 한 번
  const ahead = index === null ? 0 : (index - todayIndex + 60) % 60;
  const next = addDays(today, ahead);
  const label = (date: string) => `${date.slice(0, 4) === today.slice(0, 4) ? "" : `${Number(date.slice(0, 4))}년 `}${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

  return (
    <Sheet id={SHEET_ID} name="ganji" title={cell ? cell.ko : "60갑자"}>
      {cell && face && (
        <div className="ganji-sheet">
          <div className="ganji-sheet__head">
            <img src={face.faceSrc} alt="" width={96} height={96} className="ganji-sheet__face" data-unmet={cell.n ? undefined : ""} />
            <div className="ganji-sheet__stat">
              {isToday && <span className="ganji-sheet__today">오늘</span>}
              {cell.n > 0 ? (
                /* 평균 행복도 도장 + 횟수 — 격자 아래 상세가 쓰던 꼴(.cell-stat · .cell-stamp) 그대로 */
                <p className="cell-stat flex items-center gap-3">
                  <span className="cell-stamp" style={{ "--h": cell.mean === null ? 0 : (cell.mean - 1) / 9 } as CSSProperties} aria-label={`평균 행복도 ${cell.mean}`}>
                    {cell.mean}
                  </span>
                  <span className="text-[15px] text-muted">{cell.n}번 기록</span>
                </p>
              ) : (
                <p className="ganji-sheet__none">아직 이 날의 기록이 없어요</p>
              )}
            </div>
          </div>
          {cell.n === 0 && (
            <p className="ganji-sheet__next">
              {ahead === 0 ? `오늘이 ${cell.ko}일이에요` : `다음 ${cell.ko}일은 ${label(next)}이에요`}
            </p>
          )}
          {days.length > 0 && (
            <ol className="day-list__rows ganji-sheet__days" aria-label={`${cell.ko}일이었던 날`}>
              {days.map((r) => {
                const first = (r.entry.note ?? "").split("\n")[0] ?? "";
                return (
                  <li key={r.date}>
                    <button type="button" className="day-list__row" aria-haspopup="dialog" onClick={() => openDay(r.date)} aria-label={`${label(r.date)} ${dowOf(r.date)}요일, 행복도 ${r.entry.happiness}. 그날 기록 보기`}>
                      <span className="day-list__stamp" data-tier={happinessTier(r.entry.happiness)} aria-hidden>
                        {r.entry.happiness}
                      </span>
                      <span className="day-list__main">
                        <span className="day-list__top">
                          <span className="day-list__date">
                            {label(r.date)} <small>{dowOf(r.date)}</small>
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
          {/* 400개 밖의 옛 기록은 목록에 없다 — 횟수와 줄 수가 다르면 한 줄로 알린다 */}
          {cell.n > days.length && days.length > 0 && <p className="ganji-sheet__more">더 오래된 {cell.n - days.length}번은 여기에 다 나오지 않아요</p>}
        </div>
      )}
    </Sheet>
  );
}

/** 60갑자 격자의 칸 — 누르면 간지 낱장. 모양(className · style · data-*)은 GanjiGrid가 그대로 넘긴다 */
export function GanjiCellButton({ index, className, style, children, ...rest }: { index: number; className?: string; style?: CSSProperties; children: ReactNode; "aria-label"?: string; "data-today"?: string; "data-el"?: string }) {
  return (
    <button type="button" {...rest} className={className} style={style} aria-haspopup="dialog" onClick={() => openGanji(index)}>
      {children}
    </button>
  );
}
