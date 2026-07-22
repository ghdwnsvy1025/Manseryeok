"use client";

import type { MatchFeedbackLevel } from "@/lib/forecast/types";

const OPTIONS: Array<{ id: MatchFeedbackLevel; label: string }> = [
  { id: "match", label: "맞는 것 같아요" },
  { id: "partial", label: "일부만 맞아요" },
  { id: "mismatch", label: "아닌 것 같아요" },
  { id: "unknown", label: "잘 모르겠어요" },
];

type Props = {
  title: string;
  value: MatchFeedbackLevel | null;
  onChange: (value: MatchFeedbackLevel) => void;
  disabled?: boolean;
};

export default function ForecastMatchFeedback({
  title,
  value,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1">
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.id)}
              className="px-2 py-1.5 text-[11px] font-bold border"
              style={{
                borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
                background: selected
                  ? "color-mix(in srgb, var(--px-accent) 16%, var(--px-bg2))"
                  : "var(--px-bg3)",
                color: selected ? "var(--px-accent)" : "var(--px-text2)",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
