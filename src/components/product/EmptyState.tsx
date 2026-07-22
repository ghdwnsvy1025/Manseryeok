"use client";

import Link from "next/link";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: Props) {
  return (
    <div
      className="p-4 border-2 space-y-2 text-center"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      role="status"
    >
      <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
        {title}
      </p>
      {description && (
        <p className="text-xs" style={{ color: "var(--px-text2)" }}>
          {description}
        </p>
      )}
      {actionHref && actionLabel && (
        <Link href={actionHref} className="ui-primary-btn inline-block px-3 py-2 text-xs">
          {actionLabel}
        </Link>
      )}
      {onAction && actionLabel && !actionHref && (
        <button type="button" className="ui-primary-btn px-3 py-2 text-xs" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
