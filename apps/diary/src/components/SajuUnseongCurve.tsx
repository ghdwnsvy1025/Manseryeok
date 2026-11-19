import { UNSEONG_NOTE, type ChartColumn, type Unseong } from "@/lib/saju/chart";

/** 한살이 차례(이 그림의 가로 자리). lib의 UNSEONG은 장생부터라 차례가 다르다 — 여기 상수로 둔다 */
const ORDER: Unseong[] = ["태", "양", "장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절"];
/** 자리마다 언덕 높이(0~1). 제왕이 꼭대기 */
const LEVEL = [0.1, 0.2, 0.38, 0.52, 0.7, 0.88, 1, 0.84, 0.62, 0.4, 0.22, 0.1];
const W = 312;
const H = 112;
const TOP = 30;
const BASE = 100;
const xOf = (i: number) => 13 + i * ((W - 26) / 11);
const yOf = (i: number) => BASE - LEVEL[i]! * (BASE - TOP);
const PILLAR: Record<string, string> = { day: "일", month: "월", year: "연", hour: "시" };

/** 열두 점을 지나는 부드러운 선(Catmull-Rom → 3차 베지어) */
function curve(): string {
  const p = ORDER.map((_, i) => [xOf(i), yOf(i)] as const);
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!, b = p[i]!, c = p[i + 1]!, e = p[Math.min(p.length - 1, i + 2)]!;
    d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)} ${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)} ${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
  }
  return d;
}

/**
 * 12운성 한살이 곡선 (명세 50 1번, 톤 v3.54). 앱 주인: "십이운성이 너무 가독성이 없어. 직관적으로 보일 수 있도록."
 * 가로 열두 자리(태 → 절), 제왕에서 가장 높은 언덕 선 하나. 내 네 기둥을 그 선 위에 찍는다 — 동그란 표식 + 위에 한 글자(일 · 월 · 연 · 시).
 * 일주만 진하게(먹 면), 나머지는 녹갈 테. 두 기둥이 같은 자리면 나란히 붙인다. 시간 모름이면 시 표식 없음.
 * 곡선 아래 줄: 기둥 · 12운성 이름(굵게) · 한 줄 뜻(UNSEONG_NOTE), 일주가 맨 위. 높고 낮음은 좋고 나쁨이 아니다.
 * 명식 표 안의 12운성 행은 그대로 — 이 그림은 예전 "십이운성" 뜻풀이 칸을 대신한다. 모양은 globals.css .unseong*
 */
export function SajuUnseongCurve({ columns }: { columns: ChartColumn[] }) {
  // 일 → 월 → 연 → 시 순
  const cols = ["day", "month", "year", "hour"].map((pos) => columns.find((c) => c.pos === pos)).filter((c): c is ChartColumn => !!c && !c.unknown && c.unseong !== null);
  if (cols.length === 0) return null;
  const marks = cols.map((c) => {
    const i = ORDER.indexOf(c.unseong!);
    const same = cols.filter((o) => o.unseong === c.unseong);
    const k = same.indexOf(c);
    // 같은 자리에 둘 이상이면 가운데를 기준으로 14 단위씩 나란히
    const dx = (k - (same.length - 1) / 2) * 14;
    return { c, x: xOf(i) + dx, y: yOf(i) };
  });
  return (
    <section className="unseong" aria-label="12운성">
      <h3 className="saju-h">12운성</h3>
      <div className="unseong__plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="unseong__svg" role="img" aria-label={`한살이 곡선. ${cols.map((c) => `${PILLAR[c.pos]}주 ${c.unseong}`).join(", ")}`}>
          <line x1={0} x2={W} y1={BASE + 6} y2={BASE + 6} className="unseong__base" />
          <path d={curve()} className="unseong__line" fill="none" />
          {ORDER.map((_, i) => (
            <line key={i} x1={xOf(i)} x2={xOf(i)} y1={BASE + 3} y2={BASE + 6} className="unseong__tick" />
          ))}
          {marks.map((m) => (
            <g key={m.c.pos} className="unseong__mark" data-day={m.c.pos === "day" ? "" : undefined}>
              <circle cx={m.x} cy={m.y} r={5.5} />
              <text x={m.x} y={m.y - 11} textAnchor="middle">
                {PILLAR[m.c.pos]}
              </text>
            </g>
          ))}
        </svg>
        {/* 자리 이름 열둘 — 한 자씩 번갈아 위아래 두 줄(좁은 폭에서 겹치지 않게) */}
        <ol className="unseong__names" aria-hidden>
          {ORDER.map((u, i) => (
            <li key={u} data-low={i % 2 ? "" : undefined} data-on={cols.some((c) => c.unseong === u) ? "" : undefined}>
              {u}
            </li>
          ))}
        </ol>
      </div>
      <dl className="unseong__rows">
        {cols.map((c) => (
          <div key={c.pos} className="unseong__row" data-day={c.pos === "day" ? "" : undefined}>
            <dt>{PILLAR[c.pos]}주</dt>
            <dd>
              <b>{c.unseong}</b>
              <span>{UNSEONG_NOTE[c.unseong!]}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="saju-fine">기운이 자라고 줄어드는 차례를 사람의 한살이에 빗댄 이름이에요. 높고 낮음이 좋고 나쁨은 아니에요</p>
    </section>
  );
}
