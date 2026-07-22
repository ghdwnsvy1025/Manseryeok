"use client";

import type { RatingTrend } from "@/lib/diary/trendStats";

type Props = {
  trend: RatingTrend;
  title: string;
  description?: string;
};

export default function HappinessTrendChart({ trend, title, description }: Props) {
  const width = 320;
  const height = 120;
  const pad = 16;
  const usable = trend.points.filter((p) => p.value != null);
  if (usable.length === 0) {
    return (
      <div className="p-3 border" style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}>
        <p className="ui-section-title">{title}</p>
        <p className="ui-hint mt-1">아직 표시할 기록이 없어요.</p>
      </div>
    );
  }

  const xs = trend.points.map((_, i) => pad + (i * (width - pad * 2)) / Math.max(trend.points.length - 1, 1));
  const yFor = (value: number) => height - pad - ((value - 1) / 9) * (height - pad * 2);

  const path = trend.points
    .map((p, i) => {
      if (p.value == null) return null;
      const cmd = i === 0 || trend.points.slice(0, i).every((x) => x.value == null) ? "M" : "L";
      return `${cmd}${xs[i]},${yFor(p.value)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className="p-3 border space-y-2" style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="ui-section-title">{title}</p>
        <p className="text-[11px]" style={{ color: "var(--px-text2)" }}>
          n={trend.sampleSize}
          {trend.average != null ? ` · 평균 ${trend.average}` : ""}
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={title}>
        {[1, 4, 7, 10].map((v) => (
          <g key={v}>
            <line
              x1={pad}
              x2={width - pad}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="var(--px-border)"
              strokeWidth="1"
            />
            <text x={4} y={yFor(v) + 3} fontSize="9" fill="var(--px-text2)">
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--px-accent)" strokeWidth="2" />
        {trend.points.map((p, i) =>
          p.value == null ? null : (
            <circle key={p.date} cx={xs[i]} cy={yFor(p.value)} r="3" fill="var(--px-accent)" />
          )
        )}
      </svg>
      <div className="flex justify-between text-[10px]" style={{ color: "var(--px-text2)" }}>
        <span>{trend.points[0]?.label}</span>
        <span>기간 {trend.days}일 · 축: 1~10점</span>
        <span>{trend.points[trend.points.length - 1]?.label}</span>
      </div>
      {description && <p className="ui-hint">{description}</p>}
    </div>
  );
}
