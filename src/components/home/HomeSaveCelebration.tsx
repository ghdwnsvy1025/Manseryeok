"use client";

/**
 * 홈 도착 축하 — 상단에서 떨어지는 파티클 + 짧은 헤드라인.
 * prefers-reduced-motion 이면 문구만 보여 준다.
 */

import { useEffect, useRef, useState } from "react";
import {
  celebrateHeadline,
  celebrateSubline,
  clearHomeCelebrate,
  peekHomeCelebrate,
  type HomeCelebratePayload,
} from "@/lib/ui/homeCelebrate";
import { prefersReducedMotion } from "@/lib/ui/clickBurst";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  color: string;
  life: number;
  maxLife: number;
};

const COLORS = [
  "#c8a700",
  "#f5d76e",
  "#a3e635",
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#fb923c",
  "#e8e8f0",
];

const SHOW_MS = 3200;

export default function HomeSaveCelebration() {
  const [payload, setPayload] = useState<HomeCelebratePayload | null>(null);
  const [visible, setVisible] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const p = peekHomeCelebrate();
    if (!p) return;
    setPayload(p);
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      clearHomeCelebrate();
    }, SHOW_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible || !payload) return;
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

    const w0 = () => window.innerWidth;
    const particles: Particle[] = [];
    const spawn = (n: number) => {
      for (let i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * w0(),
          y: -12 - Math.random() * 40,
          vx: (Math.random() - 0.5) * 120,
          vy: 80 + Math.random() * 220,
          w: 4 + Math.random() * 7,
          h: 6 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
          life: 0,
          maxLife: 1.8 + Math.random() * 1.4,
        });
      }
    };

    spawn(72);
    const burst2 = window.setTimeout(() => spawn(36), 280);
    const burst3 = window.setTimeout(() => spawn(24), 620);

    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        if (p.life >= p.maxLife) continue;
        p.life += dt;
        p.vy += 420 * dt;
        p.vx *= 1 - 0.35 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        const t = p.life / p.maxLife;
        const alpha = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.85);
        if (alpha <= 0.02) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(burst2);
      window.clearTimeout(burst3);
      window.removeEventListener("resize", resize);
    };
  }, [visible, payload]);

  if (!visible || !payload) return null;

  const headline = celebrateHeadline(payload);
  const sub = celebrateSubline(payload);

  return (
    <div
      className="fixed inset-0 z-[90] pointer-events-none flex items-start justify-center pt-[18vh] px-4"
      aria-live="polite"
      role="status"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden
      />
      <div
        className="home-celebrate-banner relative max-w-sm w-full border-2 px-4 py-3 text-center space-y-1"
        style={{
          borderColor: "var(--px-accent)",
          background: "color-mix(in srgb, var(--px-bg2) 92%, #000)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          {headline}
        </p>
        {sub ? (
          <p
            className="text-sm font-bold"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}
