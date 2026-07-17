"use client";

import Link from "next/link";
import { STATS_INSIGHT_MIN_ENTRIES } from "@/lib/diary/onboarding";
import type { DiaryEntry } from "@/lib/diary/types";

type Props = {
  entries: DiaryEntry[];
  uniqueDays: number;
  daysUntilInsight: number;
  recentWellbeing: number;
  groupLabel: string;
};

export default function StatsSummaryHeader({
  entries,
  uniqueDays,
  daysUntilInsight,
  recentWellbeing,
  groupLabel,
}: Props) {
  return (
    <>
      {uniqueDays < STATS_INSIGHT_MIN_ENTRIES && (
        <div
          className="p-3 border-2"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-accent)" }}
        >
          <p className="ui-section-title">패턴 분석까지 {daysUntilInsight}일 남았어요</p>
          <p className="ui-guide mt-1">
            지금 {uniqueDays}일 기록 · {STATS_INSIGHT_MIN_ENTRIES}일이면 {groupLabel}별 평균 행복도가 더 선명해져요.
          </p>
        </div>
      )}

      <div
        className="p-3 border-2 grid grid-cols-2 gap-3 sm:grid-cols-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
      >
        <div>
          <p className="ui-list-label">전체 일기</p>
          <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
            {entries.length}건
          </p>
        </div>
        <div>
          <p className="ui-list-label">기록 일수</p>
          <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
            {uniqueDays}일
          </p>
        </div>
        <div>
          <p className="ui-list-label">최근 30일 평균 행복도</p>
          <p className="text-lg font-black" style={{ color: "#4ade80" }}>
            {recentWellbeing}점
          </p>
        </div>
      </div>
    </>
  );
}

export function StatsEmptyState() {
  return (
    <div
      className="p-4 border-2 space-y-2"
      style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
    >
      <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
        아직 기록이 없어요
      </p>
      <p className="ui-guide">
        {STATS_INSIGHT_MIN_ENTRIES}일만 기록해도, 년·월·일 간지별 기분 패턴을 볼 수 있어요.
      </p>
      <Link
        href="/diary"
        className="inline-block mt-1 px-3 py-2 text-xs font-bold border-2"
        style={{
          background: "var(--px-accent)",
          borderColor: "#000",
          color: "#000",
          boxShadow: "3px 3px 0 #000",
        }}
      >
        오늘 기록하기
      </Link>
    </div>
  );
}
