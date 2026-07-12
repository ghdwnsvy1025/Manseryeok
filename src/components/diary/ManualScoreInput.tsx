"use client";

import ScoreSlider from "@/components/diary/ScoreSlider";
import { DETAIL_SCORE_DIMENSIONS } from "@/lib/diary/dimensions";
import type { ManualScoreState } from "@/lib/diary/manualScores";
import {
  manualStateToAnalysis,
  updateDetailScore,
} from "@/lib/diary/manualScores";

const NEGATIVE_DETAIL_IDS = new Set(["depression_score", "anxiety_score", "stress_score"]);

const SLIDER_COLORS: Record<string, string> = {
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
  state: ManualScoreState;
  onChange: (state: ManualScoreState) => void;
  disabled?: boolean;
};

export default function ManualScoreInput({ state, onChange, disabled }: Props) {
  const handleDetailChange = (key: (typeof DETAIL_SCORE_DIMENSIONS)[number]["id"], value: number) => {
    onChange(updateDetailScore(state, key, value));
  };

  const toggleRelationship = () => {
    if (state.details.relationship_score === null) {
      onChange(updateDetailScore(state, "relationship_score", 50));
    } else {
      onChange(updateDetailScore(state, "relationship_score", null));
    }
  };

  const preview = manualStateToAnalysis(state);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="ui-section-title">
          세부 점수 (0–100)
        </p>
        {DETAIL_SCORE_DIMENSIONS.map((dim) => {
          if (dim.id === "relationship_score") {
            const relValue = state.details.relationship_score;
            return (
              <div key={dim.id} className="space-y-1">
                <label className="flex items-center gap-2 ui-list-label cursor-pointer">
                  <input
                    type="checkbox"
                    checked={relValue !== null}
                    onChange={toggleRelationship}
                    disabled={disabled}
                    className="accent-[var(--px-accent)]"
                  />
                  <span className="ui-list-label">관계 점수 입력</span>
                </label>
                {relValue !== null && (
                  <ScoreSlider
                    label={dim.label}
                    value={relValue}
                    onChange={(v) => handleDetailChange(dim.id, v)}
                    color={SLIDER_COLORS[dim.id]}
                    disabled={disabled}
                  />
                )}
              </div>
            );
          }

          const value = state.details[dim.id];
          return (
            <ScoreSlider
              key={dim.id}
              label={dim.label}
              value={value}
              onChange={(v) => handleDetailChange(dim.id, v)}
              color={SLIDER_COLORS[dim.id] ?? "var(--px-accent)"}
              disabled={disabled}
              invertZones={NEGATIVE_DETAIL_IDS.has(dim.id)}
            />
          );
        })}
      </div>

      <div
        className="p-3 border-2 space-y-1"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
      >
        <p className="ui-section-title">
          종합 행복도
        </p>
        <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          {preview.daily_wellbeing_score}
          <span className="text-xs ml-1">/ 100</span>
        </p>
        <p className="ui-hint">
          위 세부 점수를 바탕으로 자동 계산됩니다.
        </p>
      </div>
    </div>
  );
}
