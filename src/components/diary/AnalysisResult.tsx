"use client";

import {
  DETAIL_SCORE_DIMENSIONS,
  EMOTION_LABEL_KO,
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
  analysis: DiaryAnalysis;
};

export default function AnalysisResult({ analysis }: Props) {
  const emotionKo = EMOTION_LABEL_KO[analysis.emotion_label] ?? analysis.emotion_label;

  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-between gap-3 p-3 border-2"
        style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
      >
        <div>
          <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
            총 행복도
          </p>
          <p className="text-3xl font-black" style={{ color: "var(--px-accent)" }}>
            {analysis.daily_wellbeing_score}
            <span className="text-sm ml-1">/ 100</span>
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-block px-2 py-1 text-xs font-bold border"
            style={{ borderColor: "var(--px-accent)", color: "var(--px-accent)" }}
          >
            {emotionKo}
          </span>
          <p className="text-[10px] mt-1" style={{ color: "var(--px-text2)" }}>
            신뢰도 {analysis.confidence}%
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-bold" style={{ color: "var(--px-text)" }}>
          {analysis.summary}
        </p>
        {analysis.reason && (
          <p className="text-xs" style={{ color: "var(--px-text2)" }}>
            {analysis.reason}
          </p>
        )}
      </div>

      {analysis.dominant_emotions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {analysis.dominant_emotions.map((e) => (
            <span
              key={e}
              className="text-[10px] px-2 py-0.5 border font-bold"
              style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            >
              {e}
            </span>
          ))}
        </div>
      )}

      {analysis.key_events.length > 0 && (
        <div>
          <p className="text-xs font-bold mb-1" style={{ color: "var(--px-accent)" }}>
            주요 사건
          </p>
          <ul className="text-xs space-y-0.5" style={{ color: "var(--px-text2)" }}>
            {analysis.key_events.map((ev) => (
              <li key={ev}>· {ev}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--px-border)" }}>
        <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          세부 점수 (0–100, 1점 단위)
        </p>
        {DETAIL_SCORE_DIMENSIONS.map((dim) => {
          const value = analysis[dim.id];
          const scoreReason = analysis.score_reasons?.[dim.id];

          if (value === null) {
            return (
              <div key={dim.id} className="opacity-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold w-14 shrink-0" style={{ color: "var(--px-text2)" }}>
                    {dim.label}
                  </span>
                  <span className="text-xs" style={{ color: "var(--px-text2)" }}>
                    해당 없음
                  </span>
                </div>
              </div>
            );
          }

          const color = BAR_COLORS[dim.id] ?? "var(--px-accent)";
          return (
            <div key={dim.id} className="space-y-1">
              <div className="flex items-center gap-2">
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
              {scoreReason && (
                <p className="text-[10px] pl-14 leading-relaxed" style={{ color: "var(--px-text2)" }}>
                  ↳ {scoreReason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
