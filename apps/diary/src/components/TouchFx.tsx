"use client";

import { useEffect } from "react";
import { buzz, inkAt } from "@/lib/fx";

/** 누를 수 있는 것들. 여기에 걸리면 누른 자리에 먹물 번짐 + 짧은 진동 */
const PRESSABLE = "button, a[href], label:has(> input), .tag, .cal__cell, .album-cell, .board-cell, summary, [role='button']";

/**
 * 기본 터치감 (v3.20 Q1 = A "인주 도장 꾹"). layout에 한 번 마운트. 문서 전체에서 pointerdown 하나만 듣는다.
 * 눌림(96% 축소)은 CSS :active(디자이너), 여기서는 번짐 레이어와 진동만. 비활성 요소는 건너뛴다.
 */
export function TouchFx() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const t = (e.target as Element | null)?.closest?.(PRESSABLE);
      if (!t || (t as HTMLButtonElement).disabled || t.getAttribute("aria-disabled") === "true") return;
      inkAt(e.clientX, e.clientY);
      if (e.pointerType === "touch") buzz(6);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);
  return null;
}
