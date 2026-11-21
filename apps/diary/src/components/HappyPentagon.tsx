import { GROUP_MIN_DAYS, type HappyWhen } from "@/lib/stats/insight";

/**
 * "어떤 날에 행복했나"의 오각형 (명세 54, 톤 v3.58). 앱 주인: "십신에 따른 행복도가 적혀 있는데 가시성이 좋지 않아. 차라리 5각형 그래프로".
 * 자는 0~10이 아니라 **내 평균을 가운데에 둔다** — 다섯 값이 서로 가까워 0~10으로 그리면 정오각형이 되어 아무것도 안 보인다.
 *   고리 셋: 안쪽(평균 − 2) · 평균(조금 진한 실선, 옆에 "내 평균 6.5") · 바깥(평균 + 2). 값이 그 밖이면 끝에 붙인다.
 * 값 도형: 다섯 꼭짓점을 이은 옅은 녹갈 면 + 녹갈 2px 테, 꼭짓점마다 작은 점. 1등(happy.top)만 옥색 점 + 굵은 이름과 숫자.
 * 3일 미만인 갈래는 값을 모르는 것 — 평균 고리 위 빈 점 + 이름 옆 "?", 그 꼭짓점에 닿는 변은 옅게. 다섯 모두 3일 미만이면 고리만.
 * 아래 풀이 다섯 줄은 "꼭짓점 이름이 무슨 뜻인가" — 막대 · 평균 숫자를 되풀이하지 않는다(오각형과 같은 차례, 1등 줄만 본문 색).
 */
const W = 320;
const H = 276;
const CX = 160;
const CY = 146;
/** 바깥 고리(평균 + 2) · 안쪽 고리(평균 − 2) 반지름. 평균 고리는 그 한가운데 */
const R_OUT = 100;
const R_IN = 24;
const R_MID = (R_OUT + R_IN) / 2;
const SPAN = 2;

/** k번째 꼭짓점(맨 위부터 시계 방향)의 반지름 r 자리 */
function at(k: number, r: number): [number, number] {
  const a = (-90 + k * 72) * (Math.PI / 180);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
const pts = (r: number): string =>
  [0, 1, 2, 3, 4]
    .map((k) => at(k, r).map((v) => v.toFixed(1)).join(","))
    .join(" ");
/** 값 → 반지름: 평균이면 가운데 고리, 평균 + 2면 바깥 끝, 평균 − 2면 안쪽 끝 */
export function pentagonRadius(value: number, overall: number): number {
  const t = Math.min(1, Math.max(-1, (value - overall) / SPAN));
  return R_MID + t * (R_OUT - R_MID);
}

/** 꼭짓점 이름 자리: 위는 점 위, 양옆은 바깥 옆, 아래 둘은 점 아래 */
const LABEL: { dx: number; dy: number; anchor: "start" | "middle" | "end" }[] = [
  { dx: 0, dy: -30, anchor: "middle" },
  { dx: 12, dy: -6, anchor: "start" },
  { dx: 6, dy: 22, anchor: "middle" },
  { dx: -6, dy: 22, anchor: "middle" },
  { dx: -12, dy: -6, anchor: "end" },
];

export function HappyPentagon({ happy }: { happy: HappyWhen }) {
  const overall = happy.overall;
  const ring = happy.ring.map((r) => ({ ...r, thin: r.n < GROUP_MIN_DAYS || r.avg === null }));
  const none = overall === null || ring.every((r) => r.thin);
  const top = happy.top?.group ?? null;
  const vertex = ring.map((r, k) => at(k, none || r.thin ? R_MID : pentagonRadius(r.avg!, overall!)));
  const said = none
    ? "기록이 더 쌓이면 다섯 갈래가 그려져요"
    : `내 평균 ${overall}. ${ring.map((r) => (r.thin ? `${r.short}은 ${r.n}일뿐이라 아직 몰라요` : `${r.short} ${r.avg}${top === r.group ? " 가장 높아요" : ""}`)).join(", ")}`;
  return (
    <div className="penta" data-none={none ? "" : undefined}>
      <svg className="penta__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`들어온 기운 다섯 갈래의 내 행복도 평균. ${said}`}>
        {/* 고리 셋과 살 다섯 */}
        <polygon points={pts(R_OUT)} className="penta__ring" />
        <polygon points={pts(R_IN)} className="penta__ring" />
        {[0, 1, 2, 3, 4].map((k) => {
          const [x1, y1] = at(k, R_IN);
          const [x2, y2] = at(k, R_OUT);
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className="penta__spoke" />;
        })}
        <polygon points={pts(R_MID)} className="penta__ring penta__ring--mid" />
        {!none && (
          <g className="penta__value">
            <polygon points={vertex.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")} className="penta__face" />
            {ring.map((r, k) => {
              const n = (k + 1) % 5;
              const faint = r.thin || ring[n]!.thin;
              return <line key={r.group} x1={vertex[k]![0]} y1={vertex[k]![1]} x2={vertex[n]![0]} y2={vertex[n]![1]} className="penta__edge" data-faint={faint ? "" : undefined} />;
            })}
            {ring.map((r, k) => (
              <circle key={r.group} cx={vertex[k]![0]} cy={vertex[k]![1]} r={top === r.group ? 5 : 3.2} className="penta__dot" data-top={top === r.group ? "" : undefined} data-thin={r.thin ? "" : undefined} />
            ))}
          </g>
        )}
        {/* 평균 고리의 이름 — 아래 변 바로 아래, 종이색 테를 둘러 선 위에서도 읽힌다 */}
        {overall !== null && (
          <text x={CX} y={at(2, R_MID)[1] + 15} textAnchor="middle" className="penta__mid-label">
            내 평균 {overall}
          </text>
        )}
        {/* 꼭짓점 이름과 평균 — 자리는 바깥 고리 기준이라 값이 바뀌어도 글자가 움직이지 않는다 */}
        {ring.map((r, k) => {
          const [x, y] = at(k, R_OUT);
          const l = LABEL[k]!;
          return (
            <text key={r.group} x={x + l.dx} y={y + l.dy} textAnchor={l.anchor} className="penta__label" data-top={top === r.group ? "" : undefined} data-thin={r.thin ? "" : undefined}>
              <tspan className="penta__name">{r.short}</tspan>
              {r.thin ? (
                <tspan className="penta__q" dx="3">
                  ?
                </tspan>
              ) : (
                !none && (
                  <tspan className="penta__num" x={x + l.dx} dy="17">
                    {r.avg!.toFixed(1)}
                  </tspan>
                )
              )}
            </text>
          );
        })}
      </svg>
      {none && <p className="penta__none">기록이 더 쌓이면 다섯 갈래가 그려져요</p>}
      <ol className="penta-keys" aria-label="다섯 갈래가 어떤 날인지">
        {ring.map((r) => (
          <li key={r.group} className="penta-key" data-top={top === r.group ? "" : undefined}>
            <span className="penta-key__name">{r.short}</span>
            <span className="penta-key__hint">{r.hint}</span>
            <span className="penta-key__n">{r.n}일</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
