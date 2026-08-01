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
import { buildWeekTopicSummary } from "@/lib/journal/topics/weekTopics";
import TrendOverlayChart from "@/components/stats/TrendOverlayChart";
import StatsSummaryStrip from "@/components/stats/StatsSummaryStrip";
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

/** 해당 날짜가 속한 주의 월요일 (KST) */
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  const day = d.getDay(); // 0=일
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

function weekLabel(from: string, to: string): string {
  const a = `${Number(from.slice(5, 7))}.${Number(from.slice(8, 10))}`;
  const b = `${Number(to.slice(5, 7))}.${Number(to.slice(8, 10))}`;
  return `${a}–${b}`;
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
 * 기록 탭 — 요약 → 추이 → 캘린더 → 사주 패턴 → 도감
 */
export default function StatsPage() {
  const today = todayDateString();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [viewYear, setViewYear] = useState(() => Number(today.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(today.slice(5, 7)));
  const [trendSpan, setTrendSpan] = useState<"week" | "month">("month");
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selected, setSelected] = useState<CategoryCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureEvent }) => {
        captureEvent(ANALYTICS_EVENTS.statsOpened, { surface: "stats_tab" });
      }
    );
  }, []);

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

  const weekTopics = useMemo(
    () =>
      buildWeekTopicSummary(journalEntries, {
        asOf: today,
        windowDays: 7,
        topN: 5,
      }),
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

  const weekTo = useMemo(() => shiftDate(weekStart, 6), [weekStart]);

  const trendFrom = trendSpan === "week" ? weekStart : monthFrom;
  const trendTo = trendSpan === "week" ? weekTo : monthTo;

  const prevTrendBounds = useMemo(() => {
    if (trendSpan === "week") {
      const from = shiftDate(weekStart, -7);
      return { from, to: shiftDate(from, 6) };
    }
    const d = new Date(viewYear, viewMonth - 2, 1);
    return monthBounds(d.getFullYear(), d.getMonth() + 1);
  }, [trendSpan, weekStart, viewYear, viewMonth]);

  const rangeDates = useMemo(() => {
    const out: string[] = [];
    let cursor = trendFrom;
    while (cursor <= trendTo) {
      out.push(cursor);
      cursor = shiftDate(cursor, 1);
    }
    return out;
  }, [trendFrom, trendTo]);

  const happinessPoints = useMemo(
    () => happinessSeries(journalEntries, trendFrom, trendTo),
    [journalEntries, trendFrom, trendTo]
  );

  const overlays = useMemo(
    () =>
      selected.map((code, i) => ({
        code,
        name: getCategoryByCode(code)?.name ?? code,
        color: LINE_COLORS[i % LINE_COLORS.length]!,
        points: categorySeries(journalEntries, code, trendFrom, trendTo),
      })),
    [selected, journalEntries, trendFrom, trendTo]
  );

  const rangeAvg = useMemo(() => {
    if (happinessPoints.length === 0) return null;
    const sum = happinessPoints.reduce((a, p) => a + p.value, 0);
    return Math.round((sum / happinessPoints.length) * 10) / 10;
  }, [happinessPoints]);

  const prevRangeAvg = useMemo(
    () =>
      averageHappinessInRange(
        journalEntries,
        prevTrendBounds.from,
        prevTrendBounds.to
      ),
    [journalEntries, prevTrendBounds]
  );

  const periodCompare = useMemo<{ delta: number | null }>(() => {
    if (rangeAvg == null || prevRangeAvg == null) return { delta: null };
    const delta = Math.round((rangeAvg - prevRangeAvg) * 10) / 10;
    if (Math.abs(delta) < 0.3) return { delta: null };
    return { delta };
  }, [rangeAvg, prevRangeAvg]);

  const reflectCta = useMemo(
    () =>
      buildReflectWriteCta(journalEntries, today, {
        viewMonthAvg: rangeAvg,
        prevMonthAvg: prevRangeAvg,
      }),
    [journalEntries, today, rangeAvg, prevRangeAvg]
  );

  const shiftViewMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth() + 1);
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(ANALYTICS_EVENTS.statsMonthChanged, "stats_month_changed");
      }
    );
  };

  const shiftTrend = (dir: -1 | 1) => {
    if (trendSpan === "week") {
      setWeekStart((w) => shiftDate(w, dir * 7));
      return;
    }
    shiftViewMonth(dir);
  };

  const setViewMonthAbsolute = (year: number, month: number) => {
    setViewYear(year);
    setViewMonth(month);
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(ANALYTICS_EVENTS.statsMonthChanged, "stats_month_changed");
      }
    );
  };

  const toggle = (code: CategoryCode) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(
          ANALYTICS_EVENTS.statsCategoriesMenuClicked,
          "stats_categories_menu",
          { category: code }
        );
      }
    );
  };

  const trendPeriodLabel =
    trendSpan === "week"
      ? weekLabel(weekStart, weekTo)
      : monthLabel(viewYear, viewMonth);

  return (
    <div className="stats-page">
      {loading ? (
        <p className="ui-hint">불러오는 중…</p>
      ) : (
        <>
          <StatsSummaryStrip
            avg30={avg30}
            monthRecordedDays={monthRecordedDays}
            streakDays={streak.current}
            recordedToday={streak.recordedToday}
            weekTopics={weekTopics}
          />

          <section className="stats-section">
            <div className="stats-emphasize-head">
              <p className="stats-emphasize-title">행복도 추이</p>
              <p className="tabular-nums shrink-0">
                <span
                  className="text-lg font-black"
                  style={
                    rangeAvg != null
                      ? { color: happinessTone(rangeAvg) }
                      : { color: "var(--px-text2)" }
                  }
                >
                  {rangeAvg != null ? rangeAvg.toFixed(1) : "-"}
                </span>
                {rangeAvg != null ? (
                  <span className="stats-metric-unit">/10</span>
                ) : null}
              </p>
            </div>

            <div className="flex gap-1.5">
              {(
                [
                  ["week", "주"],
                  ["month", "월"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setTrendSpan(id);
                    if (id === "week") setWeekStart(mondayOf(today));
                    void import("@/lib/analytics/posthog").then(
                      ({ ANALYTICS_EVENTS, captureUiClick }) => {
                        captureUiClick(
                          ANALYTICS_EVENTS.statsPeriodSelected,
                          "stats_period",
                          { period: id }
                        );
                      }
                    );
                  }}
                  className={`stats-chip flex-1 text-center${trendSpan === id ? " is-on" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => shiftTrend(-1)}
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
                style={{ color: "var(--px-accent)" }}
              >
                {trendPeriodLabel}
              </p>
              <button
                type="button"
                onClick={() => shiftTrend(1)}
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

            {periodCompare.delta != null ? (
              <p className="stats-label tabular-nums px-0.5">
                {trendSpan === "week" ? "지난주 대비" : "지난달 대비"}{" "}
                <span style={{ color: deltaTone(periodCompare.delta) }}>
                  {periodCompare.delta > 0
                    ? `+${periodCompare.delta.toFixed(1)}`
                    : periodCompare.delta.toFixed(1)}
                </span>
              </p>
            ) : null}

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
                  className="inline-flex items-center gap-1 text-xs font-extrabold"
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
                    className="inline-flex items-center gap-1 text-xs font-bold"
                    style={{ color: o.color }}
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

            <div className="stats-category-panel" aria-label="카테고리 메뉴">
              <div className="flex items-center justify-between gap-2">
                <p className="stats-category-title">카테고리 메뉴</p>
                {selected.length >= 4 ? (
                  <button
                    type="button"
                    onClick={() => setSelected([])}
                    className="stats-link shrink-0 text-xs"
                  >
                    모두 끄기
                  </button>
                ) : null}
              </div>
              {selected.length >= 4 && (
                <p className="stats-status-warn">2~3개만 켜 보세요</p>
              )}
              <div className="flex flex-wrap gap-2">
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
                      className={`stats-chip-cat${on ? " is-on" : ""}`}
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
            </div>
          </section>

          <JournalRecordCalendar
            entries={journalEntries}
            today={today}
            weeklyReport={weeklyReport}
            year={viewYear}
            month={viewMonth}
            showMonthNav={trendSpan === "week"}
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
