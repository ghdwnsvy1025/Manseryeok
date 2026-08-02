"use client";

import { useRef } from "react";
import {
  HAPPINESS_ANCHORS,
  HAPPINESS_DEFAULT_HINT,
  HAPPINESS_LABELS,
  HAPPINESS_MAX,
  HAPPINESS_MIN,
  HAPPINESS_VALUES,
  type HappinessScore,
  clampHappinessScore,
} from "@/lib/journal/happinessScale";
import {
  burstFromElement,
  softPress,
} from "@/lib/ui/clickBurst";

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
  const scoreRef = useRef<HTMLParagraphElement>(null);
  const lastBurstAt = useRef(0);

  const burst = (
    score: HappinessScore,
    el?: Element | null
  ) => {
    const now = Date.now();
    if (now - lastBurstAt.current < 180) return;
    lastBurstAt.current = now;

    const origin = el ?? scoreRef.current;
    softPress(origin);
    burstFromElement(origin, { variant: "heart", value: score });
  };

  const commit = (
    n: number,
    el?: Element | null
  ) => {
    if (disabled) return;
    const score = clampHappinessScore(n);
    onChange(score);
    burst(score, el);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-[13px] font-medium"
            style={{ color: committed ? ACCENT : "#a8a8b8" }}
          >
            {committed ? HAPPINESS_LABELS[display] : "슬라이더로 골라주세요"}
          </p>
        </div>
        <p
          ref={scoreRef}
          className="text-[2rem] font-semibold tabular-nums leading-none shrink-0"
          style={{
            color: committed ? ACCENT : "#8a8a9a",
            opacity: committed ? 1 : 0.7,
          }}
          aria-live="polite"
        >
          {committed ? display : "—"}
          <span
            className="font-medium ml-0.5 text-[12px]"
            style={{ color: "#a8a8b8" }}
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
        onChange={(e) => {
          if (disabled) return;
          onChange(clampHappinessScore(Number(e.target.value)));
        }}
        onPointerUp={(e) => {
          if (disabled) return;
          const score = clampHappinessScore(Number(e.currentTarget.value));
          onChange(score);
          burst(score, scoreRef.current);
        }}
        className="w-full cursor-pointer h-2.5 disabled:opacity-50"
        style={{ accentColor: ACCENT }}
      />

      <div className="grid grid-cols-11 gap-1">
        {HAPPINESS_VALUES.map((n) => {
          const on = committed && value === n;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              aria-label={`${n}점 ${HAPPINESS_LABELS[n]}`}
              aria-pressed={on}
              onClick={(e) => commit(n, e.currentTarget)}
              className="min-h-[2rem] py-1.5 text-[11px] font-semibold border tabular-nums"
              style={{
                borderColor: on ? ACCENT : "var(--px-border)",
                color: on ? ACCENT : "#b0b0c0",
                background: on
                  ? `color-mix(in srgb, ${ACCENT} 14%, var(--px-bg3))`
                  : "var(--px-bg2)",
              }}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div
        className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] leading-snug font-medium"
        style={{ color: "#9a9aac" }}
      >
        {HAPPINESS_ANCHORS.map((a) => (
          <p
            key={a.value}
            className={
              a.value === 0
                ? "text-left"
                : a.value === 5
                  ? "text-center"
                  : "text-right"
            }
          >
            <span className="font-semibold tabular-nums" style={{ color: ACCENT }}>
              {a.value}
            </span>{" "}
            {a.label}
          </p>
        ))}
      </div>
    </div>
  );
}
