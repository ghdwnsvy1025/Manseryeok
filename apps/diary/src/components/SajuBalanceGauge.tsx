import type { CSSProperties } from "react";
import type { SajuChart } from "@/lib/saju/chart";

const W = 280;
const R = 118;
const CX = W / 2;
const CY = 132;
/** 반원(왼쪽 끝 → 위 → 오른쪽 끝) */
const ARC = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
/** 눈금: 25 · 50 · 75 자리(가운데 50이 길다) */
const TICKS = [25, 50, 75];

/**
 * 힘의 균형 (명세 48, 톤 v3.52): 반원 게이지. 왼쪽 끝 "여린 쪽" · 가운데 "고른 쪽" · 오른쪽 끝 "센 쪽", 동그란 표식 자리 = 나를 돕는 기운(비겁+인성) %.
 * 가운데 큰 숫자 "NN%" + "나를 돕는 기운", 그 아래 chart.center.strengthPlain을 인주 도장 하나로. 작은 글씨 한 줄.
 * 게이지는 녹갈·먹(분홍·옥색·주홍·금색 글자 없음). 낱장이 열릴 때 표식이 왼쪽 끝에서 제자리로 한 번(400ms, globals.css .balance*).
 */
export function SajuBalanceGauge({ center }: { center: SajuChart["center"] }) {
  const p = Math.max(0, Math.min(100, center.inbi));
  return (
    <section className="balance" aria-label="힘의 균형">
      <h3 className="saju-h">힘의 균형</h3>
      <div className="balance__gauge" style={{ "--p": p / 100 } as CSSProperties} role="img" aria-label={`나를 돕는 기운 ${p}%. ${center.strengthPlain}`}>
        <svg viewBox={`0 0 ${W} 150`} className="balance__svg" aria-hidden>
          <path d={ARC} className="balance__track" fill="none" />
          <path d={ARC} className="balance__fill" fill="none" pathLength={100} />
          {TICKS.map((t) => {
            const a = Math.PI * (1 - t / 100);
            const r1 = R - 12;
            const r2 = R - (t === 50 ? 24 : 18);
            return <line key={t} x1={CX + r1 * Math.cos(a)} y1={CY - r1 * Math.sin(a)} x2={CX + r2 * Math.cos(a)} y2={CY - r2 * Math.sin(a)} className="balance__tick" />;
          })}
          {/* 표식: 왼쪽 끝에 그려 두고 가운데를 축으로 p × 180° 돌린다 */}
          <circle cx={CX - R} cy={CY} r={8} className="balance__mark" />
        </svg>
        <p className="balance__num font-serif">
          {p}
          <small>%</small>
        </p>
        <p className="balance__cap">나를 돕는 기운</p>
        <span className="balance__end balance__end--mid">고른 쪽</span>
        <span className="balance__end balance__end--low">여린 쪽</span>
        <span className="balance__end balance__end--high">센 쪽</span>
      </div>
      <p className="balance__seal font-serif">{center.strengthPlain}</p>
      <p className="saju-fine">높고 낮음은 좋고 나쁨이 아니에요. 기운을 쓰는 방향이에요</p>
    </section>
  );
}
