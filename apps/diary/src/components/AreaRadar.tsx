import type { AreaRadarRow } from "@/lib/stats/extra";

/**
 * 영역 육각형 (2026-10-31 사용자 Q4 = a): 여섯 영역의 평균 단계(1~5)를 한 장에. 이번 달 = 진한 면, 지난달 = 옅은 선.
 * 서버에서 그리는 SVG. 축 순서는 AREAS 순서(위에서 시계 방향). 매긴 날이 없는 영역은 중심(0)으로.
 * 모양(색·굵기·글자)은 디자이너(.radar*).
 */
const C = 110;
const R = 78;

function point(i: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
  const r = (v / 5) * R;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}
const poly = (vals: number[]) => vals.map((v, i) => point(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");

export function AreaRadar({ rows, curLabel, prevLabel }: { rows: AreaRadarRow[]; curLabel: string; prevLabel: string }) {
  const hasPrev = rows.some((r) => r.prev !== null);
  return (
    <figure className="radar">
      <svg viewBox="0 0 220 220" role="img" aria-label={`영역별 행복도, ${curLabel}${hasPrev ? `과 ${prevLabel}` : ""}`} className="radar__svg mx-auto block h-auto w-full max-w-[260px]">
        {[1, 2, 3, 4, 5].map((lv) => (
          <polygon key={lv} points={poly(Array(6).fill(lv))} className="radar__ring" data-level={lv} fill="none" />
        ))}
        {rows.map((_, i) => {
          const [x, y] = point(i, 5);
          return <line key={i} x1={C} y1={C} x2={x} y2={y} className="radar__axis" />;
        })}
        {hasPrev && <polygon points={poly(rows.map((r) => r.prev ?? 0))} className="radar__prev" />}
        <polygon points={poly(rows.map((r) => r.cur ?? 0))} className="radar__cur" />
        {rows.map((r, i) => {
          const [x, y] = point(i, 6.1);
          return (
            <text key={r.key} x={x} y={y + 4} textAnchor="middle" className="radar__label" data-empty={r.cur === null ? "" : undefined}>
              {r.label}
            </text>
          );
        })}
      </svg>
      <figcaption className="radar__legend mt-1 flex justify-center gap-4 text-[13px] text-muted">
        <span className="radar__key radar__key--cur">{curLabel}</span>
        {hasPrev && <span className="radar__key radar__key--prev">{prevLabel}</span>}
      </figcaption>
    </figure>
  );
}
