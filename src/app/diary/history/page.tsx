"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { HAPPINESS_RATING_LABELS } from "@/lib/diary/happiness";
import type { DiaryEntry } from "@/lib/diary/types";

function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ date: string | null; day: number | null }> = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null });
  }
  return cells;
}

export default function DiaryHistoryPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDiaryStorage()
      .then((storage) => storage.listByMonth({ year, month }))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, DiaryEntry>();
    for (const entry of entries) map.set(entry.date, entry);
    return map;
  }, [entries]);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 기록 캘린더
        </h2>
        <div className="flex gap-2">
          <Link
            href="/diary/stats"
            className="text-xs font-bold px-2 py-1 border"
            style={{ borderColor: "var(--px-accent)", color: "var(--px-accent)" }}
          >
            통계
          </Link>
          <Link
            href="/diary"
            className="text-xs font-bold px-2 py-1 border"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
          >
            ← 오늘 기록
          </Link>
        </div>
      </div>

      <div
        className="p-3 border-2 space-y-3"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="px-2 py-1 border text-xs font-bold"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
          >
            이전
          </button>
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            {monthLabel(year, month)}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="px-2 py-1 border text-xs font-bold"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
          >
            다음
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((label) => (
            <div key={label} className="text-[11px] font-bold py-1" style={{ color: "var(--px-text2)" }}>
              {label}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell.date || cell.day == null) {
              return <div key={`empty-${index}`} className="min-h-[58px]" />;
            }
            const entry = byDate.get(cell.date);
            const rating = entry?.happinessRating;
            return (
              <Link
                key={cell.date}
                href={`/diary?date=${cell.date}`}
                className="min-h-[58px] border p-1 flex flex-col items-center justify-start gap-0.5"
                style={{
                  borderColor: entry ? "var(--px-accent)" : "var(--px-border)",
                  background: entry
                    ? "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg3))"
                    : "var(--px-bg3)",
                }}
                aria-label={`${cell.date}${entry ? ` 기록됨 행복도 ${rating}` : " 미기록"}`}
              >
                <span className="text-xs font-bold" style={{ color: "var(--px-text-on-panel)" }}>
                  {cell.day}
                </span>
                {entry ? (
                  <>
                    <span className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
                      {rating ?? "·"}
                    </span>
                    <span className="text-[10px] leading-tight line-clamp-1" style={{ color: "var(--px-text2)" }}>
                      {entry.emotions?.[0] ?? entry.dayPillar.ganjiKo}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px]" style={{ color: "var(--px-border2)" }}>
                    미기록
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {loading && <p className="ui-hint">불러오는 중...</p>}
        {!loading && (
          <p className="ui-hint">
            이번 달 {entries.length}일 기록
            {entries[0]?.happinessRating
              ? ` · 최근 기록 ${HAPPINESS_RATING_LABELS[entries[entries.length - 1].happinessRating!]}`
              : ""}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="ui-section-title">이번 달 목록</p>
        {entries.length === 0 && !loading && (
          <p className="ui-hint">이 달에 작성한 일기가 없습니다.</p>
        )}
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <Link
              key={entry.id}
              href={`/diary?date=${entry.date}`}
              className="block p-3 border-2"
              style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
                  {entry.date}
                </span>
                <span className="text-xs" style={{ color: "var(--px-text2)" }}>
                  {entry.dayPillar.ganjiKo}일
                  {entry.happinessRating ? ` · ${entry.happinessRating}점` : ""}
                </span>
              </div>
              <p className="text-xs line-clamp-2" style={{ color: "var(--px-text)" }}>
                {entry.content}
              </p>
            </Link>
          ))}
      </div>
    </div>
  );
}
