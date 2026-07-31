"use client";

import Link from "next/link";
import { yesterdayOf } from "@/lib/journal/emptyDays";
import { trackContentExposure } from "@/lib/journal/exposure";

type Props = {
  todayDate: string;
  /** 어제 기록이 없을 때만 부모가 마운트 */
  entryDates: string[];
};

/**
 * 홈 — 어제 미기록일 때. 과거 메우기 + 효과(정확도) 어필.
 */
export default function YesterdayGapPrompt({ todayDate }: Props) {
  const yesterday = yesterdayOf(todayDate);
  const label = `${Number(yesterday.slice(5, 7))}.${Number(yesterday.slice(8, 10))}`;

  return (
    <div
      className="p-3 border-2 flex items-center justify-between gap-3"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="어제 기록 메우기"
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          어제({label})가 비어 있어요
        </p>
        <p className="text-[11px] font-bold leading-snug" style={{ color: "var(--px-text2)" }}>
          빈 날을 메우면 운세·패턴이 더 정확해져요
        </p>
      </div>
      <Link
        href={`/journal?date=${yesterday}`}
        className="shrink-0 px-3 py-2 text-xs font-black border-2 whitespace-nowrap"
        style={{
          borderColor: "#000",
          background: "var(--px-bg3)",
          color: "var(--px-text-on-panel)",
          boxShadow: "2px 2px 0 #000",
        }}
        onClick={() =>
          void trackContentExposure({
            eventDate: yesterday,
            contentType: "checkin",
            eventType: "checkin_started",
            metadata: { surface: "yesterday_gap" },
          })
        }
      >
        어제 한 줄
      </Link>
    </div>
  );
}
