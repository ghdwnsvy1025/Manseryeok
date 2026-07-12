"use client";

import Link from "next/link";
import type { CollectionSummary } from "@/lib/diary/collection";

type Props = {
  summary: CollectionSummary;
  onClose: () => void;
};

export default function Day7MilestoneModal({ summary, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm p-4 border-2 space-y-3"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          7일 여정 완료!
        </p>
        <p className="ui-guide leading-relaxed">
          간지별 행복도 인사이트가 열렸어요. 지금까지 수집한 간지{" "}
          <strong style={{ color: "var(--px-accent)" }}>
            {summary.ganjiCollected}/60
          </strong>
          .
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/diary/stats"
            className="text-center py-2.5 text-sm font-black border-2 ui-primary-btn"
            onClick={onClose}
          >
            간지별 행복도 보기
          </Link>
          <Link
            href="/diary/collection"
            className="text-center py-2 text-xs font-bold border-2"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-text2)",
              background: "var(--px-bg3)",
            }}
            onClick={onClose}
          >
            간지 도감 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold ui-hint py-1"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
