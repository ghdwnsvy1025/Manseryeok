"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/ui/clickBurst";

/** 벚꽃잎 팔레트 — 연분홍·살구·옅은 흰분홍 */
const PETAL_COLORS = [
  "#f6c6d4",
  "#f2b6c8",
  "#efd0da",
  "#f8d4dc",
  "#e8a8bc",
  "#fce8ee",
];

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  spin: number;
  sway: number;
  swayAmp: number;
  swaySpeed: number;
  color: string;
  life: number;
  maxLife: number;
};

function drawPetal(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string
) {
  const s = size;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  ctx.bezierCurveTo(s * 0.55, s * 0.15, s * 0.45, -s * 0.55, 0, -s * 0.35);
  ctx.bezierCurveTo(-s * 0.45, -s * 0.55, -s * 0.55, s * 0.15, 0, s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(0.6, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.quadraticCurveTo(s * 0.04, 0, 0, -s * 0.2);
  ctx.stroke();
}

type Props = {
  /**
   * 값이 바뀔 때마다(0보다 클 때) 한 번 흩날림.
   * 결과 공개 시 `setToken((n) => n + 1)` 형태로 올리면 됩니다.
   */
  playToken: number;
  /** fixed overlay z-index */
  zIndex?: number;
};

/**
 * 오늘의 명언과 같은 벚꽃잎 흩날림 — 운세·질문 결과 공개에도 재사용.
 */
export default function CherryBlossomLayer({
  playToken,
  zIndex = 120,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (playToken <= 0) return;
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const petals: Petal[] = [];
    const spawn = (n: number, nearCenter = false) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isNarrow = W < 480;
      for (let i = 0; i < n; i++) {
        const y = nearCenter
          ? H * (0.18 + Math.random() * 0.28)
          : H * (0.08 + Math.random() * 0.22);
        petals.push({
          x: W * (0.12 + Math.random() * 0.76),
          y,
          vx: (Math.random() - 0.5) * (isNarrow ? 48 : 72),
          vy: 8 + Math.random() * (isNarrow ? 36 : 52),
          size: (isNarrow ? 5 : 6.5) + Math.random() * (isNarrow ? 4 : 5.5),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 3.2,
          sway: Math.random() * Math.PI * 2,
          swayAmp: 18 + Math.random() * 28,
          swaySpeed: 1.8 + Math.random() * 2.0,
          color:
            PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]!,
          life: 0,
          maxLife: 3.2 + Math.random() * 2.2,
        });
      }
    };

    const narrow = window.innerWidth < 480;
    spawn(narrow ? 18 : 26, true);
    const wave2 = window.setTimeout(() => spawn(narrow ? 8 : 12, false), 280);
    const wave3 = window.setTimeout(() => spawn(narrow ? 5 : 8, true), 700);

    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      for (const p of petals) {
        if (p.life >= p.maxLife) continue;
        p.life += dt;
        p.sway += p.swaySpeed * dt;
        p.rot += p.spin * dt;
        p.vy += 14 * dt;
        p.vy = Math.min(p.vy, 110);
        p.vx *= 1 - 0.22 * dt;
        const swayX = Math.sin(p.sway) * p.swayAmp * dt;
        p.x += p.vx * dt + swayX;
        p.y += p.vy * dt;

        const t = p.life / p.maxLife;
        const fade =
          t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.45) / 0.55);
        const alpha = fade * 0.82;
        if (alpha <= 0.02) continue;

        const flip = 0.35 + 0.65 * Math.abs(Math.sin(p.sway * 0.7 + p.rot));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(flip, 1);
        drawPetal(ctx, p.size, p.color);
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(wave2);
      window.clearTimeout(wave3);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [playToken]);

  if (playToken <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
      aria-hidden
    />
  );
}
