"use client";

import { ViewModeProvider, useViewMode } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";
import ProfileHeader from "@/components/ProfileHeader";

function ShellContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <ProfileHeader />
      <div
        className="flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full"
        data-view-mode="mobile"
        data-compact="true"
      >
        {children}
      </div>

      <div className="w-full shrink-0">
        <AppNav />
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { showPhoneFrame } = useViewMode();

  // 바깥 구조는 항상 동일하게 두고, 클래스로만 프레임을 토글한다.
  // (서버/클라이언트 첫 페인트 HTML이 갈라지면 hydration 오류가 난다.)
  return (
    <div
      className={
        showPhoneFrame
          ? "app-phone-preview"
          : "app-compact-root app-hide-scrollbar flex flex-col min-h-dvh h-dvh w-full max-w-[100vw] overflow-x-hidden"
      }
    >
      <div
        className={
          showPhoneFrame
            ? "app-mobile-device"
            : "flex flex-col flex-1 min-h-0 w-full"
        }
      >
        <div className="flex flex-col min-h-0 h-full flex-1">
          <ShellContent>{children}</ShellContent>
        </div>
      </div>
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
