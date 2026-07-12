"use client";

import type { GroupStats } from "@/lib/diary/types";
import { STATS_INSIGHT_MIN_ENTRIES } from "@/lib/diary/onboarding";

type Props = {
  groups: GroupStats[];
  insightCards: GroupStats[];
  selectedKey: string;
  onSelect: (key: string) => void;
  uniqueDays: number;
};

export default function GanjiRanking({
  groups,
  insightCards,
  selectedKey,
  onSelect,
  uniqueDays,
}: Props) {
  const topByFrequency = groups.slice(0, 5);

  return (
    <div className="space-y-3">
      {insightCards.length > 0 && uniqueDays >= STATS_INSIGHT_MIN_ENTRIES && (
        <div
          className="p-3 border-2 space-y-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-accent)" }}
        >
          <p className="ui-section-title">나의 기분이 좋았던 날 (간지 TOP {insightCards.length})</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {insightCards.map((card, i) => (
              <button
                key={card.key}
                type="button"
                onClick={() => onSelect(card.key)}
                className="p-2 border-2 text-left"
                style={{
                  borderColor: selectedKey === card.key ? "var(--px-accent)" : "var(--px-border)",
                  background: "var(--px-bg3)",
                }}
              >
                <p className="ui-hint">#{i + 1} · {card.entryCount}회 기록</p>
                <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                  {card.label}
                </p>
                <p className="text-xs font-bold" style={{ color: "#4ade80" }}>
                  평균 행복도 {card.avgDailyWellbeing}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {topByFrequency.length > 0 && (
        <div
          className="p-3 border-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
        >
          <p className="ui-section-title mb-2">가장 많이 기록한 간지 Top 5</p>
          <div className="flex flex-wrap gap-2">
            {topByFrequency.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelect(p.key)}
                className="px-2 py-1 text-xs font-bold border"
                style={{
                  borderColor: selectedKey === p.key ? "var(--px-accent)" : "var(--px-border)",
                  color: selectedKey === p.key ? "var(--px-accent)" : "var(--px-text2)",
                  background: "var(--px-bg3)",
                }}
              >
                {p.label} ({p.entryCount}회)
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="ganji-select" className="ui-list-label shrink-0">
            간지 선택
          </label>
          <select
            id="ganji-select"
            value={selectedKey}
            onChange={(e) => onSelect(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border-2 font-bold"
            style={{
              background: "var(--px-bg2)",
              borderColor: "var(--px-border)",
              color: "var(--px-text)",
            }}
          >
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label} ({g.entryCount}회)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
