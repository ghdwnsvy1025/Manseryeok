"use client";

type Props = {
  lines?: number;
  label?: string;
};

export default function LoadingSkeleton({ lines = 3, label = "불러오는 중..." }: Props) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label={label}>
      <p className="ui-hint">{label}</p>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 border"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg3)",
            width: `${90 - i * 12}%`,
          }}
        />
      ))}
    </div>
  );
}
