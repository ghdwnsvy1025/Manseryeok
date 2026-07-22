"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

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

function subscribeCompact(cb: () => void) {
  const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getCompactSnapshot() {
  return window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT}px)`).matches;
}

/** SSR·첫 페인트는 데스크톱 가정 → 폰 프레임과 맞춤 (넓은 화면 깜빡임 방지) */
function getCompactServerSnapshot() {
  return false;
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const isCompactViewport = useSyncExternalStore(
    subscribeCompact,
    getCompactSnapshot,
    getCompactServerSnapshot
  );

  useEffect(() => {
    // 앱은 모바일 전용 — PC/모바일 전환값 무시하고 모바일로 고정
    localStorage.setItem("saju-view-mode", "mobile");
  }, []);

  const setViewMode = (_mode: ViewMode) => {
    // 모바일 고정 — desktop 전환 비활성
  };

  const showPhoneFrame = !isCompactViewport;

  const value: ViewModeContextValue = {
    viewMode: "mobile",
    setViewMode,
    isMobile: true,
    isCompactViewport,
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
