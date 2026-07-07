"use client";

import {
  DETAIL_SCORE_DIMENSIONS,
  type DiaryAnalysis,
} from "@/lib/diary/dimensions";

const BAR_COLORS: Record<string, string> = {
  depression_score: "#94a3b8",
  anxiety_score: "#f87171",
  stress_score: "#fb923c",
  achievement_score: "#fbbf24",
  meaning_score: "#a78bfa",
  energy_score: "#60a5fa",
  relationship_score: "#f472b6",
  gratitude_score: "#34d399",
  self_acceptance_score: "#818cf8",
};

type Props = {
  avgScores: Partial<Record<keyof DiaryAnalysis, number>>;
  avgDailyWellbeing?: number;
};

export default function ScoreBars({ avgScores, avgDailyWellbeing }: Props) {
  return (
    <div className="space-y-2">
      {avgDailyWellbeing !== undefined && (
        <div className="flex items-center justify-between mb-3 pb-2 border-b" style={{ borderColor: "var(--px-border)" }}>
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            평균 총 행복도
          </span>
          <span className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
            {avgDailyWellbeing}
          </span>
        </div>
      )}
      {DETAIL_SCORE_DIMENSIONS.map((dim) => {
        const value = avgScores[dim.id];
        if (value === undefined) return null;
        const color = BAR_COLORS[dim.id] ?? "var(--px-accent)";
        return (
          <div key={dim.id} className="flex items-center gap-2">
            <span className="text-xs font-bold w-14 shrink-0" style={{ color }}>
              {dim.label}
            </span>
            <div
              className="flex-1 h-4 border"
              style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
            >
              <div
                className="h-full transition-all"
                style={{
                  width: `${value}%`,
                  background: color,
                  boxShadow: `0 0 6px ${color}88`,
                }}
              />
            </div>
            <span className="text-xs font-bold w-8 text-right" style={{ color }}>
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
