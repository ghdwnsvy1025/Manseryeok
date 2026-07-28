"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  /** 글자당 지연(ms) — 물결이 흐르는 속도 */
  stepMs?: number;
  /** 접근성 라벨 (기본은 children 그대로) */
  label?: string;
};

const ANIM_MS = 420;

/**
 * 기능 없는 텍스트를 눌렀을 때 글자가 물결처럼 흐르며 "반응했다"를 알린다.
 */
export default function WaveText({
  children,
  className,
  style,
  stepMs = 40,
  label,
}: Props) {
  const [runId, setRunId] = useState(0);
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  const chars = Array.from(children);

  const trigger = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setRunId((n) => n + 1);
    setActive(true);
    const total = ANIM_MS + chars.length * stepMs;
    timerRef.current = window.setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, total);
  }, [chars.length, stepMs]);

  return (
    <span
      role="presentation"
      onPointerDown={trigger}
      className={`wave-text${className ? ` ${className}` : ""}`}
      style={style}
      aria-label={label ?? children}
    >
      {chars.map((ch, i) => (
        <span
          key={`${runId}-${i}`}
          className={active ? "wave-text-char is-waving" : "wave-text-char"}
          style={active ? { animationDelay: `${i * stepMs}ms` } : undefined}
          aria-hidden
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}
