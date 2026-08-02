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
  /** 선택 강조색 (핵심 상태별 구분) */
  accent?: string;
};

export default function OrdinalPicker({
  label,
  value,
  onChange,
  disabled,
  labels = ORDINAL_LABELS,
  accent = "var(--px-accent)",
}: Props) {
  return (
    <div
      className="grid grid-cols-5 gap-1.5"
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
            className="min-h-[3.1rem] px-1 py-2 border flex flex-col items-center justify-center gap-0.5"
            style={{
              borderColor: on ? accent : "var(--px-border)",
              color: on ? accent : "#b0b0c0",
              background: on
                ? `color-mix(in srgb, ${accent} 14%, var(--px-bg3))`
                : "var(--px-bg3)",
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <span className="text-[1.05rem] font-semibold tabular-nums leading-none">
              {n}
            </span>
            <span className="text-[10px] font-medium leading-tight text-center opacity-90">
              {text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
