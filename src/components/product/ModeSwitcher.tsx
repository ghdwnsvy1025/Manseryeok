"use client";

import {
  EXPERIENCE_MODE_HINTS,
  EXPERIENCE_MODE_LABELS,
  type UserExperienceMode,
} from "@/lib/product/modes";

const MODES: UserExperienceMode[] = ["diary", "balanced", "saju", "study"];

type Props = {
  value: UserExperienceMode;
  onChange: (mode: UserExperienceMode) => void;
  compact?: boolean;
};

export default function ModeSwitcher({ value, onChange, compact }: Props) {
  return (
    <div className="space-y-2" role="group" aria-label="경험 모드">
      <div className={`grid gap-1 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {MODES.map((mode) => {
          const active = value === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className="px-2 py-2 text-xs font-bold border-2 text-left"
              style={{
                borderColor: active ? "var(--px-accent)" : "var(--px-border)",
                color: active ? "var(--px-accent)" : "var(--px-text2)",
                background: "var(--px-bg3)",
              }}
              aria-pressed={active}
            >
              {EXPERIENCE_MODE_LABELS[mode]}
            </button>
          );
        })}
      </div>
      {!compact && (
        <p className="ui-hint">{EXPERIENCE_MODE_HINTS[value]}</p>
      )}
    </div>
  );
}
