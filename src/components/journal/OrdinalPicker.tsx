"use client";

import {
  ORDINAL_LABELS,
  ORDINAL_VALUES,
  type OrdinalScore,
} from "@/lib/journal/checkin/catalog";
import { celebrateClick } from "@/lib/ui/clickBurst";

type Props = {
  label: string;
  value: OrdinalScore | null;
  onChange: (value: OrdinalScore) => void;
  disabled?: boolean;
  /** 기본: 매우 나쁨~매우 좋음. 사건 반응용으로 짧은 라벨을 넘길 수 있음 */
  labels?: Record<OrdinalScore, string>;
};

export default function OrdinalPicker({
  label,
  value,
  onChange,
  disabled,
  labels = ORDINAL_LABELS,
}: Props) {
  return (
    <div
      className="grid grid-cols-5 gap-1"
      role="group"
      aria-label={`${label} 1에서 5`}
    >
      {ORDINAL_VALUES.map((n) => {
        const on = value === n;
        const text = labels[n];
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            aria-label={`${n} · ${text}`}
            aria-pressed={on}
            onClick={(e) => {
              onChange(n);
              celebrateClick(e, { variant: "ordinal", value: n });
            }}
            className="min-h-[3rem] px-1 py-2 border-2 flex flex-col items-center justify-center gap-0.5"
            style={{
              borderColor: on ? "var(--px-accent)" : "var(--px-border)",
              color: on ? "var(--px-accent)" : "var(--px-text2)",
              background: on
                ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))"
                : "var(--px-bg3)",
              boxShadow: on ? "2px 2px 0 #000" : "none",
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <span className="text-lg font-black tabular-nums leading-none">
              {n}
            </span>
            <span className="text-[9px] font-bold leading-tight text-center">
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
