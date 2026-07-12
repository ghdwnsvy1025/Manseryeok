"use client";

type Props = {
  ganjiKo: string;
  daysUntil: number;
  nextDate: string;
  label?: string;
};

export default function NextGanjiCountdown({ ganjiKo, daysUntil, nextDate, label }: Props) {
  const formatted = nextDate.replace(/-/g, ".");

  return (
    <div
      className="px-3 py-2 border text-center text-xs font-bold"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg2)",
        color: "var(--px-text2)",
      }}
    >
      {label ?? `다음 ${ganjiKo}일`}까지{" "}
      <span style={{ color: "var(--px-accent)" }}>D-{daysUntil}</span>
      <span className="ui-hint ml-1">({formatted})</span>
    </div>
  );
}
