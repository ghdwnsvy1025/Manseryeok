"use client";

import { useMemo, useState } from "react";
import type { GroupStats } from "@/lib/diary/types";

type SortMode = "wellbeing" | "frequency";

type Props = {
  groups: GroupStats[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export default function MonthFortuneList({ groups, selectedKey, onSelect }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("wellbeing");

  const sorted = useMemo(() => {
    const list = [...groups];
    if (sortMode === "wellbeing") {
      return list.sort((a, b) => b.avgDailyWellbeing - a.avgDailyWellbeing);
    }
    return list.sort((a, b) => b.entryCount - a.entryCount);
  }, [groups, sortMode]);

  if (sorted.length === 0) {
    return <p className="ui-guide">아직 월운 기록이 없어요.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setSortMode("wellbeing")}
          className="px-2 py-1 text-xs font-bold border"
          style={{
            borderColor: sortMode === "wellbeing" ? "var(--px-accent)" : "var(--px-border)",
            color: sortMode === "wellbeing" ? "var(--px-accent)" : "var(--px-text2)",
            background: "var(--px-bg3)",
          }}
        >
          행복도순
        </button>
        <button
          type="button"
          onClick={() => setSortMode("frequency")}
          className="px-2 py-1 text-xs font-bold border"
          style={{
            borderColor: sortMode === "frequency" ? "var(--px-accent)" : "var(--px-border)",
            color: sortMode === "frequency" ? "var(--px-accent)" : "var(--px-text2)",
            background: "var(--px-bg3)",
          }}
        >
          기록 많은 순
        </button>
      </div>

      <div className="space-y-1.5">
        {sorted.map((g) => {
          const insufficient = g.entryCount < 2;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => !insufficient && onSelect(g.key)}
              disabled={insufficient}
              className="w-full p-2 border-2 text-left flex items-center justify-between gap-2"
              style={{
                borderColor: selectedKey === g.key ? "var(--px-accent)" : "var(--px-border)",
                background: "var(--px-bg3)",
                opacity: insufficient ? 0.55 : 1,
              }}
            >
              <div>
                <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                  {g.label}
                </p>
                <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
                  {insufficient ? `패턴 부족 · ${g.entryCount}회` : `${g.entryCount}회 기록`}
                </p>
              </div>
              {!insufficient && g.avgDailyWellbeing > 0 && (
                <div className="text-right shrink-0">
                  <p className="text-sm font-black" style={{ color: "#4ade80" }}>
                    {g.avgDailyWellbeing}점
                  </p>
                  {g.deltaFromOverall !== undefined && g.deltaFromOverall !== 0 && (
                    <p
                      className="text-[10px] font-bold"
                      style={{ color: g.deltaFromOverall > 0 ? "#4ade80" : "#f87171" }}
                    >
                      {g.deltaFromOverall > 0 ? `+${g.deltaFromOverall}` : g.deltaFromOverall}
                    </p>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
