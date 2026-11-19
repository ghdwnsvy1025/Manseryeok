"use client";

import { useState, type PointerEvent } from "react";
import { AREAS, type AreaKey } from "@/lib/entry";
import { areaTo10, type SeriesPoint } from "@/lib/stats/extra";

/**
 * 행복도 그래프 (2026-10-09 Q7 = C → 2026-10-31 개편 → 명세 47, 톤 v3.51 → 같은 날 "그래프 더 다듬기"). SVG 좌표 계산만 여기, 모양(색·굵기·글자)은 디자이너(.hchart*).
 * 명세 47(앱 주인: "점들이 너무 많고 색깔이 이상해서 가시성이 없어. 점을 빼 주고 날짜를 기입"):
 * - 날마다 찍던 점은 없다. 가장 높은 날 · 낮은 날 두 곳에만 작은 도장(옥색 · 주홍)과 그 값 — 도장은 선을 덮지 않게 점 위(높은 날) · 점 아래(낮은 날)로 비켜 앉는다.
 *   도장 옆에 그날 날짜를 적는다(명세 49: 11.14, 11.7 — 낱장 위 두 칸과 같은 날).
 * - 가로축에 날짜를 5일 간격으로(11.3  11.8  11.13 …), 세로축은 0 · 5 · 10.
 * - **한 그림에 선 모양은 둘까지, 점선은 없다.**
 *     예상 선이 없는 그림(happy, full의 영역 보기): 행복도 굵은 선 + 기록 없는 날을 건너는 같은 색 가는 선(이어 준다 — 흐름이 한 줄로 읽힌다).
 *     예상 선이 있는 그림(full의 "전체"): 행복도 굵은 선 + 옅고 가는 예상 선. 기록 없는 날은 잇지 않고 끊어 둔다 —
 *       가는 이음선이 가는 예상 선과 같은 모양이라 헷갈리고, 끊긴 자리가 곧 "기록 없음"이라 풀이 줄이 필요 없다.
 *     앞뒤가 비어 혼자 있는 기록일은 그 자리의 짧은 가로 획(굵은 선과 같은 굵기)으로 보인다.
 * - 예상 선(그날 본 운세)은 뒤에 깔리고, 행복도 선은 종이색 테를 두르고 그 위에 — 겹치는 곳에서도 행복도가 먼저 읽힌다. 주황 · 분홍은 쓰지 않는다. 예상의 숫자는 어디에도 적지 않는다.
 * - 선을 건드리면(누르거나 끌면) 그날 날짜와 값이 그래프 위 띠(도장 반대쪽 구석)에 뜬다. 안내 "선을 누르면 그날 값이 보여요"는 그래프 아래 범례 줄에 작게.
 * variant:
 *   full   = 자세한 통계 안. 한 달 / 1년 전환 + 영역 칩(전체 · 일·공부 …) + 예상 선("전체"에서만)
 *   happy  = "나는 언제 행복했지?" 낱장. 행복도 선 하나, 전환 없음, 예상 선 없음
 *   (versus 변형은 지웠다 — "예상은 맞았을까?" 낱장은 그래프 없이 문장과 날 목록만. 2026-11-17 후속)
 */
const W = 320;
const H = 176;
/** 위 30 = 가장 높은 날 도장과 건드린 값이 앉는 띠, 아래 30 = 날짜 글자 */
const PAD = { l: 22, r: 12, t: 30, b: 30 };
/** 도장 지름 22px ≈ 24 단위(375px에서 그림 폭 287px ÷ 320). 점에서 도장 가운데까지 */
const PEAK_OFF = 16;
const PEAK_R = 12;
/** 혼자 있는 기록일의 가로 획 반쪽 길이 */
const LONE = 3.5;

function x(i: number, n: number): number {
  return PAD.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
}
function y(v: number): number {
  return PAD.t + (1 - v / 10) * (H - PAD.t - PAD.b);
}

/**
 * 기록한 날끼리 잇는 path 셋: 이웃한 날끼리(solid), 빈 날을 건너는 구간(gap), 앞뒤가 비어 혼자 있는 날의 짧은 가로 획(lone).
 * lone은 값이 하나뿐인 그림에서도 그 하루가 보이게 한다
 */
export function bridgedPaths(values: (number | null)[]): { solid: string; gap: string; lone: string } {
  let solid = "";
  let gap = "";
  let lone = "";
  let prev: number | null = null;
  const n = values.length;
  values.forEach((v, i) => {
    if (v === null) return;
    const px = x(i, n);
    const pt = `${px.toFixed(1)},${y(v).toFixed(1)}`;
    if (prev !== null) {
      const from = `${x(prev, n).toFixed(1)},${y(values[prev]!).toFixed(1)}`;
      if (i - prev === 1) solid += `M${from} L${pt} `;
      else gap += `M${from} L${pt} `;
    }
    const alone = (i === 0 || values[i - 1] === null || values[i - 1] === undefined) && (i === n - 1 || values[i + 1] === null || values[i + 1] === undefined);
    if (alone) lone += `M${(px - LONE).toFixed(1)},${y(v).toFixed(1)} L${(px + LONE).toFixed(1)},${y(v).toFixed(1)} `;
    prev = i;
  });
  return { solid: solid.trim(), gap: gap.trim(), lone: lone.trim() };
}

/**
 * 기록한 날을 차례로 잇는 한 줄(명세 50 7번) — 빈 날을 건너도 같은 선으로 이어진다. 값이 하루뿐이면 그날 자리에 짧은 가로 획 하나.
 * bridgedPaths(시험이 본다)의 돌려주는 값은 그대로 두고, 그리는 쪽은 이 한 줄을 쓴다
 */
function joined(values: (number | null)[]): string {
  const n = values.length;
  const pts = values.map((v, i) => (v === null || v === undefined ? null : `${x(i, n).toFixed(1)},${y(v).toFixed(1)}`)).filter((p): p is string => p !== null);
  if (pts.length === 0) return "";
  if (pts.length === 1) {
    const i = values.findIndex((v) => v !== null && v !== undefined);
    return `M${(x(i, n) - LONE).toFixed(1)},${y(values[i]!).toFixed(1)} L${(x(i, n) + LONE).toFixed(1)},${y(values[i]!).toFixed(1)}`;
  }
  return `M${pts.join(" L")}`;
}

type View = "all" | AreaKey;
type Variant = "full" | "happy";

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function HappinessChart({ series: monthSeries, yearSeries, emptyArt, variant = "full" }: { series: SeriesPoint[]; yearSeries?: SeriesPoint[]; emptyArt?: string; variant?: Variant }) {
  const [view, setView] = useState<View>("all");
  // 2026-10-31 사용자: 한 달 / 1년 보기. 1년은 최근 12달의 월별 평균(monthlySeries) — 한 칸이 한 달
  const [range, setRange] = useState<"month" | "year">("month");
  // 건드린 자리(그 날의 순번)
  const [at, setAt] = useState<number | null>(null);
  const full = variant === "full";
  const year = full && range === "year" && yearSeries ? yearSeries : null;
  const series = year ?? monthSeries;
  const unit = year ? "달" : "일";
  const recorded = series.filter((p) => p.happiness10 !== null).length;
  const rangeSwitch =
    full && yearSeries ? (
      <div className="hchart__range mb-2 flex gap-1" role="radiogroup" aria-label="기간">
        {(
          [
            ["month", "한 달"],
            ["year", "1년"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={range === k}
            data-on={range === k ? "" : undefined}
            onClick={() => {
              setRange(k);
              setAt(null);
            }}
            className="hchart__chip hchart__chip--range"
          >
            {label}
          </button>
        ))}
      </div>
    ) : null;
  if (recorded < 2) {
    // v3.20 Q3 = C: 빈 화면도 비어 보이지 않게 — 흐린 내 캐릭터 + 한 줄. 모양은 디자이너(.empty-art)
    return (
      <>
        {year && rangeSwitch}
        <div className="empty-art">
          {emptyArt && <img src={emptyArt} alt="" width={96} height={96} className="empty-art__img" />}
          <p className="hchart__empty text-[15px] text-muted">
            {year ? "기록이 두 달에 걸쳐 쌓이면 1년 그래프가 그려져요." : "기록이 2일 쌓이면 그래프가 그려져요. 하루씩 늘어나 30일까지 자라요."}
          </p>
        </div>
      </>
    );
  }
  const n = series.length;
  const areaChips = full ? AREAS.filter((a) => series.some((p) => typeof p.areas?.[a.key] === "number")) : [];
  const values =
    view === "all"
      ? series.map((p) => p.happiness10)
      : series.map((p) => {
          const lv = p.areas?.[view];
          return typeof lv === "number" ? areaTo10(lv) : null;
        });
  /** 눈에 적는 값: "전체"는 내가 매긴 행복도 그대로(1~10, 1년 보기는 그 달 평균), 영역은 10점으로 옮긴 값 */
  const shown = (i: number): number | null => {
    const v = values[i];
    if (v === null || v === undefined) return null;
    return view === "all" ? (series[i]!.happiness === null ? null : round1(series[i]!.happiness!)) : round1(v);
  };
  const line = bridgedPaths(values);
  const fortune = full && view === "all" ? bridgedPaths(series.map((p) => p.fortune)) : { solid: "", gap: "", lone: "" };
  // 예상 선이 그려지는 그림인가 — 그러면 행복도의 빈 날은 잇지 않는다(선 모양은 둘까지)
  const hasForecast = Boolean(fortune.solid || fortune.gap || fortune.lone);
  const label = (d: string) => (year ? `${Number(d.slice(5, 7))}월` : `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`);
  const viewLabel = view === "all" ? "행복도" : (AREAS.find((a) => a.key === view)?.label ?? "");

  // 가장 높은 날 · 낮은 날(같은 값이면 최근 날). 모두 같은 값이면 낮은 날 도장은 없다
  const idx = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
  const hi = idx.reduce((a, i) => (values[i]! >= values[a]! ? i : a), idx[0]!);
  const lo = idx.reduce((a, i) => (values[i]! <= values[a]! ? i : a), idx[0]!);
  // 도장 자리: 높은 날은 점 위, 낮은 날은 점 아래 — 선이 꺾여 나가는 반대쪽이라 선을 덮지 않는다. 좌우는 그림 안으로 당긴다.
  // 낮은 날이 바닥에 붙어 아래에 두면 날짜 글자를 덮을 때만 옆(가운데 쪽)으로 비킨다
  const clampX = (px: number) => Math.min(W - PEAK_R - 1, Math.max(PAD.l + PEAK_R, px));
  const hiAt = { cx: clampX(x(hi, n)), cy: y(values[hi]!) - PEAK_OFF };
  const loRoom = y(values[lo]!) + PEAK_OFF + PEAK_R <= y(0) + 13;
  const loSide = x(lo, n) < W / 2 ? 1 : -1;
  const loAt = loRoom ? { cx: clampX(x(lo, n)), cy: y(values[lo]!) + PEAK_OFF } : { cx: clampX(x(lo, n) + loSide * (PEAK_OFF + 4)), cy: y(values[lo]!) - 4 };
  const peaks = [{ kind: "hi" as const, i: hi, ...hiAt }, ...(values[lo]! < values[hi]! ? [{ kind: "lo" as const, i: lo, ...loAt }] : [])];

  // 날짜 눈금: 한 달 보기는 5일 간격, 1년 보기는 두 달 간격(달이 여덟 이하면 달마다)
  const step = year ? (n > 8 ? 2 : 1) : 5;
  const ticks = series.map((_, i) => i).filter((i) => i % step === 0);

  const touch = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const near = idx.reduce((a, i) => (Math.abs(x(i, n) - px) < Math.abs(x(a, n) - px) ? i : a), idx[0]!);
    setAt(near);
  };
  const atOk = at !== null && at < n && values[at] !== null && values[at] !== undefined ? at : null;

  return (
    <figure className="hchart" data-variant={variant}>
      {rangeSwitch}
      {areaChips.length > 0 && (
        <div className="hchart__chips mb-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="그래프에서 볼 것">
          {[{ key: "all" as View, label: "전체" }, ...areaChips.map((a) => ({ key: a.key as View, label: a.label }))].map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={view === c.key}
              onClick={() => {
                setView(c.key);
                setAt(null);
              }}
              className="hchart__chip"
              data-on={view === c.key ? "" : undefined}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="hchart__plot" onPointerDown={touch} onPointerMove={(e) => (e.pointerType === "mouse" && e.buttons === 0 ? undefined : touch(e))}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n}${unit} ${viewLabel} 그래프. 기록 ${idx.length}${unit}, 가장 높은 값 ${shown(hi)}, 가장 낮은 값 ${shown(lo)}`} className="hchart__svg block h-auto w-full">
          {/* 눈금: 0 · 5 · 10 */}
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="hchart__grid" />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="hchart__axis">
                {v}
              </text>
            </g>
          ))}
          {/* 날짜: 5일 간격. 눈금 자리에 짧은 금 하나 */}
          {ticks.map((i) => (
            <g key={series[i]!.date}>
              <line x1={x(i, n)} x2={x(i, n)} y1={y(0)} y2={y(0) + 3} className="hchart__grid hchart__tick" />
              <text x={x(i, n)} y={H - 8} textAnchor={i === 0 ? "start" : x(i, n) > W - 24 ? "end" : "middle"} className="hchart__axis">
                {label(series[i]!.date)}
              </text>
            </g>
          ))}
          {/* 명세 50 7번(앱 주인 "그래프가 끊기면 안 돼. 쭉 그려 줘"): 기록 없는 날을 건너 같은 선으로 쭉 잇는다 — 가는 이음선 · 끊김 · 혼자 있는 날의 가로 획은 없다.
              예상 선도 한 줄로 이어 뒤에 옅게, 행복도 선은 종이색 테 위에 */}
          {hasForecast && <path d={joined(series.map((p) => p.fortune))} className="hchart__fortune" fill="none" />}
          {hasForecast && <path d={joined(values)} className="hchart__halo" fill="none" />}
          <path d={joined(values)} className="hchart__line" fill="none" />
          {atOk !== null && (
            <g className="hchart__cursor">
              <line x1={x(atOk, n)} x2={x(atOk, n)} y1={PAD.t - 4} y2={y(0)} />
              <circle cx={x(atOk, n)} cy={y(values[atOk]!)} r={3.5} />
            </g>
          )}
        </svg>
        {/* 가장 높은 날 · 낮은 날: 도장 둘(키트 도장 알파로 오린 면 — 옥색 · 주홍)과 그 값. 점 위 · 점 아래로 비켜 선을 덮지 않는다 */}
        {peaks.map((p) => (
          <span key={p.kind} className="hchart__peak" data-kind={p.kind} style={{ left: `${(p.cx / W) * 100}%`, top: `${(p.cy / H) * 100}%` }} aria-hidden>
            {shown(p.i)}
            {/* 도장 옆 날짜(명세 49) — 낱장 위 두 칸과 같은 날임이 보이게. 그림 오른쪽 끝에 가까우면 도장 왼쪽에 */}
            <span className="hchart__peak-date" data-side={p.cx > W - 58 ? "left" : "right"}>
              {label(series[p.i]!.date)}
            </span>
          </span>
        ))}
        {/* 건드린 날의 날짜와 값 — 그래프 위 띠, 높은 날 도장의 반대쪽 구석 */}
        <p className="hchart__read" aria-live="polite" data-side={hiAt.cx < W / 2 ? "right" : "left"}>
          {atOk !== null && (
            <>
              <span className="hchart__read-date">{label(series[atOk]!.date)}</span>
              <span>
                {viewLabel}
                {year ? " 평균" : ""} <b>{shown(atOk)}</b>
              </span>
            </>
          )}
        </p>
      </div>
      <figcaption className="hchart__legend mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
        {(full || hasForecast) && <span className="hchart__key hchart__key--line">{view === "all" ? `내 행복도${year ? " (월 평균)" : ""}` : viewLabel}</span>}
        {hasForecast && <span className="hchart__key hchart__key--fortune">사주로 본 예상</span>}
        <span className="hchart__hint">선을 누르면 그날 값이 보여요</span>
      </figcaption>
    </figure>
  );
}
