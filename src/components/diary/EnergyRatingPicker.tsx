"use client";

import {
  ENERGY_RATING_LABELS,
  type EnergyRating,
} from "@/lib/diary/types";

type Props = {
  value: EnergyRating | null;
  onChange: (value: EnergyRating | null) => void;
  disabled?: boolean;
};

const ORDER: EnergyRating[] = [4, 3, 2, 1];

export default function EnergyRatingPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <p className="ui-section-title">에너지</p>
        <p className="ui-hint">
          {value != null ? ENERGY_RATING_LABELS[value] : "선택 (권장)"}
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {ORDER.map((rating) => {
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : rating)}
              className="min-h-[52px] border-2 text-center font-black transition-transform active:translate-y-0.5"
              style={{
                borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
                background: selected
                  ? "color-mix(in srgb, var(--px-accent) 18%, var(--px-bg2))"
                  : "var(--px-bg3)",
                color: selected ? "var(--px-accent)" : "var(--px-text2)",
                boxShadow: selected ? "2px 2px 0 #000" : "none",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <span className="block text-[11px] font-bold leading-tight px-0.5">
                {ENERGY_RATING_LABELS[rating]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
