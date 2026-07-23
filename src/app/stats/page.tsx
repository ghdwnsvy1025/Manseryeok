"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  buildGanjiCollection,
  getCollectionSummary,
  type GanjiCollectionEntry,
  type GanjiCollectionStatus,
} from "@/lib/diary/collection";
import { createDiaryEntry } from "@/lib/diary/createEntry";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import type { DiaryEntry } from "@/lib/diary/types";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { CATEGORY_CATALOG, getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import {
  buildHomeEStats,
  categorySeries,
  type HappinessPoint,
} from "@/lib/journal/homeStats";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";

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

const STATUS_STYLE: Record<
  GanjiCollectionStatus,
  { border: string; opacity: number }
> = {
  locked: { border: "var(--px-border)", opacity: 0.35 },
  discovered: { border: "#60a5fa", opacity: 1 },
  pattern: { border: "var(--px-accent)", opacity: 1 },
};

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

function shiftDate(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00+09:00`);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MultiLineChart({
  series,
}: {
  series: Array<{ code: CategoryCode; color: string; points: HappinessPoint[] }>;
}) {
  const allDates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date)))
  ).sort();
  if (allDates.length < 2 || series.every((s) => s.points.length === 0)) {
    return (
      <p className="ui-hint py-6 text-center">그래프를 그릴 기록이 부족합니다.</p>
    );
  }
  const w = 320;
  const h = 140;
  const pad = 12;

  const lines = series.map((s) => {
    const map = new Map(s.points.map((p) => [p.date, p.value]));
    const pts = allDates
      .map((date, i) => {
        const v = map.get(date);
        if (v == null) return null;
        const x = pad + (i / Math.max(1, allDates.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - 1) / 9) * (h - pad * 2);
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(" ");
    return { ...s, pts };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-36" role="img">
      {[2, 4, 6, 8, 10].map((v) => {
        const y = h - pad - ((v - 1) / 9) * (h - pad * 2);
        return (
          <line
            key={v}
            x1={pad}
            x2={w - pad}
            y1={y}
            y2={y}
            stroke="var(--px-border)"
            strokeWidth="1"
            opacity={0.5}
          />
        );
      })}
      {lines.map(
        (l) =>
          l.pts && (
            <polyline
              key={l.code}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              points={l.pts}
            />
          )
      )}
    </svg>
  );
}

function CollectionTile({ item }: { item: GanjiCollectionEntry }) {
  const style = STATUS_STYLE[item.status];
  return (
    <div
      className="p-1.5 border text-center min-h-[3.2rem] flex flex-col justify-center"
      style={{
        borderColor: style.border,
        background: "var(--px-bg3)",
        opacity: style.opacity,
      }}
      title={item.status === "locked" ? "미수집" : `${item.entryCount}회`}
    >
      <p
        className="text-xs font-black leading-none"
        style={{
          color: item.status === "locked" ? "var(--px-text2)" : "var(--px-accent)",
        }}
      >
        {item.ganjiKo}
      </p>
      {item.status !== "locked" && (
        <p className="text-[9px] font-bold mt-0.5" style={{ color: "#4ade80" }}>
          {item.entryCount}회
        </p>
      )}
    </div>
  );
}

/**
 * I — 통계: 간지 도감 + A 그래프(7/30일) + 최근 상태
 */
export default function StatsPage() {
  const today = todayDateString();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [range, setRange] = useState<"7" | "30">("7");
  const [selected, setSelected] = useState<CategoryCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentMsg, setRecentMsg] = useState<string | null>(null);
  const [recentOpenAi, setRecentOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);

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
        setSelected(enabled.slice(0, 3));
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

  const eStats = useMemo(
    () => buildHomeEStats(journalEntries, today, enabledCodes),
    [journalEntries, today, enabledCodes]
  );

  const from = range === "7" ? shiftDate(today, -6) : shiftDate(today, -29);

  const chartSeries = useMemo(
    () =>
      selected.map((code, i) => ({
        code,
        color: LINE_COLORS[i % LINE_COLORS.length]!,
        points: categorySeries(journalEntries, code, from, today),
      })),
    [selected, journalEntries, from, today]
  );

  const toggle = (code: CategoryCode) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const loadRecentStatus = async () => {
    setRecentLoading(true);
    setRecentMsg(null);
    try {
      const res = await fetch("/api/journal/recent-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: eStats }),
      });
      const data = (await res.json()) as {
        message?: string;
        openAi?: OpenAiCallStatus;
      };
      setRecentMsg(data.message ?? null);
      setRecentOpenAi(data.openAi ?? null);
    } catch (err) {
      setRecentOpenAi({
        kind: "failed",
        reason: "network",
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setRecentLoading(false);
    }
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="space-y-1">
        <h1 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          ■ 통계
        </h1>
        <p className="ui-hint">간지 도감과 카테고리 추이를 한곳에서 봅니다.</p>
      </header>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="ui-section-title">간지 도감</p>
          <p className="ui-hint">
            {summary.ganjiCollected}/60 · 패턴{" "}
            {collection.filter((c) => c.status === "pattern").length}
          </p>
        </div>
        {loading ? (
          <p className="ui-hint">불러오는 중…</p>
        ) : (
          <div className="grid grid-cols-5 gap-1">
            {collection.map((item) => (
              <CollectionTile key={item.ganjiKo} item={item} />
            ))}
          </div>
        )}
        <Link
          href="/diary/collection"
          className="text-[11px] font-bold underline"
          style={{ color: "#60a5fa" }}
        >
          도감 전체 보기
        </Link>
      </section>

      <section className="space-y-2">
        <p className="ui-section-title">카테고리 추이</p>
        <div className="flex gap-2">
          {(["7", "30"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className="px-3 py-1.5 text-xs font-bold border-2"
              style={{
                borderColor: range === r ? "var(--px-accent)" : "var(--px-border)",
                color: range === r ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
            >
              {r === "7" ? "7일" : "30일"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {(enabledCodes.length > 0
            ? enabledCodes
            : CATEGORY_CATALOG.map((c) => c.code)
          ).map((code, i) => {
            const on = selected.includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                className="px-2 py-1 text-[10px] font-bold border"
                style={{
                  borderColor: on
                    ? LINE_COLORS[i % LINE_COLORS.length]
                    : "var(--px-border)",
                  color: on
                    ? LINE_COLORS[i % LINE_COLORS.length]
                    : "var(--px-text2)",
                }}
              >
                {getCategoryByCode(code)?.name ?? code}
              </button>
            );
          })}
        </div>
        <div
          className="p-2 border-2"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        >
          <MultiLineChart series={chartSeries} />
        </div>
      </section>

      <section className="space-y-2">
        <button
          type="button"
          className="ui-primary-btn w-full py-3 text-sm"
          disabled={recentLoading}
          onClick={() => void loadRecentStatus()}
        >
          {recentLoading ? "분석 중…" : "최근 상태"}
        </button>
        {recentMsg && (
          <div
            className="p-3 border space-y-1"
            style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
          >
            <p className="text-xs leading-relaxed font-bold" style={{ color: "var(--px-text)" }}>
              {recentMsg}
            </p>
            {shouldShowOpenAiStatus() && recentOpenAi && (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                {formatOpenAiStatus(recentOpenAi)}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
