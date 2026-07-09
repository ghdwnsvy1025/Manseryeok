"use client";

import type { DiaryInputMode } from "@/lib/diary/manualScores";

type Props = {
  onSelect: (mode: DiaryInputMode) => void;
};

export default function DiaryModeSelect({ onSelect }: Props) {
  return (
    <div className="space-y-4 py-6">
      <div className="text-center space-y-1 mb-6">
        <p className="text-sm font-bold" style={{ color: "var(--px-text)" }}>
          오늘 하루를 어떻게 기록할까요?
        </p>
        <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
          편한 방식을 골라주세요
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSelect("scores")}
        className="w-full p-5 border-2 text-left transition-transform active:translate-y-0.5"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-sm font-black mb-1" style={{ color: "var(--px-accent)" }}>
          점수로 기록
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
          슬라이더만 움직여서 빠르게 기록해요. 글쓰기가 부담스러울 때 추천합니다.
        </p>
      </button>

      <button
        type="button"
        onClick={() => onSelect("text")}
        className="w-full p-5 border-2 text-left transition-transform active:translate-y-0.5"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-sm font-black mb-1" style={{ color: "var(--px-text)" }}>
          글로 기록
        </p>
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
          자유롭게 글을 쓰고 AI 심리 분석을 받을 수 있어요.
        </p>
      </button>
    </div>
  );
}
