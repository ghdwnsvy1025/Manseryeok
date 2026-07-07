"use client";

import type { DiaryDayPillar } from "@/lib/diary/types";

type Props = {
  monthPillarKo?: string;
  dayPillar: DiaryDayPillar;
};

export default function DayPillarBadge({ monthPillarKo, dayPillar }: Props) {
  return (
    <div
      className="inline-flex flex-wrap items-center gap-2 px-3 py-2 border-2"
      style={{
        background: "var(--px-bg3)",
        borderColor: "var(--px-accent)",
        boxShadow: "3px 3px 0 #000",
      }}
    >
      {monthPillarKo && (
        <span className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
          <span style={{ color: "var(--px-accent)" }}>{monthPillarKo}</span>월
        </span>
      )}
      <span className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
        <span style={{ color: "var(--px-accent)" }}>{dayPillar.ganjiKo}</span>
        <span className="ml-1 text-xs">({dayPillar.ganji})</span>일
      </span>
      <span className="text-xs" style={{ color: "var(--px-text2)" }}>
        {dayPillar.stem.ko}{dayPillar.branch.ko} · {dayPillar.stem.hanja}{dayPillar.branch.hanja}
      </span>
    </div>
  );
}
