"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "desktop" | "mobile";

const COMPACT_BREAKPOINT = 640;
/** 앱 UI 기준 폭 — 모바일 해상도 고정 */
export const APP_MOBILE_WIDTH = 390;

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** 항상 모바일 레이아웃 */
  isMobile: boolean;
  /** 실제 좁은 화면(폰) — 프레임 없이 전체 너비 */
  isCompactViewport: boolean;
  /** 데스크톱에서 390 폭 폰 프레임으로 고정 미리보기 */
  showPhoneFrame: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function readCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`).matches;
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 앱은 모바일 전용 — PC/모바일 전환값 무시하고 모바일로 고정
    localStorage.setItem("saju-view-mode", "mobile");
    setIsCompactViewport(readCompactViewport());
    setReady(true);

    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    const onChange = () => setIsCompactViewport(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setViewMode = (_mode: ViewMode) => {
    // 모바일 고정 — desktop 전환 비활성
  };

  const showPhoneFrame = ready && !isCompactViewport;

  const value: ViewModeContextValue = {
    viewMode: "mobile",
    setViewMode,
    isMobile: true,
    isCompactViewport: ready ? isCompactViewport : false,
    showPhoneFrame,
  };

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
