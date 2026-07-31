"use client";

import { useEffect, useState } from "react";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";
import ProfileHeader from "@/components/ProfileHeader";
import ProgressCelebrationHost from "@/components/motion/ProgressCelebrationHost";
import ClickBurstHost from "@/components/motion/ClickBurstHost";
import PostHogInit from "@/components/analytics/PostHogInit";
import FirstVisitWelcome from "@/components/onboarding/FirstVisitWelcome";
import BetaFeedbackHost from "@/components/feedback/BetaFeedbackHost";
import { reconcileLocalStateWithAuthUser } from "@/lib/diary/profileStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";

const CONTENT_CLASS =
  "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full";

/**
 * 하이드레이션 충돌 방지용 셸.
 * auth reconcile은 백그라운드에서만 하고, 화면은 절대 잠그지 않는다.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const supabase = getSupabaseBrowserClient();
    let lastApplied: string | null | undefined = undefined;

    const applyUser = (userId: string | null) => {
      if (lastApplied === userId) return;
      lastApplied = userId;
      reconcileLocalStateWithAuthUser(userId);
      resetDiaryStorageCache();
      resetJournalStorageCache();
    };

    if (!supabase) {
      applyUser(null);
      return;
    }

    void supabase.auth.getSession().then(({ data }) => {
      applyUser(data.session?.user?.id ?? null);
    }).catch(() => {
      applyUser(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 서버/첫 페인트: 콘텐츠만 — 마운트 후 헤더·네비
  if (!mounted) {
    return (
      <ViewModeProvider>
        <div className="app-phone-preview" suppressHydrationWarning>
          <div className="app-mobile-device" suppressHydrationWarning>
            <div
              className="flex flex-col min-h-0 h-full flex-1"
              suppressHydrationWarning
            >
              <div className={CONTENT_CLASS} data-view-mode="mobile" data-compact="true">
                {children}
              </div>
            </div>
          </div>
        </div>
      </ViewModeProvider>
    );
  }

  return (
    <ViewModeProvider>
      <div className="app-phone-preview" suppressHydrationWarning>
        <div className="app-mobile-device" suppressHydrationWarning>
          <div className="flex flex-col min-h-0 h-full flex-1">
            <PostHogInit />
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
            <ProgressCelebrationHost />
            <ClickBurstHost />
            <FirstVisitWelcome />
            <BetaFeedbackHost />
          </div>
        </div>
      </div>
    </ViewModeProvider>
  );
}
