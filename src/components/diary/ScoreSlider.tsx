"use client";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  color?: string;
  disabled?: boolean;
  hint?: string;
  /** 부정 차원(우울·불안 등): 낮을수록 좋음 → 구간 라벨 반전 */
  invertZones?: boolean;
};

const ZONE_LABELS_POSITIVE = ["안 좋음", "보통", "좋음"] as const;
const ZONE_LABELS_NEGATIVE = ["좋음", "보통", "안 좋음"] as const;

export default function ScoreSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  color = "var(--px-accent)",
  disabled = false,
  hint,
  invertZones = false,
}: Props) {
  const zoneLabels = invertZones ? ZONE_LABELS_NEGATIVE : ZONE_LABELS_POSITIVE;

  return (
    <div className={`space-y-1 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-1.5">
        <span className="ui-list-label" style={{ color }}>
          {label}
        </span>
        <span className="text-base font-black tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>

      <div className="diary-slider-wrap">
        <div className="diary-slider-zones" aria-hidden="true">
          {zoneLabels.map((zoneLabel) => (
            <div key={zoneLabel} className="diary-slider-zone">
              <span className="diary-slider-zone-label">{zoneLabel}</span>
            </div>
          ))}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="diary-score-slider w-full"
          style={{ "--slider-color": color } as React.CSSProperties}
          aria-label={`${label} ${value}점`}
        />
      </div>

      {hint && (
        <p className="ui-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
