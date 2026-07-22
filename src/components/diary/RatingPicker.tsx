"use client";

type Rating = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type Props = {
  title: string;
  value: Rating;
  onChange: (value: Rating) => void;
  labels: Record<Rating, string>;
  disabled?: boolean;
};

const RATINGS: Rating[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function RatingPicker({
  title,
  value,
  onChange,
  labels,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <p className="ui-section-title shrink-0">{title}</p>
          <p className="ui-hint truncate">{labels[value]}</p>
        </div>
        <p className="text-xs font-bold shrink-0 tabular-nums" style={{ color: "var(--px-text2)" }}>
          {value}/10
        </p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RATINGS.map((rating) => {
          const selected = value === rating;
          return (
            <button
              key={rating}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${rating}점 ${labels[rating]}`}
              onClick={() => onChange(rating)}
              className="min-h-[44px] border-2 text-center font-black transition-transform active:translate-y-0.5"
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
              <span className="block text-base leading-none">{rating}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
