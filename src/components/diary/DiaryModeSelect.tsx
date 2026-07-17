"use client";

import type { DiaryInputMode } from "@/lib/diary/manualScores";

type Props = {
  value: DiaryInputMode | null;
  onSelect: (mode: DiaryInputMode) => void;
  disabled?: boolean;
};

export default function DiaryModeSelect({ value, onSelect, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="기록 방식">
      <button
        type="button"
        onClick={() => onSelect("scores")}
        disabled={disabled}
        aria-pressed={value === "scores"}
        className="w-full h-[88px] p-3 border-2 text-center flex flex-col items-center justify-center transition-transform active:translate-y-0.5"
        style={{
          background:
            value === "scores"
              ? "color-mix(in srgb, #60a5fa 14%, var(--px-bg2))"
              : "var(--px-bg3)",
          borderColor: value === "scores" ? "#60a5fa" : "var(--px-border)",
          boxShadow: value === "scores" ? "3px 3px 0 #1e3a5f" : "none",
        }}
      >
        <p className="text-sm font-black mb-1" style={{ color: "#60a5fa" }}>
          빠른 기록
        </p>
        <p className="ui-hint leading-tight min-h-[2rem] flex items-center justify-center">
          10초 만에 저장
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect("text")}
        disabled={disabled}
        aria-pressed={value === "text"}
        className="w-full h-[88px] p-3 border-2 text-center flex flex-col items-center justify-center transition-transform active:translate-y-0.5"
        style={{
          background:
            value === "text"
              ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg2))"
              : "var(--px-bg3)",
          borderColor: value === "text" ? "var(--px-accent)" : "var(--px-border)",
          boxShadow: value === "text" ? "3px 3px 0 #4a3a00" : "none",
        }}
      >
        <p className="text-sm font-black mb-1" style={{ color: "var(--px-accent)" }}>
          일기 기록
        </p>
        <p className="ui-hint leading-tight min-h-[2rem] flex items-center justify-center">
          일기 + AI 마음 분석
        </p>
      </button>
    </div>
  );
}
