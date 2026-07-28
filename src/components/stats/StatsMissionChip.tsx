"use client";

import Link from "next/link";
import type { CollectionMission } from "@/lib/journal/statsInsight";

type Props = {
  mission: CollectionMission;
};

/** 상단 도감 미션 — 수집 목표를 한 줄로 (데이터 요약과 무게 분리) */
export default function StatsMissionChip({ mission }: Props) {
  const done = !mission.ctaLabel;

  return (
    <div
      className="px-3 py-2 border-2 flex items-center justify-between gap-3"
      style={{
        borderColor: done ? "#4ade80" : "var(--px-accent)",
        background: done
          ? "color-mix(in srgb, #4ade80 10%, var(--px-bg2))"
          : "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg2))",
      }}
      aria-label="오늘 도감 미션"
    >
      <div className="min-w-0 flex items-center gap-2.5">
        <span
          className="shrink-0 text-lg font-black leading-none"
          style={{ color: done ? "#4ade80" : "var(--px-accent)" }}
          aria-hidden
        >
          {mission.ganjiKo}
        </span>
        <div className="min-w-0">
          <p className="stats-label">오늘 도감</p>
          <p
            className="text-sm font-extrabold truncate leading-tight"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {mission.title}
          </p>
        </div>
      </div>
      {done ? (
        <span
          className="shrink-0 text-xs font-extrabold"
          style={{ color: "#4ade80" }}
        >
          수집 완료
        </span>
      ) : (
        <Link
          href={mission.href}
          className="ui-primary-btn shrink-0 !px-2.5 !py-1.5 !text-[11px] !shadow-[2px_2px_0_#000]"
        >
          열기
        </Link>
      )}
    </div>
  );
}
