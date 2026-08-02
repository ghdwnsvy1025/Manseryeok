"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  hasSeenFirstVisitWelcome,
  isFirstVisitWelcomePath,
  WELCOME_OVERLAY_EVENT,
  type WelcomeOverlayPhase,
} from "@/lib/app/firstVisitWelcome";

/**
 * 환영 오버레이가 닫힌 뒤에야 true.
 * 홈 등장 연출이 창 뒤에서 끝나지 않도록 게이트로 씀.
 */
export function useHomeMotionReady(): boolean {
  const pathname = usePathname();
  const [ready, setReady] = useState(() => {
    if (typeof window === "undefined") return false;
    if (!isFirstVisitWelcomePath(pathname)) return true;
    return hasSeenFirstVisitWelcome();
  });

  useEffect(() => {
    if (!isFirstVisitWelcomePath(pathname)) {
      setReady(true);
      return;
    }
    if (hasSeenFirstVisitWelcome()) {
      setReady(true);
      return;
    }

    setReady(false);
    const onOverlay = (e: Event) => {
      const phase = (e as CustomEvent<{ phase: WelcomeOverlayPhase }>).detail
        ?.phase;
      if (phase === "closed" || phase === "idle") setReady(true);
      if (phase === "pending" || phase === "open") setReady(false);
    };
    window.addEventListener(WELCOME_OVERLAY_EVENT, onOverlay);
    // 환영 컴포넌트가 안 뜨는 예외 대비
    const safety = window.setTimeout(() => setReady(true), 6000);
    return () => {
      window.removeEventListener(WELCOME_OVERLAY_EVENT, onOverlay);
      window.clearTimeout(safety);
    };
  }, [pathname]);

  return ready;
}
