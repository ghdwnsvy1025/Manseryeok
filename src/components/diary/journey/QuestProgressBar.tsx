"use client";

import type { QuestSeason } from "@/lib/diary/quests";

type Props = {
  season: QuestSeason;
  streakDays: number;
};

export default function QuestProgressBar({ season, streakDays }: Props) {
  const progressPct = Math.round((season.completedCount / season.totalCount) * 100);

  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="ui-section-title">{season.title}</p>
        <span className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
          {season.completedCount}/{season.totalCount}
        </span>
      </div>

      {streakDays >= 2 && (
        <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>
          {streakDays}일째 기록 중
        </p>
      )}

      <div
        className="h-3 border-2 overflow-hidden"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${progressPct}%`,
            background: "var(--px-accent)",
          }}
        />
      </div>

      <ul className="space-y-1">
        {season.quests.map((q) => (
          <li key={q.id} className="flex items-center gap-2 text-xs">
            <span
              className="shrink-0 w-4 text-center font-black"
              style={{ color: q.completed ? "#4ade80" : "var(--px-text2)" }}
            >
              {q.completed ? "✓" : "○"}
            </span>
            <span
              className="font-bold flex-1"
              style={{ color: q.completed ? "var(--px-text2)" : "var(--px-text-on-panel)" }}
            >
              {q.label}
            </span>
            {!q.completed && (
              <span className="ui-hint shrink-0">
                {q.current}/{q.target}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
