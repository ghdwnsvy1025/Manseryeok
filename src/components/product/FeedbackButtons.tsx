"use client";

import {
  ANALYSIS_FEEDBACK_LABELS,
  type AnalysisFeedback,
} from "@/lib/product/lifeAreas";

type Props = {
  value: AnalysisFeedback | null;
  onChange: (value: AnalysisFeedback) => void;
  disabled?: boolean;
};

export default function FeedbackButtons({ value, onChange, disabled }: Props) {
  const options = Object.entries(ANALYSIS_FEEDBACK_LABELS) as Array<
    [AnalysisFeedback, string]
  >;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="분석 피드백">
      {options.map(([id, label]) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            className="px-2 py-1.5 text-[11px] font-bold border"
            style={{
              borderColor: active ? "var(--px-accent)" : "var(--px-border)",
              color: active ? "var(--px-accent)" : "var(--px-text2)",
              background: "var(--px-bg3)",
            }}
            aria-pressed={active}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
