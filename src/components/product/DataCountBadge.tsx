"use client";

type Props = {
  count: number;
  label?: string;
};

export default function DataCountBadge({ count, label = "기록" }: Props) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-[11px] font-bold border"
      style={{
        borderColor: "var(--px-border)",
        color: "var(--px-text2)",
        background: "var(--px-bg3)",
      }}
    >
      {label} {count}회
    </span>
  );
}
