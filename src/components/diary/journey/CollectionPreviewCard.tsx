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
      className="block p-3 border-2 space-y-1.5"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-accent)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="ui-section-title">■ 간지 도감</p>
        <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          {summary.ganjiCollected}/{summary.ganjiTotal}
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
      <p className="ui-hint">
        천간 {summary.stemCollected}/{summary.stemTotal} · 지지 {summary.branchCollected}/{summary.branchTotal}
      </p>
      {nextUncollected && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          다음 미수집 {nextUncollected.ganjiKo}일 · D-{nextUncollected.daysUntil}
        </p>
      )}
    </Link>
  );
}
