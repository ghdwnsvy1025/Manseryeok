"use client";

import { useEffect, useRef } from "react";

/**
 * 화면에 들어온 뒤에 `.is-play`를 붙여 한 번만 등장 애니메이션 재생.
 * (오버레이·접힌 영역 뒤에서 미리 끝나지 않게)
 */
export function usePlayWhenVisible<T extends HTMLElement>(
  enabled = true,
  selector = ".js-play-when-visible",
  /** 탭 전환 등으로 DOM이 바뀌면 다시 관찰 */
  resetKey?: string | number
) {
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll(selector));
    if (nodes.length === 0) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      nodes.forEach((n) => n.classList.add("is-play"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-play");
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );

    nodes.forEach((n) => {
      n.classList.remove("is-play");
      io.observe(n);
    });
    return () => io.disconnect();
  }, [enabled, selector, resetKey]);

  return rootRef;
}
