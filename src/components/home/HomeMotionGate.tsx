"use client";

import type { ReactNode } from "react";
import { useHomeMotionReady } from "@/hooks/useHomeMotionReady";

/**
 * 환영 창이 닫힌 뒤 홈을 마운트해 등장 연출이 창 뒤에서 낭비되지 않게 함.
 */
export default function HomeMotionGate({ children }: { children: ReactNode }) {
  const ready = useHomeMotionReady();

  if (!ready) {
    return (
      <div
        className="min-h-[40vh]"
        aria-hidden
        style={{ visibility: "hidden" }}
      />
    );
  }

  return <div key="home-motion-ready">{children}</div>;
}
