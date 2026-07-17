"use client";

import { useState } from "react";
import ScoreSlider from "@/components/diary/ScoreSlider";
import {
  MANUAL_WELLBEING_DIMENSIONS,
  manualStateToAnalysis,
  updateManualWellbeingScore,
  type ManualScoreState,
  type ManualWellbeingId,
} from "@/lib/diary/manualScores";

type Props = {
  state: ManualScoreState;
  onChange: (state: ManualScoreState) => void;
  disabled?: boolean;
};

export default function ManualScoreInput({ state, onChange, disabled }: Props) {
  const [selectedIds, setSelectedIds] = useState<ManualWellbeingId[]>([]);
  const preview = manualStateToAnalysis(state);

  const handleDetailChange = (key: ManualWellbeingId, value: number) => {
    onChange(updateManualWellbeingScore(state, key, value));
  };

  const toggleDimension = (id: ManualWellbeingId) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((current) =>
        current.filter((selectedId) => selectedId !== id)
      );
      return;
    }
    onChange(
      updateManualWellbeingScore(state, id, preview.daily_wellbeing_score)
    );
    setSelectedIds((current) => [...current, id]);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-black" style={{ color: "#60a5fa" }}>
              조절할 항목 선택
            </p>
            <p className="ui-hint text-xs">원하는 항목만 조절하세요.</p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MANUAL_WELLBEING_DIMENSIONS.map((dim) => {
              const selected = selectedIds.includes(dim.id);
              return (
                <button
                  key={dim.id}
                  type="button"
                  onClick={() => toggleDimension(dim.id)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className="relative min-w-0 w-full min-h-[48px] px-1 py-2.5 border text-[15px] leading-tight font-bold break-keep"
                  style={{
                    borderColor: selected
                      ? dim.color
                      : "var(--px-border)",
                    background: selected
                      ? "var(--px-bg3)"
                      : "var(--px-bg2)",
                    color: selected
                      ? dim.color
                      : "var(--px-text2)",
                  }}
                >
                  {selected && (
                    <span className="absolute top-1 left-1 text-[10px]">✓</span>
                  )}
                  {dim.label}
                </button>
              );
            })}
          </div>
        </div>

        {selectedIds.length > 0 &&
          MANUAL_WELLBEING_DIMENSIONS.filter((dim) =>
            selectedIds.includes(dim.id)
          ).map((dim) => (
            <ScoreSlider
              key={dim.id}
              label={dim.label}
              value={state.dimensions[dim.id]}
              onChange={(v) => handleDetailChange(dim.id, v)}
              color={dim.color}
              disabled={disabled}
            />
          ))}
      </div>

      <div
        className="p-3 border-2 space-y-1 text-center"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
      >
        <p className="text-[20px] font-black">
          종합 행복도
        </p>
        <p className="text-[20px] font-black" style={{ color: "var(--px-accent)" }}>
          {preview.daily_wellbeing_score}
          <span className="ml-1">/ 100</span>
        </p>
      </div>
    </div>
  );
}
