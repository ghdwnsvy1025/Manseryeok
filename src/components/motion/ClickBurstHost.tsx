"use client";

/**
 * Canvas + rAF burst engine with object pooling.
 * DOM을 매 클릭마다 만들지 않아 반복 클릭에도 안정적.
 */

import { useEffect, useRef } from "react";
import {
  BURST_CONFIG,
  BURST_PALETTE,
  CLICK_BURST_EVENT,
  randBetween,
  randInt,
  type ClickBurstDetail,
  type ClickBurstVariant,
} from "@/lib/ui/clickBurst";

type Kind = "dot" | "heart";

type Particle = {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  kind: Kind;
};

function colorsFor(detail: ClickBurstDetail): string[] {
  if (detail.variant === "heart") {
    const v = detail.value ?? 5;
    if (v <= 3) return [...BURST_PALETTE.heartLow];
    if (v <= 6) return [...BURST_PALETTE.heartMid];
    return [...BURST_PALETTE.heartHigh];
  }
  if (detail.variant === "mood") {
    const c =
      (detail.label && BURST_PALETTE.mood[detail.label]) ||
      BURST_PALETTE.accentFallback;
    return [c, softMix(c, "#c8c8c8", 0.35), softMix(c, "#ffffff", 0.25)];
  }
  if (detail.variant === "xp") {
    return [...BURST_PALETTE.xp];
  }
  return [...BURST_PALETTE.ordinal];
}

function softMix(hex: string, other: string, t: number): string {
  const a = parseHex(hex);
  const b = parseHex(other);
  if (!a || !b) return hex;
  const m = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

function parseHex(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function countFor(variant: ClickBurstVariant, value?: number): number {
  const range = BURST_CONFIG.count[variant];
  let n = randInt(range.min, range.max);
  if (variant === "heart" && value != null) {
    if (value >= 8) n = Math.min(20, n + 2);
    if (value <= 2) n = Math.max(range.min, n - 2);
  }
  return n;
}

function createPool(size: number): Particle[] {
  return Array.from({ length: size }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spin: 0,
    angle: 0,
    size: 4,
    life: 0,
    maxLife: 1,
    color: "#aaa",
    kind: "dot" as Kind,
  }));
}

function spawnBurst(pool: Particle[], detail: ClickBurstDetail): void {
  const colors = colorsFor(detail);
  const n = countFor(detail.variant, detail.value);
  let spawned = 0;

  for (const p of pool) {
    if (spawned >= n) break;
    if (p.active) continue;

    const angle =
      (Math.PI * 2 * spawned) / n + randBetween(-0.28, 0.28);
    const speed = randBetween(BURST_CONFIG.speed.min, BURST_CONFIG.speed.max);
    const lifeMs = randBetween(
      BURST_CONFIG.lifeMs.min,
      BURST_CONFIG.lifeMs.max
    );
    const isHeart =
      detail.variant === "heart" && Math.random() < BURST_CONFIG.heartRatio;
    const base = randBetween(BURST_CONFIG.size.min, BURST_CONFIG.size.max);

    p.active = true;
    p.x = detail.x;
    p.y = detail.y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed - randBetween(20, 55);
    p.spin = randBetween(BURST_CONFIG.spin.min, BURST_CONFIG.spin.max);
    p.angle = randBetween(0, Math.PI * 2);
    p.size = isHeart ? base * BURST_CONFIG.heartSizeBoost : base;
    p.life = lifeMs / 1000;
    p.maxLife = p.life;
    p.color = colors[spawned % colors.length]!;
    p.kind = isHeart ? "heart" : "dot";
    spawned += 1;
  }
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  alpha: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${size * 1.6}px system-ui, Segoe UI Emoji, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("♥", 0, 0);
  ctx.restore();
}

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  color: string
) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function ClickBurstHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<Particle[] | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastTsRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    poolRef.current = createPool(BURST_CONFIG.poolSize);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

    const stopIfIdle = (pool: Particle[]) => {
      if (pool.some((p) => p.active)) return;
      runningRef.current = false;
      lastTsRef.current = 0;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const tick = (ts: number) => {
      const pool = poolRef.current;
      if (!pool) return;

      const last = lastTsRef.current || ts;
      let dt = (ts - last) / 1000;
      lastTsRef.current = ts;
      // 탭 백그라운드 복귀 시 큰 점프 방지
      if (dt > 0.05) dt = 0.05;

      const { drag, gravity, scale } = BURST_CONFIG;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of pool) {
        if (!p.active) continue;

        // drag (exponential damping) + gravity
        const damp = Math.exp(-drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        p.life -= dt;

        if (p.life <= 0) {
          p.active = false;
          continue;
        }

        const t = Math.max(0, p.life / p.maxLife);
        // ease: linger then fade
        const fade = t * t;
        const s = scale.end + (scale.start - scale.end) * t;
        const drawSize = p.size * s;
        const alpha = Math.min(1, fade * 1.15);

        if (p.kind === "heart") {
          drawHeart(ctx, p.x, p.y, drawSize, p.angle * 0.35, alpha, p.color);
        } else {
          drawDot(ctx, p.x, p.y, drawSize, alpha, p.color);
        }
      }

      if (pool.some((p) => p.active)) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        stopIfIdle(pool);
      }
    };

    const ensureLoop = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      lastTsRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    };

    const onBurst = (ev: Event) => {
      const detail = (ev as CustomEvent<ClickBurstDetail>).detail;
      const pool = poolRef.current;
      if (!detail || !pool) return;
      spawnBurst(pool, detail);
      ensureLoop();
    };

    window.addEventListener(CLICK_BURST_EVENT, onBurst);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener(CLICK_BURST_EVENT, onBurst);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      runningRef.current = false;
      poolRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="click-burst-layer"
      aria-hidden
    />
  );
}
