"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { dayHappiness } from "@/lib/journal/homeStats";
import { buildMonthCells, type WeeklyReport } from "@/lib/journal/statsInsight";
import {
  countEmptyDaysInMonth,
  entryDateSet,
} from "@/lib/journal/emptyDays";
import WeeklyReportCard from "@/components/stats/WeeklyReportCard";
import JournalDayReportModal from "@/components/stats/JournalDayReportModal";
import { happinessTone } from "@/lib/journal/statsTone";
import type { JournalEntry } from "@/lib/journal/types";

type Props = {
  entries: JournalEntry[];
  today: string;
  weeklyReport: WeeklyReport;
  /** 추이와 공유하는 월 */
  year: number;
  month: number;
  /** false면 상단 월 이동 UI 숨김 (부모가 공유 네비 사용) */
  showMonthNav?: boolean;
  onMonthChange?: (year: number, month: number) => void;
};

const LIST_PREVIEW = 3;
const DAY_MODAL_STATE = { manseryeokStatsDayModal: true } as const;

/** 기록 캘린더 — 월 격자 + 행복도·기분·간지 / 주간 리포트는 여기서만 */
export default function JournalRecordCalendar({
  entries,
  today,
  weeklyReport,
  year,
  month,
  showMonthNav = false,
  onMonthChange,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [dayReport, setDayReport] = useState<JournalEntry | null>(null);
  const [listExpanded, setListExpanded] = useState(false);

  /** 모달 열릴 때 history push → 뒤로가기가 기록탭을 나가지 않고 모달만 닫음 */
  useEffect(() => {
    if (!dayReport) return;
    const onPop = () => setDayReport(null);
    window.history.pushState(DAY_MODAL_STATE, "");
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [dayReport]);

  const closeDayReport = () => {
    setDayReport(null);
    if (window.history.state?.manseryeokStatsDayModal) {
      window.history.back();
    }
  };

  const byDate = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    for (const e of entries) {
      if (!e.entryDate.startsWith(prefix)) continue;
      const prev = map.get(e.entryDate);
      if (!prev || e.updatedAt >= prev.updatedAt) map.set(e.entryDate, e);
    }
    return map;
  }, [entries, year, month]);

  const allDates = useMemo(() => entryDateSet(entries), [entries]);

  const emptyInMonth = useMemo(
    () =>
      countEmptyDaysInMonth({
        year,
        month,
        todayIso: today,
        dates: allDates,
      }),
    [year, month, today, allDates]
  );

  const nearestEmpty = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = lastDay; d >= 1; d -= 1) {
      const iso = `${prefix}-${String(d).padStart(2, "0")}`;
      if (iso > today) continue;
      if (!allDates.has(iso)) return iso;
    }
    return null;
  }, [year, month, today, allDates]);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const monthList = useMemo(
    () =>
      Array.from(byDate.values()).sort((a, b) =>
        b.entryDate.localeCompare(a.entryDate)
      ),
    [byDate]
  );

  const visibleList = listExpanded
    ? monthList
    : monthList.slice(0, LIST_PREVIEW);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    onMonthChange?.(next.getFullYear(), next.getMonth() + 1);
  };

  return (
    <section className="stats-section" aria-label="기록 캘린더">
      <div className="stats-emphasize-head">
        <p className="stats-emphasize-title">기록 캘린더</p>
        <button
          type="button"
          onClick={() => setReportOpen((v) => !v)}
          className="shrink-0 text-xs font-black underline"
          style={{ color: "var(--px-accent)" }}
          aria-expanded={reportOpen}
        >
          {reportOpen ? "주간 닫기" : "주간 리포트"}
        </button>
      </div>

      {reportOpen && <WeeklyReportCard report={weeklyReport} />}

      <div className="stats-panel space-y-3">
        {showMonthNav && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="px-2 py-1 border text-xs font-bold"
              style={{
                borderColor: "var(--px-border)",
                color: "var(--px-text2)",
              }}
            >
              ‹
            </button>
            <p
              className="text-sm font-black tabular-nums"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {year}년 {month}월
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="px-2 py-1 border text-xs font-bold"
              style={{
                borderColor: "var(--px-border)",
                color: "var(--px-text2)",
              }}
            >
              ›
            </button>
          </div>
        )}

        {emptyInMonth > 0 && nearestEmpty && (
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p
              className="text-[11px] font-bold leading-snug"
              style={{ color: "var(--px-text2)" }}
            >
              빈 날 {emptyInMonth}개 · 메우면 운세가 더 정확해져요
            </p>
            <Link
              href={`/journal?date=${nearestEmpty}`}
              className="shrink-0 text-[11px] font-bold underline"
              style={{ color: "var(--px-accent)" }}
            >
              메우기
            </Link>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
            <div key={label} className="stats-label py-1">
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell.date || cell.day == null) {
              return <div key={`empty-${index}`} className="min-h-[52px]" />;
            }
            const entry = byDate.get(cell.date);
            const happiness = entry ? dayHappiness(entry) : null;
            const ganji = getPillarsForDate(cell.date).dayPillar.ganjiKo;
            const isToday = cell.date === today;
            const isFuture = cell.date > today;
            const isGap = !entry && !isFuture;
            const cellClass = `min-h-[52px] p-1 flex flex-col items-center justify-center gap-0.5 w-full border`;
            const cellStyle = {
              borderColor: isToday
                ? "var(--px-accent)"
                : isGap
                  ? "color-mix(in srgb, var(--px-accent) 35%, var(--px-border))"
                  : entry
                    ? "var(--px-border2)"
                    : "var(--px-border)",
              borderStyle: isGap ? ("dashed" as const) : ("solid" as const),
              borderWidth: isToday ? 2 : 1,
              background: entry
                ? happiness != null
                  ? `color-mix(in srgb, ${happinessTone(happiness)} 16%, var(--px-bg3))`
                  : "color-mix(in srgb, var(--px-accent) 10%, var(--px-bg3))"
                : isGap
                  ? "color-mix(in srgb, var(--px-accent) 6%, var(--px-bg3))"
                  : "var(--px-bg3)",
              boxShadow: isToday ? "1px 1px 0 #000" : undefined,
              opacity: isFuture ? 0.45 : 1,
            };
            const cellInner = (
              <>
                <span
                  className="text-[13px] font-extrabold leading-none tabular-nums"
                  style={{
                    color: isToday ? "var(--px-accent)" : "var(--px-text)",
                  }}
                >
                  {cell.day}
                </span>
                {entry ? (
                  <>
                    <span
                      className="text-xs font-black tabular-nums leading-none"
                      style={{
                        color:
                          happiness != null
                            ? happinessTone(happiness)
                            : "var(--px-text2)",
                      }}
                    >
                      {happiness != null ? happiness.toFixed(0) : "·"}
                    </span>
                    <span
                      className="text-[9px] font-bold leading-none"
                      style={{ color: "var(--px-text2)" }}
                    >
                      {ganji}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-[9px] font-bold leading-none"
                    style={{
                      color: isGap
                        ? "color-mix(in srgb, var(--px-accent) 55%, var(--px-text2))"
                        : "var(--px-border2)",
                    }}
                  >
                    {isGap ? "빈" : "·"}
                  </span>
                )}
              </>
            );

            if (entry) {
              return (
                <button
                  key={cell.date}
                  type="button"
                  className={cellClass}
                  style={cellStyle}
                  onClick={() => {
                    setDayReport(entry);
                    void import("@/lib/analytics/posthog").then(
                      ({ ANALYTICS_EVENTS, captureEvent, captureUiClick }) => {
                        captureEvent(ANALYTICS_EVENTS.pastEntryOpened, {
                          source: "stats_calendar",
                          has_entry: true,
                        });
                        captureUiClick(
                          ANALYTICS_EVENTS.calendarDaySelected,
                          "calendar_day_select",
                          { is_today: isToday }
                        );
                      }
                    );
                  }}
                  aria-label={`${cell.date} 기록 보기 행복도 ${happiness ?? "·"}`}
                >
                  {cellInner}
                </button>
              );
            }

            if (isFuture) {
              return (
                <div
                  key={cell.date}
                  className={cellClass}
                  style={cellStyle}
                  aria-label={`${cell.date} 미래`}
                >
                  {cellInner}
                </div>
              );
            }

            return (
              <Link
                key={cell.date}
                href={`/journal?date=${cell.date}`}
                className={cellClass}
                style={cellStyle}
                aria-label={`${cell.date} 미기록 · 작성하기`}
                onClick={() => {
                  void import("@/lib/analytics/posthog").then(
                    ({ ANALYTICS_EVENTS, captureEvent, captureUiClick }) => {
                      captureEvent(ANALYTICS_EVENTS.pastEntryOpened, {
                        source: "stats_calendar_empty",
                        has_entry: false,
                      });
                      captureUiClick(
                        ANALYTICS_EVENTS.calendarDaySelected,
                        "calendar_day_select",
                        { is_today: isToday }
                      );
                    }
                  );
                }}
              >
                {cellInner}
              </Link>
            );
          })}
        </div>

        <p className="stats-label tabular-nums">
          기록 {monthList.length}일
          {emptyInMonth > 0 ? ` · 빈 날 ${emptyInMonth}개` : ""}
        </p>
      </div>

      {monthList.length > 0 && (
        <div className="stats-section">
          <p className="stats-label">목록</p>
          {visibleList.map((entry) => {
            const h = dayHappiness(entry);
            const ganji = getPillarsForDate(entry.entryDate).dayPillar.ganjiKo;
            const snippet =
              entry.content?.trim() ||
              entry.moodLabels?.slice(0, 2).join(" · ") ||
              entry.moodLabel ||
              "체크인 기록";
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setDayReport(entry);
                  void import("@/lib/analytics/posthog").then(
                    ({ ANALYTICS_EVENTS, captureUiClick }) => {
                      captureUiClick(
                        ANALYTICS_EVENTS.entryListSelected,
                        "entry_list_select",
                        { is_today: entry.entryDate === today }
                      );
                    }
                  );
                }}
                className="block w-full text-left p-3 border-2"
                style={{
                  background: "var(--px-bg3)",
                  borderColor: "var(--px-border)",
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span
                    className="text-sm font-extrabold tabular-nums"
                    style={{ color: "var(--px-text-on-panel)" }}
                  >
                    {entry.entryDate.slice(5).replace("-", ".")}
                  </span>
                  <span className="text-xs font-extrabold tabular-nums">
                    <span style={{ color: "var(--px-accent)" }}>{ganji}</span>
                    {h != null ? (
                      <span
                        className="ml-1.5"
                        style={{ color: happinessTone(h) }}
                      >
                        {h.toFixed(1)}
                      </span>
                    ) : null}
                  </span>
                </div>
                <p
                  className="text-xs line-clamp-1"
                  style={{ color: "var(--px-text2)" }}
                >
                  {snippet}
                </p>
              </button>
            );
          })}
          {monthList.length > LIST_PREVIEW && (
            <button
              type="button"
              onClick={() => setListExpanded((v) => !v)}
              className="w-full py-2 text-xs font-extrabold border"
              style={{
                borderColor: "var(--px-border)",
                color: "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {listExpanded
                ? "목록 접기"
                : `더보기 +${monthList.length - LIST_PREVIEW}`}
            </button>
          )}
        </div>
      )}

      {dayReport && (
        <JournalDayReportModal
          entry={dayReport}
          onClose={closeDayReport}
        />
      )}
    </section>
  );
}
