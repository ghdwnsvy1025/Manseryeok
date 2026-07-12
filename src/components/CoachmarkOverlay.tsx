"use client";

import { useState } from "react";

type Step = {
  title: string;
  body: string;
};

type Props = {
  steps: Step[];
  onComplete: () => void;
  onSkip: () => void;
};

export default function CoachmarkOverlay({ steps, onComplete, onSkip }: Props) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index >= steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="coachmark-title"
    >
      <div
        className="w-full max-w-sm border-2 p-4 space-y-3"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "6px 6px 0 #000",
        }}
      >
        <p className="ui-hint">
          탐험 모드 가이드 {index + 1}/{steps.length}
        </p>
        <p id="coachmark-title" className="text-base font-black" style={{ color: "var(--px-accent)" }}>
          {step.title}
        </p>
        <p className="ui-guide">
          {step.body}
        </p>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-2 text-xs font-bold border-2"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-text2)",
              background: "var(--px-bg3)",
            }}
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) onComplete();
              else setIndex((i) => i + 1);
            }}
            className="flex-1 px-3 py-2 text-xs font-bold border-2"
            style={{
              borderColor: "#000",
              color: "#000",
              background: "var(--px-accent)",
              boxShadow: "3px 3px 0 #000",
            }}
          >
            {isLast ? "시작하기" : "다음"}
          </button>
        </div>
      </div>
    </div>
  );
}
