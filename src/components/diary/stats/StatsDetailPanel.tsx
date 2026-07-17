"use client";

import Link from "next/link";
import ScoreBars from "@/components/diary/ScoreBars";
import {
  EMOTION_LABEL_KO,
  type EmotionLabel,
} from "@/lib/diary/dimensions";
import type { DiaryEntry, GroupStats } from "@/lib/diary/types";

type Props = {
  stats: GroupStats;
  entries: DiaryEntry[];
  overallAvg: number;
};

export default function StatsDetailPanel({ stats, entries, overallAvg }: Props) {
  const delta = stats.avgDailyWellbeing - overallAvg;

  return (
    <div
      className="p-3 border-2 space-y-3"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)", boxShadow: "3px 3px 0 #000" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            {stats.label}
          </p>
          <p className="ui-hint mt-0.5">
            {stats.entryCount}회 기록
            {stats.analyzedCount > 0 && ` · 분석 ${stats.analyzedCount}건`}
          </p>
        </div>
        {stats.avgDailyWellbeing > 0 && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-black" style={{ color: "#4ade80" }}>
              {stats.avgDailyWellbeing}
            </p>
            {delta !== 0 && overallAvg > 0 && (
              <p
                className="text-xs font-bold"
                style={{ color: delta > 0 ? "#4ade80" : "#f87171" }}
              >
                내 평균 대비 {delta > 0 ? `+${delta}` : delta}
              </p>
            )}
          </div>
        )}
      </div>

      {stats.analyzedCount > 0 ? (
        <ScoreBars avgScores={stats.avgScores} avgDailyWellbeing={stats.avgDailyWellbeing} />
      ) : (
        <p className="ui-guide">분석된 일기가 없어요. 점수로 기록하거나 AI 분석을 실행해주세요.</p>
      )}

      {stats.explicitMoodCount > 0 && (
        <div className="space-y-1.5">
          <p className="ui-list-label">
            직접 선택한 기분 · {stats.explicitMoodCount}회
          </p>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(stats.moodCounts) as [EmotionLabel, number][]).map(
              ([mood, count]) => (
                <span
                  key={mood}
                  className="px-2 py-1 border text-xs font-bold"
                  style={{
                    borderColor: "var(--px-border)",
                    background: "var(--px-bg2)",
                    color: "var(--px-text2)",
                  }}
                >
                  {EMOTION_LABEL_KO[mood]} {count}
                </span>
              )
            )}
          </div>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          개별 일기
        </p>
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/diary?date=${entry.date}`}
            className="block p-2 border"
            style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
          >
            <div className="flex justify-between text-xs font-bold mb-1">
              <span style={{ color: "var(--px-accent)" }}>{entry.date}</span>
              {entry.analysis && (
                <span style={{ color: "#4ade80" }}>
                  행복도 {entry.analysis.daily_wellbeing_score}
                </span>
              )}
            </div>
            {entry.analysis && <p className="ui-hint">{entry.analysis.summary}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
