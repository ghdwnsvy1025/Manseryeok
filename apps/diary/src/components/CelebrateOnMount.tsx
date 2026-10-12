"use client";

import { useEffect, useRef } from "react";
import { celebrate } from "@/lib/fx";

/**
 * 화면에 나타날 때 한 번 금빛 가루 (v3.20 Q2 = A). 같은 열쇠(key)는 한 세션에 한 번만.
 * 쓰는 곳: 오늘의 기록 카드 — 저장 직후 카드 첫 만남, 연속 7·30·100일.
 */
export function CelebrateOnMount({ id, delay = 450 }: { id: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    try {
      const k = `saju-fx:${id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      /* 저장소를 못 쓰면 한 번 그냥 터뜨린다 */
    }
    const t = window.setTimeout(() => celebrate(ref.current?.parentElement ?? null), delay);
    return () => window.clearTimeout(t);
  }, [id, delay]);
  return <span ref={ref} hidden />;
}
