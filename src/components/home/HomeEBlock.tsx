"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { HomeEStats } from "@/lib/journal/homeStats";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";

type Props = {
  stats: HomeEStats;
};

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return (
      <div
        className="h-12 flex items-center justify-center text-[10px]"
        style={{ color: "var(--px-text2)", background: "var(--px-bg3)" }}
      >
        기록이 더 쌓이면 추이가 보여요
      </div>
    );
  }
  const min = Math.min(...values, 1);
  const max = Math.max(...values, 10);
  const span = Math.max(0.1, max - min);
  const w = 280;
  const h = 48;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 8) + 4;
      const y = h - 4 - ((v - min) / span) * (h - 8);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" aria-hidden>
      <polyline
        fill="none"
        stroke="var(--px-accent)"
        strokeWidth="2"
        points={pts}
      />
    </svg>
  );
}

export default function HomeEBlock({ stats }: Props) {
  const [moodText, setMoodText] = useState<string | null>(null);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);

  const seriesValues = useMemo(
    () => stats.series30.map((p) => p.value),
    [stats.series30]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/journal/recent-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stats }),
        });
        const data = (await res.json()) as {
          message?: string;
          openAi?: OpenAiCallStatus;
        };
        if (cancelled) return;
        setMoodText(data.message ?? null);
        setOpenAi(data.openAi ?? null);
      } catch {
        if (!cancelled) setMoodText(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stats.avg7, stats.avg30, stats.best?.code, stats.worst?.code, stats.uniqueDays]);

  const lv = stats.level;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="ui-section-title">■ 내 기록 통계</p>
        <Link
          href="/stats"
          className="text-[11px] font-bold underline"
          style={{ color: "#60a5fa" }}
        >
          통계 더보기
        </Link>
      </div>

      <div
        className="grid grid-cols-2 gap-2"
      >
        <div
          className="p-3 border-2 space-y-1"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
            최근 7일 행복도
          </p>
          <p className="text-xl font-black" style={{ color: "var(--px-accent)" }}>
            {stats.avg7 != null ? stats.avg7.toFixed(1) : "-"}
            <span className="text-xs font-bold ml-1" style={{ color: "var(--px-text2)" }}>
              / 10
            </span>
          </p>
        </div>
        <div
          className="p-3 border-2 space-y-1"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
            최근 30일 행복도
          </p>
          <p className="text-xl font-black" style={{ color: "var(--px-accent)" }}>
            {stats.avg30 != null ? stats.avg30.toFixed(1) : "-"}
            <span className="text-xs font-bold ml-1" style={{ color: "var(--px-text2)" }}>
              / 10
            </span>
          </p>
        </div>
      </div>

      <div
        className="p-3 border-2 space-y-2"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
          행복도 추이 (30일)
        </p>
        <MiniSparkline values={seriesValues} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className="p-2.5 border"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <p className="text-[10px] font-bold" style={{ color: "#4ade80" }}>
            Best (7일)
          </p>
          <p className="text-xs font-black" style={{ color: "var(--px-text)" }}>
            {stats.best
              ? `${stats.best.name} ${stats.best.average}/10`
              : "데이터 없음"}
          </p>
        </div>
        <div
          className="p-2.5 border"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <p className="text-[10px] font-bold" style={{ color: "#f87171" }}>
            Worst (7일)
          </p>
          <p className="text-xs font-black" style={{ color: "var(--px-text)" }}>
            {stats.worst
              ? `${stats.worst.name} ${stats.worst.average}/10`
              : "데이터 없음"}
          </p>
        </div>
      </div>

      <div
        className="p-3 border-2 space-y-1.5"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <div className="flex justify-between items-baseline">
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            L{lv.level}
          </p>
          <p className="ui-hint">
            {lv.isMax ? "MAX" : `다음까지 ${lv.xpToNext} XP`} · 기록 {stats.uniqueDays}일
          </p>
        </div>
        <div
          className="h-2.5 border overflow-hidden"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${Math.round(lv.progressRatio * 100)}%`,
              background: "var(--px-accent)",
            }}
          />
        </div>
      </div>

      {moodText && (
        <div
          className="p-3 border space-y-1"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <p className="text-[10px] font-black" style={{ color: "var(--px-accent)" }}>
            요즘의 상태
          </p>
          <p className="text-xs leading-relaxed font-bold" style={{ color: "var(--px-text)" }}>
            {moodText}
          </p>
          {shouldShowOpenAiStatus() && openAi && (
            <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
              {formatOpenAiStatus(openAi)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
