"use client";

import { useId, useMemo } from "react";
import type { HappinessPoint } from "@/lib/journal/homeStats";
import type { CategoryCode } from "@/lib/journal/types";

export type OverlaySeries = {
  code: CategoryCode;
  name: string;
  color: string;
  points: HappinessPoint[];
};

type Props = {
  /** 기준선 — 하루 행복도 */
  happiness: HappinessPoint[];
  /** 겹쳐 보는 카테고리 */
  overlays: OverlaySeries[];
  /** 그래프 X축 전체 범위 (월 1일~말일) */
  dates: string[];
};

function formatMd(date: string): string {
  return `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;
}

/** 기록된 점만 시간순으로 한 선으로 이음 (미기록 날은 X축에만 남고 선은 끊지 않음) */
function seriesSegments(
  points: HappinessPoint[],
  indexOf: Map<string, number>
): string[][] {
  const ordered = [...points]
    .filter((p) => indexOf.has(p.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (ordered.length === 0) return [];
  return [
    ordered.map((p) => {
      const i = indexOf.get(p.date)!;
      return `${i},${p.value}`;
    }),
  ];
}

/**
 * 행복도(굵은 실선) 위에 카테고리를 겹쳐 보는 월간 추이 차트.
 * 기록된 날만 점으로 잇는다 (빈 날 때문에 선이 조각나지 않음).
 */
export default function TrendOverlayChart({
  happiness,
  overlays,
  dates,
}: Props) {
  const uid = useId();
  const hasData =
    happiness.length > 0 || overlays.some((o) => o.points.length > 0);

  const width = 320;
  const height = 156;
  const padL = 28;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const yTicks = [1, 4, 7, 10];

  const indexOf = useMemo(
    () => new Map(dates.map((d, i) => [d, i])),
    [dates]
  );

  const xAt = (i: number) =>
    padL + (dates.length <= 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW);
  const yAt = (v: number) =>
    padT + innerH - ((Math.min(10, Math.max(1, v)) - 1) / 9) * innerH;

  const toSvgPoints = (segment: string[]) =>
    segment
      .map((pair) => {
        const [iStr, vStr] = pair.split(",");
        const i = Number(iStr);
        const v = Number(vStr);
        return `${xAt(i)},${yAt(v)}`;
      })
      .join(" ");

  const happinessSegs = useMemo(
    () => seriesSegments(happiness, indexOf),
    [happiness, indexOf]
  );

  const overlaySegs = useMemo(
    () =>
      overlays.map((o) => ({
        code: o.code,
        color: o.color,
        segments: seriesSegments(o.points, indexOf),
      })),
    [overlays, indexOf]
  );

  const labelIdx = useMemo(() => {
    const n = dates.length;
    if (n <= 1) return [0];
    if (n <= 7) {
      return Array.from({ length: n }, (_, i) => i).filter(
        (i) => i === 0 || i === n - 1 || i % 2 === 0
      );
    }
    // 1 · 중 · 말일 (+ 7의 배수 근처)
    const mid = Math.round((n - 1) / 2);
    const seventh = Math.min(n - 1, 6);
    const fourteenth = Math.min(n - 1, 13);
    const twentyFirst = Math.min(n - 1, 20);
    return Array.from(
      new Set([0, seventh, fourteenth, mid, twentyFirst, n - 1])
    ).sort((a, b) => a - b);
  }, [dates.length]);

  if (!hasData || dates.length === 0) {
    return (
      <div
        className="h-28 flex items-center justify-center text-xs border"
        style={{
          color: "var(--px-text2)",
          background: "var(--px-bg3)",
          borderColor: "var(--px-border)",
        }}
      >
        이달 기록이 쌓이면 추이가 보여요
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="행복도와 카테고리 월간 추이 그래프"
    >
      {yTicks.map((lv) => {
        const y = yAt(lv);
        return (
          <g key={lv}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="var(--px-border)"
              strokeWidth={1}
              strokeDasharray={lv === 7 ? "0" : "2 3"}
              opacity={lv === 7 ? 0.85 : 0.4}
            />
            <text
              x={padL - 6}
              y={y + 3}
              textAnchor="end"
              fill="var(--px-text2)"
              fontSize={10}
              fontWeight={700}
            >
              {lv}
            </text>
          </g>
        );
      })}

      <line
        x1={padL}
        x2={width - padR}
        y1={padT + innerH}
        y2={padT + innerH}
        stroke="var(--px-border2)"
        strokeWidth={1.5}
      />

      {overlaySegs.map((o) =>
        o.segments.map((seg, si) => {
          if (seg.length === 0) return null;
          if (seg.length === 1) {
            const [iStr, vStr] = seg[0]!.split(",");
            return (
              <circle
                key={`${o.code}-${si}`}
                cx={xAt(Number(iStr))}
                cy={yAt(Number(vStr))}
                r={2}
                fill={o.color}
                opacity={0.85}
              />
            );
          }
          return (
            <polyline
              key={`${o.code}-${si}`}
              fill="none"
              stroke={o.color}
              strokeWidth={1.75}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={toSvgPoints(seg)}
              opacity={0.9}
            />
          );
        })
      )}

      {happinessSegs.map((seg, si) => {
        if (seg.length === 0) return null;
        if (seg.length === 1) {
          const [iStr, vStr] = seg[0]!.split(",");
          return (
            <circle
              key={`${uid}-h-${si}`}
              cx={xAt(Number(iStr))}
              cy={yAt(Number(vStr))}
              r={3}
              fill="var(--px-accent)"
            />
          );
        }
        return (
          <polyline
            key={`${uid}-h-${si}`}
            fill="none"
            stroke="var(--px-accent)"
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={toSvgPoints(seg)}
          />
        );
      })}

      {happiness.map((p) => {
        const i = indexOf.get(p.date);
        if (i == null) return null;
        return (
          <circle
            key={p.date}
            cx={xAt(i)}
            cy={yAt(p.value)}
            r={2.5}
            fill="var(--px-accent)"
          >
            <title>
              {formatMd(p.date)} · 행복도 {p.value}점
            </title>
          </circle>
        );
      })}

      {labelIdx.map((i) => {
        const date = dates[i];
        if (!date) return null;
        const anchor =
          i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle";
        return (
          <text
            key={`x-${date}`}
            x={xAt(i)}
            y={height - 6}
            textAnchor={anchor}
            fill="var(--px-text2)"
            fontSize={10}
            fontWeight={700}
          >
            {formatMd(date)}
          </text>
        );
      })}
    </svg>
  );
}
