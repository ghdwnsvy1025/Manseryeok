"use client";

import Link from "next/link";
import { getCollectionSummary } from "@/lib/diary/collection";
import type { DiaryEntry } from "@/lib/diary/types";

type Props = {
  entries: DiaryEntry[];
};

export default function CollectionNavButton({ entries }: Props) {
  const summary = getCollectionSummary(entries);
  const pct =
    summary.ganjiTotal > 0
      ? Math.round((summary.ganjiCollected / summary.ganjiTotal) * 100)
      : 0;

  return (
    <Link
      href="/diary/collection"
      className="flex items-center gap-3 p-3 border-2 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-accent)",
        boxShadow: "3px 3px 0 #4a3a00",
      }}
      aria-label={`간지 도감 ${summary.ganjiCollected}/${summary.ganjiTotal}`}
    >
      <span
        className="w-11 h-11 shrink-0 flex items-center justify-center border-2 pixel-font font-black"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg3)",
          color: "var(--px-accent)",
          fontSize: "12px",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        曆
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            간지 도감
          </p>
          <span className="text-xs font-bold shrink-0" style={{ color: "var(--px-text2)" }}>
            {summary.ganjiCollected}/{summary.ganjiTotal} →
          </span>
        </div>
        <div
          className="h-2 border overflow-hidden"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <div
            className="h-full"
            style={{ width: `${pct}%`, background: "var(--px-accent)" }}
          />
        </div>
        <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
          수집한 일진 도장 보기
        </p>
      </div>
    </Link>
  );
}
