"use client";

import Link from "next/link";

export type ReflectCta = {
  reason: string;
  label: string;
  href: string;
};

type Props = {
  cta: ReflectCta | null;
};

/** 회고 → 오늘 작성 — 짧은 이유 + 버튼만 */
export default function StatsReflectCta({ cta }: Props) {
  if (!cta) return null;

  return (
    <div
      className="stats-panel flex items-center justify-between gap-3"
      style={{ borderColor: "var(--px-accent)" }}
      aria-label="오늘 기록 유도"
    >
      <p
        className="min-w-0 text-sm font-bold leading-snug"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {cta.reason}
      </p>
      <Link
        href={cta.href}
        className="ui-primary-btn shrink-0 !px-3 !py-2 !text-xs whitespace-nowrap"
      >
        {cta.label}
      </Link>
    </div>
  );
}
