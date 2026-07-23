"use client";

import { useEffect, useState } from "react";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";
import ProfileHeader from "@/components/ProfileHeader";

const CONTENT_CLASS =
  "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full";

/**
 * 하이드레이션 충돌 방지:
 * - 서버/첫 페인트: 콘텐츠만 (헤더·네비 없음)
 * - 마운트 후: 헤더 + main + 하단 네비
 * 이렇게 하면 <main> 위치 불일치·구 번들 ShellContent 잔여와 충돌하지 않는다.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <ViewModeProvider>
      <div className="app-phone-preview" suppressHydrationWarning>
        <div className="app-mobile-device" suppressHydrationWarning>
          {!ready ? (
            <div
              className="flex flex-col min-h-0 h-full flex-1"
              suppressHydrationWarning
            >
              <div className={CONTENT_CLASS} data-view-mode="mobile" data-compact="true">
                {children}
              </div>
            </div>
          ) : (
            <div className="flex flex-col min-h-0 h-full flex-1">
              <ProfileHeader />
              <main
                className={CONTENT_CLASS}
                data-view-mode="mobile"
                data-compact="true"
              >
                {children}
              </main>
              <div className="w-full shrink-0">
                <AppNav />
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewModeProvider>
  );
}
