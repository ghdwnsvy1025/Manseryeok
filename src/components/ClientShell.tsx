"use client";

import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";

function ShellContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <main
        className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full"
        data-view-mode="mobile"
        data-compact="true"
      >
        {children}
      </main>

      <div className="w-full shrink-0">
        <AppNav />
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { showPhoneFrame } = useViewMode();

  // PC에서는 390 기준 폰 프레임으로 고정 — 모바일 해상도와 동일하게 맞춤
  if (showPhoneFrame) {
    return (
      <div className="app-phone-preview">
        <div className="app-mobile-device">
          <div className="flex flex-col min-h-0 h-full">
            <ShellContent>{children}</ShellContent>
          </div>
        </div>
      </div>
    );
  }

  // 실제 모바일 기기: 전체 화면, 동일한 패딩·레이아웃
  return (
    <div className="app-compact-root app-hide-scrollbar flex flex-col min-h-dvh h-dvh w-full max-w-[100vw] overflow-x-hidden">
      <ShellContent>{children}</ShellContent>
    </div>
  );
}

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ViewModeProvider>
      <ShellInner>{children}</ShellInner>
    </ViewModeProvider>
  );
}
