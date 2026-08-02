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
   * continuous면 무시하고 계속 흘린다.
   */
  playToken?: number;
  /** true면 화면에서 계속 흩날림 (로그인 등) */
  continuous?: boolean;
  /** fixed overlay z-index */
  zIndex?: number;
};

/**
 * 벚꽃잎 흩날림 — 결과 공개(단발) / 로그인 배경(연속) 공용.
 */
export default function CherryBlossomLayer({
  playToken = 0,
  continuous = false,
  zIndex = 120,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = continuous || playToken > 0;

  useEffect(() => {
    if (!active) return;
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
    const spawn = (
      n: number,
      opts?: { nearCenter?: boolean; fromTop?: boolean }
    ) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isNarrow = W < 480;
      const nearCenter = opts?.nearCenter ?? false;
      const fromTop = opts?.fromTop ?? continuous;
      for (let i = 0; i < n; i++) {
        const y = fromTop
          ? -12 - Math.random() * 40
          : nearCenter
            ? H * (0.18 + Math.random() * 0.28)
            : H * (0.08 + Math.random() * 0.22);
        petals.push({
          x: W * (0.04 + Math.random() * 0.92),
          y,
          vx: (Math.random() - 0.5) * (continuous ? 36 : isNarrow ? 48 : 72),
          vy: continuous
            ? 12 + Math.random() * 28
            : 8 + Math.random() * (isNarrow ? 36 : 52),
          size: (isNarrow ? 5 : 6.5) + Math.random() * (isNarrow ? 4 : 5.5),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * (continuous ? 2.4 : 3.2),
          sway: Math.random() * Math.PI * 2,
          swayAmp: continuous ? 14 + Math.random() * 22 : 18 + Math.random() * 28,
          swaySpeed: continuous ? 1.4 + Math.random() * 1.6 : 1.8 + Math.random() * 2.0,
          color:
            PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]!,
          life: 0,
          maxLife: continuous
            ? 6 + Math.random() * 5
            : 3.2 + Math.random() * 2.2,
        });
      }
    };

    const narrow = window.innerWidth < 480;
    let spawnTimer: number | undefined;
    let wave2: number | undefined;
    let wave3: number | undefined;

    if (continuous) {
      spawn(narrow ? 10 : 14, { fromTop: true });
      spawnTimer = window.setInterval(() => {
        if (!running) return;
        // 화면 밖·죽은 잎 정리 후 소량 보충
        for (let i = petals.length - 1; i >= 0; i--) {
          const p = petals[i]!;
          if (p.life >= p.maxLife || p.y > window.innerHeight + 40) {
            petals.splice(i, 1);
          }
        }
        if (petals.length < (narrow ? 16 : 22)) {
          spawn(narrow ? 2 : 3, { fromTop: true });
        }
      }, 900);
    } else {
      spawn(narrow ? 18 : 26, { nearCenter: true });
      wave2 = window.setTimeout(
        () => spawn(narrow ? 8 : 12, { nearCenter: false }),
        280
      );
      wave3 = window.setTimeout(
        () => spawn(narrow ? 5 : 8, { nearCenter: true }),
        700
      );
    }

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
        p.vy += (continuous ? 8 : 14) * dt;
        p.vy = Math.min(p.vy, continuous ? 72 : 110);
        p.vx *= 1 - 0.22 * dt;
        const swayX = Math.sin(p.sway) * p.swayAmp * dt;
        p.x += p.vx * dt + swayX;
        p.y += p.vy * dt;

        const t = p.life / p.maxLife;
        const fade = continuous
          ? t < 0.08
            ? t / 0.08
            : t > 0.85
              ? Math.max(0, (1 - t) / 0.15)
              : 1
          : t < 0.05
            ? t / 0.05
            : Math.max(0, 1 - (t - 0.45) / 0.55);
        const alpha = fade * (continuous ? 0.72 : 0.82);
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
      if (spawnTimer != null) window.clearInterval(spawnTimer);
      if (wave2 != null) window.clearTimeout(wave2);
      if (wave3 != null) window.clearTimeout(wave3);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [active, continuous, playToken]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0"
      style={{ zIndex }}
      aria-hidden
    />
  );
}
