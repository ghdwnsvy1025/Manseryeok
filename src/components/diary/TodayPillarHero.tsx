"use client";

import type { DiaryDayPillar } from "@/lib/diary/types";

type Props = {
  dateLabel: string;
  dayPillar: DiaryDayPillar | null;
};

export default function TodayPillarHero({ dateLabel, dayPillar }: Props) {
  return (
    <div
      className="text-center p-4 border-2 space-y-2"
      style={{
        borderColor: "var(--px-accent)",
        background: "var(--px-bg3)",
        boxShadow: "3px 3px 0 #000",
      }}
    >
      <p className="ui-hint">{dateLabel}</p>
      {dayPillar ? (
        <>
          <p className="text-3xl font-black leading-none" style={{ color: "var(--px-accent)" }}>
            {dayPillar.ganjiKo}
            <span className="text-lg ml-1" style={{ color: "var(--px-text2)" }}>
              일
            </span>
          </p>
          <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
            <span className="pixel-font" style={{ fontSize: "12px", color: "var(--px-accent)" }}>
              {dayPillar.ganji}
            </span>
            <span className="mx-2" style={{ color: "var(--px-border2)" }}>
              ·
            </span>
            {dayPillar.stem.ko}
            {dayPillar.branch.ko}
            <span className="ml-1 ui-hint">
              ({dayPillar.stem.hanja}
              {dayPillar.branch.hanja})
            </span>
          </p>
          <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            오늘은 {dayPillar.ganjiKo}일
          </p>
        </>
      ) : (
        <p className="ui-guide">날짜를 확인해주세요</p>
      )}
    </div>
  );
}
