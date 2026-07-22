"use client";

import { PRIMARY_AREA_OPTIONS } from "@/lib/diary/types";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export default function PrimaryAreaPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
        오늘 가장 영향을 받은 영역 (권장)
      </p>
      <div className="flex flex-wrap gap-1">
        {PRIMARY_AREA_OPTIONS.map((area) => {
          const selected = value === area;
          return (
            <button
              key={area}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? null : area)}
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
              {area}
            </button>
          );
        })}
      </div>
    </div>
  );
}
