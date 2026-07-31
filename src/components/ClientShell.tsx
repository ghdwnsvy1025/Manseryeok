"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import {
  isEntryUnlocked,
  isShellChromeHidden,
  ENTRY_CHANGED_EVENT,
} from "@/lib/auth/entryGate";
import { isAnonymousUser } from "@/lib/auth/anonymousSession";
import { isGuestMode } from "@/lib/auth/guestMode";

const CONTENT_CLASS =
  "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full";

function computeUnlocked(): boolean {
  return isEntryUnlocked() || isGuestMode();
}

function computeShowChrome(): boolean {
  return computeUnlocked() && !isShellChromeHidden();
}

/**
 * 하이드레이션 충돌 방지용 셸.
 * 로그인 전엔 헤더·하단 네비 없이 로그인/온보딩만 표시.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showChrome, setShowChrome] = useState(false);

  useEffect(() => {
    setMounted(true);

    const refreshUnlock = () => {
      setUnlocked(computeUnlocked());
      setShowChrome(computeShowChrome());
    };
    refreshUnlock();

    const supabase = getSupabaseBrowserClient();
    let lastApplied: string | null | undefined = undefined;

    const applyUser = (userId: string | null) => {
      if (lastApplied === userId) return;
      lastApplied = userId;
      reconcileLocalStateWithAuthUser(userId);
      resetDiaryStorageCache();
      resetJournalStorageCache();
      refreshUnlock();
    };

    if (!supabase) {
      applyUser(null);
      return;
    }

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        const user = data.session?.user;
        if (user && !isAnonymousUser(user)) {
          setUnlocked(true);
          setShowChrome(!isShellChromeHidden());
        } else {
          refreshUnlock();
        }
        applyUser(user?.id ?? null);
      })
      .catch(() => {
        applyUser(null);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user && !isAnonymousUser(user)) {
        setUnlocked(true);
        setShowChrome(!isShellChromeHidden());
      } else refreshUnlock();
      applyUser(user?.id ?? null);
    });

    const onStorage = () => refreshUnlock();
    window.addEventListener("storage", onStorage);
    window.addEventListener(ENTRY_CHANGED_EVENT, onStorage);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ENTRY_CHANGED_EVENT, onStorage);
    };
  }, []);

  // 잠긴 상태에서 홈이 아닌 경로 → 홈(로그인)으로
  useEffect(() => {
    if (!mounted) return;
    if (unlocked) return;
    if (pathname === "/") return;
    if (pathname.startsWith("/auth/")) return;
    router.replace("/");
  }, [mounted, unlocked, pathname, router]);

  const showChromeUi = mounted && showChrome;
  const onHomeLogin = pathname === "/" && !unlocked;

  if (!mounted) {
    return (
      <ViewModeProvider>
        <div className="app-phone-preview" suppressHydrationWarning>
          <div className="app-mobile-device" suppressHydrationWarning>
            <div
              className="flex flex-col min-h-0 h-full flex-1"
              suppressHydrationWarning
            >
              <div
                className={CONTENT_CLASS}
                data-view-mode="mobile"
                data-compact="true"
              >
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
            {showChromeUi && <ProfileHeader />}
            <main
              className={CONTENT_CLASS}
              data-view-mode="mobile"
              data-compact="true"
            >
              {children}
            </main>
            {showChromeUi && (
              <div className="w-full shrink-0">
                <AppNav />
              </div>
            )}
            <ProgressCelebrationHost />
            <ClickBurstHost />
            {showChromeUi && !onHomeLogin && <FirstVisitWelcome />}
            {showChromeUi && <BetaFeedbackHost />}
          </div>
        </div>
      </div>
    </ViewModeProvider>
  );
}
