"use client";

/**
 * 벚꽃잎 레이어 (2026-09-15 사장님 선택: C + B)
 *
 *   ambient — 평소 홈. 6장이 아주 옅게(투명도 0.16~0.24), 아주 천천히(16~22초) 떨어진다.
 *             있는 줄도 모를 정도가 목표다. 이 앱은 밤에 글을 읽는 앱이라
 *             꽃잎이 글을 이기면 안 된다.
 *   burst   — 오늘 첫 기록을 저장한 직후. 20장이 3초 동안 흩날리고 끝난다.
 *             드물게 오니까 더 예쁘다. 기록을 고쳐서 다시 저장할 때는 안 뿌린다.
 *
 * 지키는 것
 * - JavaScript 로 움직이지 않는다. CSS transform 만 써서 GPU 가 처리한다.
 * - 폰에서 "동작 줄이기"를 켠 사람에게는 아예 안 보인다 (globals.css).
 * - 감성 톤 플래그가 꺼져 있으면 그리지 않는다 — 복고풍 화면은 그대로 둔다.
 * - 위치는 고정 표를 쓴다. Math.random 을 쓰면 서버/브라우저 첫 화면이 달라져
 *   하이드레이션 경고가 난다.
 */
import { useEffect, useState } from "react";
import { isSoftThemeEnabled } from "@/lib/app/featureFlags";

type Petal = {
  /** 가로 위치 % */
  left: number;
  /** 크기 px */
  size: number;
  /** 떨어지는 시간 s */
  fall: number;
  /** 흔들리는 시간 s */
  sway: number;
  /** 시작 지연 s (음수면 이미 떨어지는 중에서 시작) */
  delay: number;
  opacity: number;
  /** 두 가지 분홍 중 하나 */
  tone: 0 | 1;
};

const AMBIENT: Petal[] = [
  { left: 8, size: 8, fall: 16, sway: 4.2, delay: -3, opacity: 0.18, tone: 0 },
  {
    left: 24,
    size: 7,
    fall: 20,
    sway: 5.1,
    delay: -11,
    opacity: 0.22,
    tone: 1,
  },
  { left: 41, size: 9, fall: 18, sway: 4.6, delay: -6, opacity: 0.16, tone: 0 },
  { left: 58, size: 7, fall: 22, sway: 5.6, delay: -15, opacity: 0.2, tone: 1 },
  { left: 74, size: 8, fall: 17, sway: 4.8, delay: -1, opacity: 0.24, tone: 0 },
  { left: 90, size: 7, fall: 19, sway: 5.3, delay: -9, opacity: 0.18, tone: 1 },
];

const BURST: Petal[] = [
  {
    left: 4,
    size: 10,
    fall: 2.8,
    sway: 1.4,
    delay: 0.05,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 11,
    size: 8,
    fall: 3.2,
    sway: 1.7,
    delay: 0.3,
    opacity: 0.8,
    tone: 1,
  },
  {
    left: 17,
    size: 11,
    fall: 2.6,
    sway: 1.2,
    delay: 0.15,
    opacity: 0.95,
    tone: 0,
  },
  {
    left: 23,
    size: 9,
    fall: 3.0,
    sway: 1.6,
    delay: 0.5,
    opacity: 0.85,
    tone: 1,
  },
  {
    left: 29,
    size: 12,
    fall: 3.4,
    sway: 1.8,
    delay: 0.1,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 34,
    size: 8,
    fall: 2.7,
    sway: 1.3,
    delay: 0.45,
    opacity: 0.8,
    tone: 1,
  },
  {
    left: 40,
    size: 10,
    fall: 3.1,
    sway: 1.5,
    delay: 0.25,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 46,
    size: 9,
    fall: 2.9,
    sway: 1.7,
    delay: 0.6,
    opacity: 0.85,
    tone: 1,
  },
  {
    left: 51,
    size: 11,
    fall: 3.3,
    sway: 1.4,
    delay: 0.0,
    opacity: 0.95,
    tone: 0,
  },
  {
    left: 56,
    size: 8,
    fall: 2.6,
    sway: 1.6,
    delay: 0.35,
    opacity: 0.8,
    tone: 1,
  },
  {
    left: 62,
    size: 10,
    fall: 3.0,
    sway: 1.3,
    delay: 0.2,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 67,
    size: 12,
    fall: 3.4,
    sway: 1.8,
    delay: 0.55,
    opacity: 0.85,
    tone: 1,
  },
  {
    left: 72,
    size: 9,
    fall: 2.8,
    sway: 1.5,
    delay: 0.1,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 77,
    size: 8,
    fall: 3.1,
    sway: 1.2,
    delay: 0.4,
    opacity: 0.8,
    tone: 1,
  },
  {
    left: 82,
    size: 11,
    fall: 2.7,
    sway: 1.7,
    delay: 0.2,
    opacity: 0.95,
    tone: 0,
  },
  {
    left: 87,
    size: 9,
    fall: 3.2,
    sway: 1.4,
    delay: 0.5,
    opacity: 0.85,
    tone: 1,
  },
  {
    left: 92,
    size: 10,
    fall: 2.9,
    sway: 1.6,
    delay: 0.05,
    opacity: 0.9,
    tone: 0,
  },
  {
    left: 97,
    size: 8,
    fall: 3.3,
    sway: 1.3,
    delay: 0.3,
    opacity: 0.8,
    tone: 1,
  },
  {
    left: 14,
    size: 9,
    fall: 3.0,
    sway: 1.5,
    delay: 0.65,
    opacity: 0.85,
    tone: 1,
  },
  {
    left: 60,
    size: 10,
    fall: 2.8,
    sway: 1.7,
    delay: 0.7,
    opacity: 0.9,
    tone: 0,
  },
];

/** 흩날림이 끝나고 레이어를 치우는 시각 (가장 늦은 꽃잎 0.7 + 3.4초보다 넉넉히) */
const BURST_LIFETIME_MS = 4400;

export default function PetalLayer({
  variant,
}: {
  variant: "ambient" | "burst";
}) {
  // 플래그는 빌드에 박히는 값이라 서버·브라우저가 같은 답을 낸다
  const on = isSoftThemeEnabled();
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    if (variant !== "burst") return;
    const t = window.setTimeout(() => setAlive(false), BURST_LIFETIME_MS);
    return () => window.clearTimeout(t);
  }, [variant]);

  if (!on || !alive) return null;

  const petals = variant === "burst" ? BURST : AMBIENT;

  return (
    <div
      className={`petal-layer petal-layer--${variant}`}
      aria-hidden
      data-petals={variant}
    >
      {petals.map((p, i) => (
        <span
          key={i}
          className="petal-col"
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.fall}s`,
            animationDelay: `${p.delay}s`,
          }}
        >
          <span
            className={`petal petal--${p.tone}`}
            style={{
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDuration: `${p.sway}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        </span>
      ))}
    </div>
  );
}
