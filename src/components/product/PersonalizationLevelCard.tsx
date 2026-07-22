"use client";

import {
  PERSONALIZATION_LABELS,
  PERSONALIZATION_SUMMARIES,
  nextLevelRemaining,
  type PersonalizationLevel,
} from "@/lib/product/personalization";

type Props = {
  level: PersonalizationLevel;
  recordCount: number;
};

export default function PersonalizationLevelCard({
  level,
  recordCount,
}: Props) {
  const next = nextLevelRemaining(recordCount);
  return (
    <div
      className="p-3 border-2 space-y-1"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      aria-label={`개인화 단계 ${PERSONALIZATION_LABELS[level]}`}
    >
      <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
        개인화 · {PERSONALIZATION_LABELS[level]}
      </p>
      <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        {PERSONALIZATION_SUMMARIES[level]}
      </p>
      <p className="ui-hint">
        기록 {recordCount}일
        {next.next
          ? ` · ${next.remaining}일 더 쌓이면 ${PERSONALIZATION_LABELS[next.next]}`
          : ""}
      </p>
    </div>
  );
}
