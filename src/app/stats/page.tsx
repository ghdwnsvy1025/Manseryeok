"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  buildGanjiCollection,
  getCollectionSummary,
} from "@/lib/diary/collection";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import type { DiaryEntry } from "@/lib/diary/types";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { CATEGORY_CATALOG, getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import {
  averageHappinessInRange,
  categorySeries,
  happinessSeries,
} from "@/lib/journal/homeStats";
import {
  buildCollectionMission,
  buildReflectWriteCta,
  buildWeeklyReport,
  computeRecordStreak,
  happinessByGanji,
} from "@/lib/journal/statsInsight";
import TrendOverlayChart from "@/components/stats/TrendOverlayChart";
import StatsSummaryStrip from "@/components/stats/StatsSummaryStrip";
import StatsMissionChip from "@/components/stats/StatsMissionChip";
import StatsReflectCta from "@/components/stats/StatsReflectCta";
import JournalRecordCalendar from "@/components/stats/JournalRecordCalendar";
import CharacterHappinessHeatmap from "@/components/stats/CharacterHappinessHeatmap";
import StatsGanjiCollection from "@/components/stats/StatsGanjiCollection";
import { deltaTone, happinessTone } from "@/lib/journal/statsTone";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";

/** 일기·저널 날짜를 합쳐 도감용 엔트리 생성 (날짜당 1건) */
function collectionSourceEntries(
  diary: DiaryEntry[],
  journal: JournalEntry[]
): DiaryEntry[] {
  const byDate = new Map<string, DiaryEntry>();
  for (const e of diary) {
    const prev = byDate.get(e.date);
    if (!prev || e.updatedAt >= prev.updatedAt) byDate.set(e.date, e);
  }
  for (const e of journal) {
    if (byDate.has(e.entryDate)) continue;
    byDate.set(e.entryDate, createDiaryEntry(e.entryDate, "", { id: `j-${e.id}` }));
  }
  return Array.from(byDate.values());
}

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function monthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

const LINE_COLORS = [
  "#fbbf24",
  "#60a5fa",
  "#4ade80",
  "#f87171",
  "#c084fc",
  "#fb923c",
  "#2dd4bf",
  "#f472b6",
  "#a3e635",
];

/**
 * 기록 탭 — 홈(대시보드)과 역할 분리
 * 요약 → 추이 → 캘린더 → 사주 패턴 → 도감
 */
export default function StatsPage() {
  const today = todayDateString();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [viewYear, setViewYear] = useState(() => Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<CategoryCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [diaryStore, journalStore] = await Promise.all([
          getDiaryStorage(),
          getJournalStorage(),
        ]);
        const [dList, jList, prefs] = await Promise.all([
          diaryStore.list(),
          journalStore.list(),
          journalStore.getPreferences(),
        ]);
        if (cancelled) return;
        setDiaryEntries(dList);
        setJournalEntries(jList);
        const enabled = getEnabledCodesOrdered(prefs);
        setEnabledCodes(enabled);
        setSelected(enabled.slice(0, 1));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const collectionEntries = useMemo(
    () => collectionSourceEntries(diaryEntries, journalEntries),
    [diaryEntries, journalEntries]
  );
  const collection = useMemo(
    () => buildGanjiCollection(collectionEntries),
    [collectionEntries]
  );
  const summary = useMemo(
    () => getCollectionSummary(collectionEntries),
    [collectionEntries]
  );
  const ganjiHappiness = useMemo(
    () => happinessByGanji(journalEntries),
    [journalEntries]
  );

  const weeklyReport = useMemo(
    () => buildWeeklyReport(journalEntries, today),
    [journalEntries, today]
  );

  const streak = useMemo(
    () => computeRecordStreak(journalEntries, today),
    [journalEntries, today]
  );

  const mission = useMemo(
    () =>
      buildCollectionMission(
        journalEntries,
        today,
        collection.map((c) => ({
          ganjiKo: c.ganjiKo,
          status: c.status,
          entryCount: c.entryCount,
        }))
      ),
    [journalEntries, today, collection]
  );

  const avg30 = useMemo(
    () => averageHappinessInRange(journalEntries, shiftDate(today, -29), today),
    [journalEntries, today]
  );

  const uniqueDays = useMemo(
    () => new Set(journalEntries.map((e) => e.entryDate)).size,
    [journalEntries]
  );

  const monthRecordedDays = useMemo(() => {
    const prefix = today.slice(0, 7);
    const dates = new Set(
      journalEntries
        .filter((e) => e.entryDate.startsWith(prefix))
        .map((e) => e.entryDate)
    );
    return dates.size;
  }, [journalEntries, today]);

  const { from: monthFrom, to: monthTo } = useMemo(
    () => monthBounds(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const prevMonthBounds = useMemo(() => {
    const d = new Date(viewYear, viewMonth - 2, 1);
    return monthBounds(d.getFullYear(), d.getMonth() + 1);
  }, [viewYear, viewMonth]);

  const rangeDates = useMemo(() => {
    const out: string[] = [];
    let cursor = monthFrom;
    while (cursor <= monthTo) {
      out.push(cursor);
      cursor = shiftDate(cursor, 1);
    }
    return out;
  }, [monthFrom, monthTo]);

  const happinessPoints = useMemo(
    () => happinessSeries(journalEntries, monthFrom, monthTo),
    [journalEntries, monthFrom, monthTo]
  );

  const overlays = useMemo(
    () =>
      selected.map((code, i) => ({
        code,
        name: getCategoryByCode(code)?.name ?? code,
        color: LINE_COLORS[i % LINE_COLORS.length]!,
        points: categorySeries(journalEntries, code, monthFrom, monthTo),
      })),
    [selected, journalEntries, monthFrom, monthTo]
  );

  const rangeAvg = useMemo(() => {
    if (happinessPoints.length === 0) return null;
    const sum = happinessPoints.reduce((a, p) => a + p.value, 0);
    return Math.round((sum / happinessPoints.length) * 10) / 10;
  }, [happinessPoints]);

  const prevMonthAvg = useMemo(
    () =>
      averageHappinessInRange(
        journalEntries,
        prevMonthBounds.from,
        prevMonthBounds.to
      ),
    [journalEntries, prevMonthBounds]
  );

  /** 월 비교 — 문장과 증감 숫자를 나눠 증감에만 색을 준다 */
  const monthCompare = useMemo<{ text: string; delta: number | null }>(() => {
    if (rangeAvg == null && prevMonthAvg == null) {
      return { text: "기록이 쌓이면 지난달과 비교할 수 있어요", delta: null };
    }
    if (rangeAvg == null) {
      return { text: "이달 기록이 아직 없어요", delta: null };
    }
    if (prevMonthAvg == null) {
      return { text: "지난달 기록이 없어 비교는 다음 달부터", delta: null };
    }
    const delta = Math.round((rangeAvg - prevMonthAvg) * 10) / 10;
    if (Math.abs(delta) < 0.3) {
      return { text: "지난달과 비슷해요", delta: null };
    }
    return { text: "지난달보다", delta };
  }, [rangeAvg, prevMonthAvg]);

  const reflectCta = useMemo(
    () =>
      buildReflectWriteCta(journalEntries, today, {
        viewMonthAvg: rangeAvg,
        prevMonthAvg,
      }),
    [journalEntries, today, rangeAvg, prevMonthAvg]
  );

  const shiftViewMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
  };

  const setViewMonthAbsolute = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
  };

  const toggle = (code: CategoryCode) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <div className="stats-page">
      <header className="space-y-0.5">
        <h1 className="ui-page-title">■ 기록</h1>
        <p className="ui-hint">숫자로 보고, 간지로 모읍니다</p>
      </header>

      {loading ? (
        <p className="ui-hint">불러오는 중…</p>
      ) : (
        <>
          <StatsSummaryStrip
            avg30={avg30}
            monthRecordedDays={monthRecordedDays}
            streakDays={streak.current}
            recordedToday={streak.recordedToday}
          />

          <StatsMissionChip mission={mission} />

          <div className="stats-section">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => shiftViewMonth(-1)}
                className="px-2.5 py-1.5 text-xs font-bold border-2"
                style={{
                  borderColor: "var(--px-border)",
                  color: "var(--px-text2)",
                  background: "var(--px-bg3)",
                }}
              >
                ‹
              </button>
              <p
                className="text-base font-black tabular-nums"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {monthLabel(viewYear, viewMonth)}
              </p>
              <button
                type="button"
                onClick={() => shiftViewMonth(1)}
                className="px-2.5 py-1.5 text-xs font-bold border-2"
                style={{
                  borderColor: "var(--px-border)",
                  color: "var(--px-text2)",
                  background: "var(--px-bg3)",
                }}
              >
                ›
              </button>
            </div>
            <p className="stats-insight">
              {monthCompare.text}
              {monthCompare.delta != null ? (
                <span
                  className="ml-1 tabular-nums"
                  style={{ color: deltaTone(monthCompare.delta) }}
                >
                  {monthCompare.delta > 0
                    ? `+${monthCompare.delta.toFixed(1)}`
                    : monthCompare.delta.toFixed(1)}
                </span>
              ) : null}
            </p>
          </div>

          <section className="stats-section">
            <div className="stats-section-head">
              <p className="ui-section-title">행복도 추이</p>
              <p className="tabular-nums shrink-0">
                <span
                  className="stats-metric !text-lg"
                  style={
                    rangeAvg != null
                      ? { color: happinessTone(rangeAvg) }
                      : undefined
                  }
                >
                  {rangeAvg != null ? rangeAvg.toFixed(1) : "-"}
                </span>
                {rangeAvg != null ? (
                  <span className="stats-metric-unit">/10</span>
                ) : null}
                {happinessPoints.length > 0 ? (
                  <span className="stats-label ml-1.5">
                    {happinessPoints.length}일
                  </span>
                ) : null}
              </p>
            </div>

            <div className="stats-panel space-y-2">
              <TrendOverlayChart
                happiness={happinessPoints}
                overlays={overlays}
                dates={rangeDates}
              />
              <div
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2"
                style={{ borderTop: "1px solid var(--px-border)" }}
              >
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold"
                  style={{ color: "var(--px-text)" }}
                >
                  <span
                    className="inline-block w-4 h-[3px]"
                    style={{ background: "var(--px-accent)" }}
                    aria-hidden
                  />
                  행복도
                </span>
                {overlays.map((o) => (
                  <span
                    key={o.code}
                    className="inline-flex items-center gap-1 text-[11px] font-bold"
                    style={{ color: "var(--px-text2)" }}
                  >
                    <span
                      className="inline-block w-4 h-0.5"
                      style={{
                        background: `repeating-linear-gradient(90deg, ${o.color} 0 4px, transparent 4px 7px)`,
                      }}
                      aria-hidden
                    />
                    {o.name}
                  </span>
                ))}
              </div>
            </div>

            {selected.length >= 4 ? (
              <div
                className="px-2.5 py-2 border-2 flex items-center justify-between gap-2"
                role="status"
                style={{
                  borderColor: "#fbbf24",
                  background:
                    "color-mix(in srgb, #fbbf24 12%, var(--px-bg3))",
                }}
              >
                <p className="stats-status-warn">
                  겹침 {selected.length}개 · 비교할 항목만 남기세요
                </p>
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="stats-link shrink-0"
                >
                  모두 끄기
                </button>
              </div>
            ) : (
              <p className="stats-label">겹쳐 볼 항목</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {(enabledCodes.length > 0
                ? enabledCodes
                : CATEGORY_CATALOG.map((c) => c.code)
              ).map((code) => {
                const on = selected.includes(code);
                const colorIdx = selected.indexOf(code);
                const color =
                  on && colorIdx >= 0
                    ? LINE_COLORS[colorIdx % LINE_COLORS.length]
                    : undefined;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggle(code)}
                    className={`stats-chip${on ? " is-on" : ""}`}
                    style={
                      on && color
                        ? ({
                            ["--chip-accent" as string]: color,
                          } as CSSProperties)
                        : undefined
                    }
                    aria-pressed={on}
                  >
                    {getCategoryByCode(code)?.name ?? code}
                  </button>
                );
              })}
            </div>
          </section>

          <JournalRecordCalendar
            entries={journalEntries}
            today={today}
            weeklyReport={weeklyReport}
            year={viewYear}
            month={viewMonth}
            onMonthChange={setViewMonthAbsolute}
          />

          <StatsReflectCta cta={reflectCta} />

          <CharacterHappinessHeatmap
            entries={journalEntries}
            uniqueDays={uniqueDays}
          />

          <StatsGanjiCollection
            collection={collection}
            collected={summary.ganjiCollected}
            patternCount={
              collection.filter((c) => c.status === "pattern").length
            }
            ganjiHappiness={ganjiHappiness}
            mission={mission}
            showMissionBanner={false}
          />
        </>
      )}
    </div>
  );
}
