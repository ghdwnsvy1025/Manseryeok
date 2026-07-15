"use client";

import Link from "next/link";
import type { CollectionSummary } from "@/lib/diary/collection";

type Props = {
  summary: CollectionSummary;
  nextUncollected?: { ganjiKo: string; daysUntil: number } | null;
};

export default function CollectionPreviewCard({ summary, nextUncollected }: Props) {
  const pct = Math.round((summary.ganjiCollected / summary.ganjiTotal) * 100);

  return (
    <Link
      href="/diary/collection"
      className="block p-4 border-2 space-y-2"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-accent)",
        boxShadow: "4px 4px 0 #000",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          ■ 간지 도감
        </p>
        <span className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          {summary.ganjiCollected}/{summary.ganjiTotal}
        </span>
      </div>
      <div
        className="h-3 border-2 overflow-hidden"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
      >
        <div className="h-full" style={{ width: `${pct}%`, background: "var(--px-accent)" }} />
      </div>
      <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
        천간 {summary.stemCollected}/{summary.stemTotal} · 지지 {summary.branchCollected}/
        {summary.branchTotal}
      </p>
      {nextUncollected && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text-on-panel)" }}>
          다음 미수집 {nextUncollected.ganjiKo}일 · D-{nextUncollected.daysUntil}
        </p>
      )}
      <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
        도감 전체 보기 →
      </p>
    </Link>
  );
}
