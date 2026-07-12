"use client";

import Link from "next/link";
import { DETAIL_SCORE_DIMENSIONS } from "@/lib/diary/dimensions";
import type { DiaryAnalysis } from "@/lib/diary/dimensions";
import type { CollectionSummary } from "@/lib/diary/collection";

type Props = {
  ganjiKo: string;
  wellbeing: number | null;
  analysis: DiaryAnalysis | null;
  summary: CollectionSummary;
  nextSameGanji?: { ganjiKo: string; daysUntil: number; date: string } | null;
  yesterdayWellbeing?: number | null;
};

export default function TodayMiniReport({
  ganjiKo,
  wellbeing,
  analysis,
  summary,
  nextSameGanji,
  yesterdayWellbeing,
}: Props) {
  const topDims = analysis
    ? DETAIL_SCORE_DIMENSIONS.map((d) => {
        const raw = analysis[d.id as keyof DiaryAnalysis];
        return { label: d.label, value: typeof raw === "number" ? raw : null };
      })
        .filter((d) => d.value !== null)
        .sort((a, b) => (b.value as number) - (a.value as number))
        .slice(0, 2)
    : [];

  const delta =
    wellbeing !== null && yesterdayWellbeing != null
      ? wellbeing - yesterdayWellbeing
      : null;

  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-accent)" }}
    >
      <p className="ui-section-title">오늘 기록 완료</p>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-sm font-black" style={{ color: "var(--px-text-on-panel)" }}>
          {ganjiKo}일
          {wellbeing !== null && (
            <span style={{ color: "#4ade80" }}> · 행복도 {wellbeing}</span>
          )}
        </p>
        {delta !== null && delta !== 0 && (
          <span
            className="text-xs font-bold"
            style={{ color: delta > 0 ? "#4ade80" : "#f87171" }}
          >
            어제 대비 {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      {topDims.length > 0 && (
        <p className="ui-hint">
          {topDims.map((d) => `${d.label} ${d.value}`).join(" · ")}
        </p>
      )}
      <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
        도감 {summary.ganjiCollected}/{summary.ganjiTotal}
        {nextSameGanji && (
          <>
            {" "}
            · 다음 {nextSameGanji.ganjiKo}일 D-{nextSameGanji.daysUntil}
          </>
        )}
      </p>
      <Link
        href="/diary/collection"
        className="text-xs font-bold"
        style={{ color: "var(--px-accent)" }}
      >
        간지 도감 보기 →
      </Link>
    </div>
  );
}
