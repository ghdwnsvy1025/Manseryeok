"use client";

type Props = {
  title: string;
  body: string;
  footnote?: string;
};

export default function InsightCard({ title, body, footnote }: Props) {
  return (
    <div
      className="p-3 border-2 space-y-1"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
    >
      <p className="ui-section-title">{title}</p>
      <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
        {body}
      </p>
      {footnote && <p className="ui-hint">{footnote}</p>}
    </div>
  );
}
