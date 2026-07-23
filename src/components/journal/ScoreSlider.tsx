"use client";

import {
  JOURNAL_SCORE_DEFAULT_HINT,
  JOURNAL_SCORE_LABELS,
  JOURNAL_SCORE_MAX,
  JOURNAL_SCORE_MIN,
  JOURNAL_SCORE_VALUES,
  type JournalScore,
  clampJournalScore,
} from "@/lib/journal/scoreScale";

type Props = {
  label: string;
  value: JournalScore | null;
  onChange: (value: JournalScore) => void;
  disabled?: boolean;
  /** happiness = 분홍 강조 */
  tone?: "default" | "happiness";
  size?: "md" | "lg";
};

/**
 * 1~10 슬라이더 + 큰 숫자 + 눈금 탭 스냅
 */
export default function ScoreSlider({
  label,
  value,
  onChange,
  disabled,
  tone = "default",
  size = "md",
}: Props) {
  const display = value ?? JOURNAL_SCORE_DEFAULT_HINT;
  const committed = value != null;
  const accent = tone === "happiness" ? "#f472b6" : "var(--px-accent)";
  const large = size === "lg";

  const commit = (n: number) => {
    if (disabled) return;
    onChange(clampJournalScore(n));
  };

  return (
    <div className={large ? "space-y-3" : "space-y-2"}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate font-bold ${large ? "text-sm" : "ui-hint"}`}
            style={{ color: tone === "happiness" ? accent : undefined }}
          >
            {committed ? JOURNAL_SCORE_LABELS[display] : "슬라이더로 골라주세요"}
          </p>
        </div>
        <p
          className={`font-black tabular-nums leading-none shrink-0 ${
            large ? "text-5xl" : "text-3xl"
          }`}
          style={{
            color: committed ? accent : "var(--px-text2)",
            opacity: committed ? 1 : 0.45,
          }}
          aria-live="polite"
        >
          {committed ? display : "—"}
          <span
            className={`font-bold ml-1 ${large ? "text-sm" : "text-xs"}`}
            style={{ color: "var(--px-text2)" }}
          >
            /10
          </span>
        </p>
      </div>

      <input
        type="range"
        min={JOURNAL_SCORE_MIN}
        max={JOURNAL_SCORE_MAX}
        step={1}
        value={display}
        disabled={disabled}
        aria-label={`${label} 점수 1에서 10`}
        aria-valuemin={JOURNAL_SCORE_MIN}
        aria-valuemax={JOURNAL_SCORE_MAX}
        aria-valuenow={committed ? display : undefined}
        aria-valuetext={
          committed ? `${display}점 ${JOURNAL_SCORE_LABELS[display]}` : "미선택"
        }
        onChange={(e) => commit(Number(e.target.value))}
        className={`w-full cursor-pointer disabled:opacity-50 ${
          large ? "h-3" : "h-2"
        }`}
        style={{ accentColor: accent }}
      />

      <div className="grid grid-cols-10 gap-0.5">
        {JOURNAL_SCORE_VALUES.map((n) => {
          const on = committed && value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-label={`${n}점 ${JOURNAL_SCORE_LABELS[n]}`}
              aria-pressed={on}
              onClick={() => commit(n)}
              className={`font-black border tabular-nums ${
                large ? "py-2 text-xs" : "py-1 text-[10px]"
              }`}
              style={{
                borderColor: on ? accent : "var(--px-border)",
                color: on ? accent : "var(--px-text2)",
                background: on
                  ? `color-mix(in srgb, ${accent} 18%, var(--px-bg3))`
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
