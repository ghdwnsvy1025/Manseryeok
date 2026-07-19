"use client";

type Rating = 1 | 2 | 3 | 4 | 5;

type Props = {
  title: string;
  value: Rating;
  onChange: (value: Rating) => void;
  labels: Record<Rating, string>;
  disabled?: boolean;
};

const RATINGS: Rating[] = [1, 2, 3, 4, 5];

export default function RatingPicker({
  title,
  value,
  onChange,
  labels,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <p className="ui-section-title">{title}</p>
        <p className="ui-hint">{labels[value]}</p>
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
              onClick={() => onChange(rating)}
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
              <span className="block text-lg leading-none">{rating}</span>
              <span className="block text-[11px] font-bold mt-1 leading-tight">
                {labels[rating]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
