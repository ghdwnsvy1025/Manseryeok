"use client";

import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import ViewModeToggle from "@/components/ViewModeToggle";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { isMobile } = useViewMode();

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "0 4px 0 #000",
        }}
      >
        <div
          className={`mx-auto px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 ${
            isMobile ? "max-w-[480px]" : "max-w-[1400px]"
          }`}
        >
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center border-2 text-xl font-black select-none shrink-0"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-accent)",
              color: "var(--px-accent)",
              boxShadow: "3px 3px 0 #4a3a00",
              fontFamily: "'Press Start 2P', monospace",
              fontSize: isMobile ? "11px" : "14px",
            }}
          >
            命
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="font-black leading-tight tracking-wide truncate"
              style={{ color: "var(--px-accent)", fontSize: isMobile ? "14px" : "16px" }}
            >
              사주 만세력
            </h1>
            <p className="text-[10px] sm:text-xs leading-tight truncate" style={{ color: "var(--px-text2)" }}>
              절기 기준 사주팔자 계산기 v1.0
            </p>
          </div>

          <ViewModeToggle />

          <a
            href="/admin"
            className="text-[10px] sm:text-xs font-bold px-2 py-1 border shrink-0"
            style={{
              color: "var(--px-text2)",
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
            }}
          >
            ⚙ 관리자
          </a>

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
      </header>

      <main
        className={`mx-auto py-4 sm:py-8 ${isMobile ? "max-w-[480px] px-3" : "max-w-[1400px] px-4"}`}
        data-view-mode={isMobile ? "mobile" : "desktop"}
      >
        {children}
      </main>

      <footer
        className="mt-8 sm:mt-12 border-t-2"
        style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
      >
        <div
          className={`mx-auto px-3 py-3 sm:px-4 sm:py-5 text-center text-[10px] sm:text-xs space-y-1 ${
            isMobile ? "max-w-[480px]" : "max-w-[1400px]"
          }`}
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

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeProvider>
      <ShellInner>{children}</ShellInner>
    </ViewModeProvider>
  );
}
