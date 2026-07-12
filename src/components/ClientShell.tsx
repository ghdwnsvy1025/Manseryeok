"use client";

import Link from "next/link";
import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import ViewModeToggle from "@/components/ViewModeToggle";
import AppNav from "@/components/AppNav";

function ShellContent({ children }: { children: React.ReactNode }) {
  const { isMobile, isCompactViewport, showPhoneFrame } = useViewMode();

  const widthClass = showPhoneFrame
    ? "w-full"
    : isMobile
      ? "w-full max-w-none"
      : "w-full max-w-[1400px] mx-auto";

  const mainPadding = isCompactViewport
    ? "px-2 py-2"
    : isMobile
      ? "px-3 py-3"
      : "px-4 sm:py-8";

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b-2 shrink-0"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "0 4px 0 #000",
        }}
      >
        <div className={`${widthClass} w-full`}>
          <div className={`flex items-center gap-2 ${isCompactViewport ? "px-2 py-1.5" : "px-3 py-2"}`}>
            <Link
              href="/diary"
              className="w-9 h-9 flex items-center justify-center border-2 text-xl font-black select-none shrink-0 pixel-font"
              style={{
                background: "var(--px-bg3)",
                borderColor: "var(--px-accent)",
                color: "var(--px-accent)",
                boxShadow: "3px 3px 0 #4a3a00",
                fontSize: isMobile ? "11px" : "14px",
              }}
            >
              命
            </Link>
            <div className="min-w-0 flex-1">
              <h1
                className="font-black leading-tight tracking-wide truncate"
                style={{ color: "var(--px-accent)", fontSize: isMobile ? "14px" : "16px" }}
              >
                사주 만세력
              </h1>
              <p className="text-[10px] leading-tight truncate" style={{ color: "var(--px-text2)" }}>
                감정 일기 × 간지 · 내 사주 · AI
              </p>
            </div>

            {!isCompactViewport && <ViewModeToggle />}

            {!isMobile && (
              <div className="hidden md:flex gap-1 shrink-0">
                {["木", "火", "土", "金", "水"].map((ch, i) => {
                  const colors = ["#4ade80", "#f87171", "#fbbf24", "#cbd5e1", "#60a5fa"];
                  return (
                    <span
                      key={ch}
                      className="text-xs font-bold w-6 h-6 flex items-center justify-center border"
                      style={{
                        color: colors[i],
                        borderColor: colors[i] + "55",
                        background: colors[i] + "11",
                      }}
                    >
                      {ch}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <AppNav />
        </div>
      </header>

      <main
        className={`flex-1 min-w-0 overflow-x-hidden ${mainPadding} ${widthClass}`}
        data-view-mode={isMobile ? "mobile" : "desktop"}
        data-compact={isCompactViewport ? "true" : undefined}
      >
        {children}
      </main>

      <footer
        className={`mt-auto border-t-2 shrink-0 ${isCompactViewport ? "hidden" : ""}`}
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <div
          className={`px-3 py-3 text-center text-[10px] space-y-1 ${widthClass}`}
          style={{ color: "var(--px-text2)" }}
        >
          <p>절기 시각: Jean Meeus 「Astronomical Algorithms」 기반 천문 계산 (±15~45분)</p>
          {!isMobile && (
            <p>경계 근처 출생 시 한국천문연구원(KASI) 공식 데이터와 교차 검증을 권장합니다.</p>
          )}
        </div>
      </footer>
    </>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { showPhoneFrame, isCompactViewport } = useViewMode();

  if (showPhoneFrame) {
    return (
      <div className="app-phone-preview">
        <div className="app-mobile-device">
          <div className="app-mobile-device-scroll app-hide-scrollbar flex flex-col min-h-full">
            <ShellContent>{children}</ShellContent>
          </div>
        </div>
      </div>
    );
  }

  if (isCompactViewport) {
    return (
      <div className="app-compact-root app-hide-scrollbar flex flex-col min-h-dvh w-full max-w-[100vw] overflow-x-hidden">
        <ShellContent>{children}</ShellContent>
      </div>
    );
  }

  return <ShellContent>{children}</ShellContent>;
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeProvider>
      <ShellInner>{children}</ShellInner>
    </ViewModeProvider>
  );
}
