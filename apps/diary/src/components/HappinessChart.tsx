import type { SeriesPoint } from "@/lib/stats/extra";

/**
 * 최근 30일 행복도 그래프 (2026-10-09 Q7 = C). 서버에서 그리는 SVG, 자바스크립트 없음.
 * - 점: 그날 행복도(10점 척도). 기록 없는 날은 점 없음.
 * - 굵은 선: 7일 평균. 창 안 기록 2건 미만이면 끊긴다.
 * - 옅은 점선: 그날 운세 점수. 운세를 안 연 날은 비운다(이어 그리지 않음 — 사용자 결정).
 * 모양(색·굵기·글자)은 디자이너(.hchart*). 좌표 계산만 여기.
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

/** null에서 끊기는 꺾은선 path */
function brokenPath(values: (number | null)[]): string {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i, values.length).toFixed(1)},${y(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

export function HappinessChart({ series }: { series: SeriesPoint[] }) {
  const recorded = series.filter((p) => p.happiness10 !== null).length;
  if (recorded < 2) {
    return <p className="hchart__empty text-[15px] text-muted">기록이 2일 쌓이면 그래프가 그려져요. 하루씩 늘어나 30일까지 자라요.</p>;
  }
  const n = series.length;
  const avgPath = brokenPath(series.map((p) => p.avg7));
  const fortunePath = brokenPath(series.map((p) => p.fortune));
  const first = series[0]!.date.slice(5).replace("-", ".");
  const last = series[n - 1]!.date.slice(5).replace("-", ".");
  return (
    <figure className="hchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${n}일 행복도 그래프. 기록 ${recorded}일`} className="hchart__svg block h-auto w-full">
        {/* 눈금: 0 · 5 · 10 */}
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="hchart__grid" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="hchart__axis">
              {v}
            </text>
          </g>
        ))}
        {fortunePath && <path d={fortunePath} className="hchart__fortune" fill="none" />}
        {avgPath && <path d={avgPath} className="hchart__avg" fill="none" />}
        {series.map((p, i) =>
          p.happiness10 === null ? null : <circle key={p.date} cx={x(i, n)} cy={y(p.happiness10)} r={3} className="hchart__dot" />,
        )}
        <text x={PAD.l} y={H - 6} className="hchart__axis">
          {first}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className="hchart__axis">
          {last}
        </text>
      </svg>
      <figcaption className="hchart__legend mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
        <span className="hchart__key hchart__key--dot">내 행복도</span>
        <span className="hchart__key hchart__key--avg">7일 평균</span>
        <span className="hchart__key hchart__key--fortune">운세 점수</span>
      </figcaption>
    </figure>
  );
}
