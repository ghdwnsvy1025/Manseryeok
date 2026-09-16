"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";
import ProfileHeader from "@/components/ProfileHeader";
import ProgressCelebrationHost from "@/components/motion/ProgressCelebrationHost";
import ClickBurstHost from "@/components/motion/ClickBurstHost";
import PostHogInit from "@/components/analytics/PostHogInit";
import SoftThemeGate from "@/components/hypothesis/SoftThemeGate";
import FirstVisitWelcome from "@/components/onboarding/FirstVisitWelcome";
import BetaFeedbackHost from "@/components/feedback/BetaFeedbackHost";
import InstallGuideModal from "@/components/pwa/InstallGuideModal";
import SealedRouteNotice from "@/components/app/SealedRouteNotice";
import { findSealedRoute } from "@/lib/app/sealedRoutes";
import { isSealLegacyRoutesEnabled } from "@/lib/app/featureFlags";
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
import { ensureInstallPromptCapture } from "@/lib/pwa/installPromptStore";

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

  /**
   * 접힌 화면이면 페이지 대신 안내를 그린다.
   * 플래그는 빌드에 박히는 값이라 서버·브라우저가 같은 판단을 하고,
   * 그래서 하이드레이션이 어긋나지 않는다 — 두 갈래 모두에서 같이 쓴다.
   */
  const sealed = isSealLegacyRoutesEnabled() ? findSealedRoute(pathname) : null;
  const body = sealed ? <SealedRouteNotice route={sealed} /> : children;
  const [mounted, setMounted] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [showChrome, setShowChrome] = useState(false);

  useEffect(() => {
    setMounted(true);
    ensureInstallPromptCapture();

    const refreshUnlock = () => {
      setUnlocked(computeUnlocked());
      setShowChrome(computeShowChrome());
    };
    refreshUnlock();

    const supabase = getSupabaseBrowserClient();
    let lastApplied: string | null | undefined = undefined;

    const applyUser = (
      userId: string | null,
      opts?: { isAnonymous?: boolean }
    ) => {
      if (lastApplied === userId) return;
      lastApplied = userId;
      reconcileLocalStateWithAuthUser(userId, opts);
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
        applyUser(user?.id ?? null, {
          isAnonymous: user ? isAnonymousUser(user) : false,
        });
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
      applyUser(user?.id ?? null, {
        isAnonymous: user ? isAnonymousUser(user) : false,
      });
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
                {body}
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
            <SoftThemeGate />
            {showChromeUi && <ProfileHeader />}
            <main
              className={CONTENT_CLASS}
              data-view-mode="mobile"
              data-compact="true"
            >
              {body}
            </main>
            {showChromeUi && (
              <div className="w-full shrink-0">
                <AppNav />
              </div>
            )}
            <ProgressCelebrationHost />
            <ClickBurstHost />
            <InstallGuideModal />
            {showChromeUi && !onHomeLogin && <FirstVisitWelcome />}
            {showChromeUi && <BetaFeedbackHost />}
          </div>
        </div>
      </div>
    </ViewModeProvider>
  );
}
