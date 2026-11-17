import type { CSSProperties } from "react";
import type { SajuChart } from "@/lib/saju/chart";

/** 용신 역할 → 인장 글자. 용·희만 찍는다 */
const ROLE_SEAL: Record<string, string> = { 용: "필요", 희: "도움" };

/**
 * 다섯 힘 (명세 48, 톤 v3.52): chart.power 다섯(목화토금수)을 세로 막대로. 높이 = %, 가장 큰 값이 그림 높이의 9할.
 * 막대 위 "NN%"(+ 용신이면 인주 도장 "필요", 희신이면 "도움"), 아래 오행 한 글자(오행 색, 명조)와 갈래 쉬운 말의 짧은 꼴(chart.power[].short — lib의 GROUP_SHORT).
 * 0%인 오행은 바닥선 위 납작한 옅은 획. 그림 아래 한 문장 "{가장 큰 오행의 쉬운 말}이 가장 커요".
 * 낱장이 열릴 때 막대가 바닥에서 한 번 자란다(300ms, globals.css .power*). 숫자는 판정용 세력 — 오행 방울(엔진 분포율)과 같이 내지 않는다.
 */
export function SajuPowerBars({ power, hourUnknown }: { power: SajuChart["power"]; hourUnknown: boolean }) {
  const max = Math.max(...power.map((p) => p.pct), 1);
  const top = power.reduce((a, p) => (p.pct > a.pct ? p : a), power[0]!);
  return (
    <section className="power" aria-label="다섯 힘">
      <h3 className="saju-h">다섯 힘</h3>
      <ol className="power__bars">
        {power.map((p) => {
          const seal = p.role ? ROLE_SEAL[p.role] : undefined;
          return (
            <li key={p.el} className="power__col" data-el={p.el} data-zero={p.pct === 0 ? "" : undefined} aria-label={`${p.ko} ${p.pct}%, ${p.short}${seal ? `, ${seal}한 기운` : ""}`}>
              <span className="power__plot" aria-hidden>
                <span className="power__top">
                  {seal && <span className="power__seal">{seal}</span>}
                  <span className="power__pct">{p.pct}%</span>
                </span>
                <span className="power__bar" style={{ "--h": (p.pct / max) * 0.9 } as CSSProperties} />
              </span>
              <span className="power__el font-serif" aria-hidden>
                {p.ko}
              </span>
              <span className="power__word" aria-hidden>
                {p.short}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="saju-say">{top.plain.split(" — ")[0]}이 가장 커요</p>
      {hourUnknown && <p className="saju-fine">태어난 시간을 넣으면 더 정확해져요</p>}
    </section>
  );
}
