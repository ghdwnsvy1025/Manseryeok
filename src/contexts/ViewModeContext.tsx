"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ViewMode = "desktop" | "mobile";

type ViewModeContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isMobile: boolean;
};

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = "saju-view-mode";

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("desktop");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "mobile" || saved === "desktop") {
      setViewModeState(saved);
    }
    setReady(true);
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  if (!ready) {
    return (
      <ViewModeContext.Provider value={{ viewMode: "desktop", setViewMode, isMobile: false }}>
        {children}
      </ViewModeContext.Provider>
    );
  }

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, isMobile: viewMode === "mobile" }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
