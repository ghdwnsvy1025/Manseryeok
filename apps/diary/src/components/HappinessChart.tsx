"use client";

import { useState } from "react";
import { AREAS, happinessTier, type AreaKey } from "@/lib/entry";
import { areaTo10, type SeriesPoint } from "@/lib/stats/extra";

/**
 * 최근 30일 행복도 그래프 (2026-10-09 Q7 = C → 2026-10-31 개편). SVG 좌표 계산만 여기, 모양(색·굵기·글자)은 디자이너(.hchart*).
 * - 점: 그날 값(10점 척도). 기록 없는 날은 점 없음.
 * - 선: 기록한 날끼리 잇는다. 기록이 없는 날을 건너는 구간은 옅게(.hchart__line--gap) — 끊기면 읽기 어렵고(사용자),
 *   그냥 이으면 빈 날에도 그만큼이었던 것처럼 읽힌다. 운세 점수(가는 녹갈 실선, 2026-10-31 점선에서 바꿈)도 같은 규칙(.hchart__fortune--gap).
 * - 칩: 전체(하루 행복도) · 영역(일·공부 …) — 고른 것의 선으로 바꿔 본다. 영역 칩은 그 영역을 매긴 날이 있을 때만.
 *   영역 값 = 단계 × 2를 하루 행복도로 보고 같은 척도(areaTo10). 운세 점수는 "전체"에서만.
 */
const W = 320;
const H = 150;
const PAD = { l: 22, r: 8, t: 10, b: 22 };

function x(i: number, n: number): number {
  return PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
}
function y(v: number): number {
  return PAD.t + (1 - v / 10) * (H - PAD.t - PAD.b);
}

/** 기록한 날끼리 잇는 두 path: 이웃한 날끼리(solid)와 빈 날을 건너는 구간(gap) */
export function bridgedPaths(values: (number | null)[]): { solid: string; gap: string } {
  let solid = "";
  let gap = "";
  let prev: number | null = null;
  values.forEach((v, i) => {
    if (v === null) return;
    const pt = `${x(i, values.length).toFixed(1)},${y(v).toFixed(1)}`;
    if (prev === null) solid += `M${pt} `;
    else {
      const from = `${x(prev, values.length).toFixed(1)},${y(values[prev]!).toFixed(1)}`;
      if (i - prev === 1) solid += `M${from} L${pt} `;
      else gap += `M${from} L${pt} `;
    }
    prev = i;
  });
  return { solid: solid.trim(), gap: gap.trim() };
}

type View = "all" | AreaKey;

export function HappinessChart({ series, emptyArt }: { series: SeriesPoint[]; emptyArt?: string }) {
  const [view, setView] = useState<View>("all");
  const recorded = series.filter((p) => p.happiness10 !== null).length;
  if (recorded < 2) {
    // v3.20 Q3 = C: 빈 화면도 비어 보이지 않게 — 흐린 내 캐릭터 + 한 줄. 모양은 디자이너(.empty-art)
    return (
      <div className="empty-art">
        {emptyArt && <img src={emptyArt} alt="" width={96} height={96} className="empty-art__img" />}
        <p className="hchart__empty text-[15px] text-muted">기록이 2일 쌓이면 그래프가 그려져요. 하루씩 늘어나 30일까지 자라요.</p>
      </div>
    );
  }
  const n = series.length;
  const areaChips = AREAS.filter((a) => series.some((p) => typeof p.areas?.[a.key] === "number"));
  const values =
    view === "all"
      ? series.map((p) => p.happiness10)
      : series.map((p) => {
          const lv = p.areas?.[view];
          return typeof lv === "number" ? areaTo10(lv) : null;
        });
  const line = bridgedPaths(values);
  const fortune = view === "all" ? bridgedPaths(series.map((p) => p.fortune)) : { solid: "", gap: "" };
  const first = series[0]!.date.slice(5).replace("-", ".");
  const last = series[n - 1]!.date.slice(5).replace("-", ".");
  const viewLabel = view === "all" ? "행복도" : (AREAS.find((a) => a.key === view)?.label ?? "");
  return (
    <figure className="hchart">
      {areaChips.length > 0 && (
        <div className="hchart__chips mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="그래프에서 볼 것">
          {[{ key: "all" as View, label: "전체" }, ...areaChips.map((a) => ({ key: a.key as View, label: a.label }))].map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={view === c.key}
              onClick={() => setView(c.key)}
              className="hchart__chip"
              data-on={view === c.key ? "" : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n}일 ${viewLabel} 그래프. 기록 ${values.filter((v) => v !== null).length}일`} className="hchart__svg block h-auto w-full">
        {/* 눈금: 0 · 5 · 10 */}
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="hchart__grid" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="hchart__axis">
              {v}
            </text>
          </g>
        ))}
        {fortune.gap && <path d={fortune.gap} className="hchart__fortune hchart__fortune--gap" fill="none" />}
        {fortune.solid && <path d={fortune.solid} className="hchart__fortune" fill="none" />}
        {line.gap && <path d={line.gap} className="hchart__line hchart__line--gap" fill="none" />}
        {line.solid && <path d={line.solid} className="hchart__line" fill="none" />}
        {values.map((v, i) =>
          v === null ? null : <circle key={series[i]!.date} cx={x(i, n)} cy={y(v)} r={3} className="hchart__dot" data-tier={happinessTier(Math.round((v / 10) * 9 + 1))} />,
        )}
        <text x={PAD.l} y={H - 6} className="hchart__axis">
          {first}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="hchart__axis">
          {last}
        </text>
      </svg>
      <figcaption className="hchart__legend mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="hchart__key hchart__key--dot">{view === "all" ? "내 행복도" : viewLabel}</span>
        {view === "all" && <span className="hchart__key hchart__key--fortune">운세 점수</span>}
        <span className="hchart__key hchart__key--gap">옅은 선 = 기록 없는 날을 건넘</span>
      </figcaption>
    </figure>
  );
}
