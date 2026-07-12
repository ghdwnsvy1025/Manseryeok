"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "desktop" | "mobile";

const COMPACT_BREAKPOINT = 640;

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  /** 모바일 레이아웃·타이포 적용 여부 */
  isMobile: boolean;
  /** 실제 좁은 화면(폰) — 프레임 없이 전체 너비 */
  isCompactViewport: boolean;
  /** 데스크톱에서 390×844 폰 미리보기 프레임 */
  showPhoneFrame: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = "saju-view-mode";

function readCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`).matches;
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("mobile");
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "mobile" || saved === "desktop") {
      setViewModeState(saved);
    }
    setIsCompactViewport(readCompactViewport());
    setReady(true);

    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
    const onChange = () => setIsCompactViewport(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  const isMobile = isCompactViewport || viewMode === "mobile";
  const showPhoneFrame = ready && !isCompactViewport && viewMode === "mobile";

  const value: ViewModeContextValue = {
    viewMode: ready ? viewMode : "mobile",
    setViewMode,
    isMobile: ready ? isMobile : true,
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
