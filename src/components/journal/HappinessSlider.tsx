"use client";

import {
  HAPPINESS_DEFAULT_HINT,
  HAPPINESS_LABELS,
  HAPPINESS_MAX,
  HAPPINESS_MIN,
  HAPPINESS_VALUES,
  type HappinessScore,
  clampHappinessScore,
} from "@/lib/journal/happinessScale";

type Props = {
  label: string;
  value: HappinessScore | null;
  onChange: (value: HappinessScore) => void;
  disabled?: boolean;
};

const ACCENT = "#f472b6";

/** 행복도 0~10 슬라이더 */
export default function HappinessSlider({
  label,
  value,
  onChange,
  disabled,
}: Props) {
  const display = value ?? HAPPINESS_DEFAULT_HINT;
  const committed = value != null;

  const commit = (n: number) => {
    if (disabled) return;
    onChange(clampHappinessScore(n));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: ACCENT }}>
            {committed ? HAPPINESS_LABELS[display] : "슬라이더로 골라주세요"}
          </p>
        </div>
        <p
          className="text-5xl font-black tabular-nums leading-none shrink-0"
          style={{
            color: committed ? ACCENT : "var(--px-text2)",
            opacity: committed ? 1 : 0.45,
          }}
          aria-live="polite"
        >
          {committed ? display : "—"}
          <span
            className="font-bold ml-1 text-sm"
            style={{ color: "var(--px-text2)" }}
          >
            /10
          </span>
        </p>
      </div>

      <input
        type="range"
        min={HAPPINESS_MIN}
        max={HAPPINESS_MAX}
        step={1}
        value={display}
        disabled={disabled}
        aria-label={`${label} 점수 0에서 10`}
        aria-valuemin={HAPPINESS_MIN}
        aria-valuemax={HAPPINESS_MAX}
        aria-valuenow={committed ? display : undefined}
        aria-valuetext={
          committed
            ? `${display}점 ${HAPPINESS_LABELS[display]}`
            : "미선택"
        }
        onChange={(e) => commit(Number(e.target.value))}
        className="w-full cursor-pointer h-3 disabled:opacity-50"
        style={{ accentColor: ACCENT }}
      />

      <div className="grid grid-cols-11 gap-0.5">
        {HAPPINESS_VALUES.map((n) => {
          const on = committed && value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-label={`${n}점 ${HAPPINESS_LABELS[n]}`}
              aria-pressed={on}
              onClick={() => commit(n)}
              className="py-2 text-[10px] font-black border tabular-nums"
              style={{
                borderColor: on ? ACCENT : "var(--px-border)",
                color: on ? ACCENT : "var(--px-text2)",
                background: on
                  ? `color-mix(in srgb, ${ACCENT} 18%, var(--px-bg3))`
                  : "var(--px-bg3)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
