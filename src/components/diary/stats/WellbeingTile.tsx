"use client";

import type { Element } from "@/lib/saju/constants";

const ELEM_COLORS: Record<Element, string> = {
  wood: "#4ade80",
  fire: "#f87171",
  earth: "#fbbf24",
  metal: "#cbd5e1",
  water: "#60a5fa",
};

type Props = {
  label: string;
  wellbeing: number;
  entryCount: number;
  deltaFromOverall?: number;
  selected?: boolean;
  onClick?: () => void;
  element?: Element;
  compact?: boolean;
};

export default function WellbeingTile({
  label,
  wellbeing,
  entryCount,
  deltaFromOverall,
  selected = false,
  onClick,
  element,
  compact = false,
}: Props) {
  const insufficient = entryCount < 2;
  const borderColor = element ? ELEM_COLORS[element] : "var(--px-border)";
  const fillOpacity = insufficient ? 0.08 : Math.max(0.12, wellbeing / 100);
  const fillColor = element ? ELEM_COLORS[element] : "#60a5fa";

  return (
    <button
      type="button"
      onClick={insufficient ? undefined : onClick}
      disabled={insufficient}
      className={`relative border-2 text-center transition-all ${compact ? "p-2 min-h-[3.5rem]" : "p-3 min-h-[4.5rem]"} ${insufficient ? "opacity-60 cursor-default" : "cursor-pointer"}`}
      style={{
        borderColor: selected ? "var(--px-accent)" : borderColor,
        background: `color-mix(in srgb, ${fillColor} ${Math.round(fillOpacity * 100)}%, var(--px-bg2))`,
        boxShadow: selected ? "2px 2px 0 #000" : undefined,
      }}
    >
      <span
        className={`block font-black leading-none ${compact ? "text-sm" : "text-base"}`}
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {label}
      </span>
      {insufficient ? (
        <span className="block mt-1 text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
          패턴 부족
        </span>
      ) : (
        <>
          <span
            className={`block mt-1 font-black ${compact ? "text-xs" : "text-sm"}`}
            style={{ color: fillColor }}
          >
            {wellbeing}점
          </span>
          {deltaFromOverall !== undefined && deltaFromOverall !== 0 && (
            <span
              className="absolute top-1 right-1 text-[10px] font-bold px-1 border"
              style={{
                borderColor: "var(--px-border)",
                color: deltaFromOverall > 0 ? "#4ade80" : "#f87171",
                background: "var(--px-bg3)",
              }}
            >
              {deltaFromOverall > 0 ? `+${deltaFromOverall}` : deltaFromOverall}
            </span>
          )}
        </>
      )}
      <span
        className="absolute bottom-1 right-1 text-[10px] font-bold px-1"
        style={{ color: "var(--px-text2)" }}
      >
        {entryCount}회
      </span>
    </button>
  );
}

export { ELEM_COLORS };
