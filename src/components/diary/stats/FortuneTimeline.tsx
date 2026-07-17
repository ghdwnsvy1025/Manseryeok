"use client";

import type { GroupStats } from "@/lib/diary/types";

type Props = {
  groups: GroupStats[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export default function FortuneTimeline({ groups, selectedKey, onSelect }: Props) {
  const sorted = [...groups].sort((a, b) => {
    const aMin = a.dates[0] ?? "";
    const bMin = b.dates[0] ?? "";
    return aMin.localeCompare(bMin);
  });

  if (sorted.length === 0) {
    return <p className="ui-guide">아직 년운 기록이 없어요.</p>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {sorted.map((g) => {
        const insufficient = g.entryCount < 2;
        return (
          <button
            key={g.key}
            type="button"
            onClick={() => !insufficient && onSelect(g.key)}
            disabled={insufficient}
            className="shrink-0 p-2 border-2 text-left min-w-[7rem]"
            style={{
              borderColor: selectedKey === g.key ? "var(--px-accent)" : "var(--px-border)",
              background: "var(--px-bg3)",
              opacity: insufficient ? 0.55 : 1,
            }}
          >
            <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
              {g.label}
            </p>
            {insufficient ? (
              <p className="text-xs font-bold mt-1" style={{ color: "var(--px-text2)" }}>
                패턴 부족 · {g.entryCount}회
              </p>
            ) : (
              <>
                <p className="text-xs font-black mt-1" style={{ color: "#4ade80" }}>
                  {g.avgDailyWellbeing}점
                </p>
                <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                  {g.entryCount}회
                  {g.deltaFromOverall !== undefined && g.deltaFromOverall !== 0 && (
                    <span
                      style={{ color: g.deltaFromOverall > 0 ? "#4ade80" : "#f87171" }}
                    >
                      {" "}
                      · {g.deltaFromOverall > 0 ? `+${g.deltaFromOverall}` : g.deltaFromOverall}
                    </span>
                  )}
                </p>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
