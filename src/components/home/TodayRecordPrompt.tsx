"use client";

import Link from "next/link";
import { computeJournalStreak } from "@/lib/journal/streak";
import { trackContentExposure } from "@/lib/journal/exposure";

type Props = {
  todayDate: string;
  entryDates: string[];
};

/**
 * 운세 바로 아래 — 오늘 미기록일 때만 노출.
 * 완료 상태는 날짜 블록 CTA에서 한 번만 보여준다.
 */
export default function TodayRecordPrompt({ todayDate, entryDates }: Props) {
  const streak = computeJournalStreak(entryDates, todayDate);

  return (
    <div
      className="p-3 border-2 flex items-center justify-between gap-3"
      style={{
        borderColor: "var(--px-accent)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="오늘 기록하기"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
          1분만 기록하면 운세가 더 정확해져요
        </p>
        <p className="text-xs leading-snug" style={{ color: "var(--px-text2)" }}>
          {streak.atRisk
            ? `연속 ${streak.days}일을 이어가려면 오늘 기록이 필요해요`
            : "기록이 쌓일수록 레벨·운세 맞춤이 깊어져요"}
        </p>
      </div>
      <Link
        href="/journal"
        className="ui-primary-btn px-3 py-2 text-xs shrink-0 whitespace-nowrap"
        onClick={() =>
          void trackContentExposure({
            eventDate: todayDate,
            contentType: "checkin",
            eventType: "checkin_started",
          })
        }
      >
        오늘 기록하기 · +5 XP~
      </Link>
    </div>
  );
}
