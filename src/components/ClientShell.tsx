"use client";

import { useEffect, useState } from "react";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import AppNav from "@/components/AppNav";
import ProfileHeader from "@/components/ProfileHeader";
import ProgressCelebrationHost from "@/components/motion/ProgressCelebrationHost";
import ClickBurstHost from "@/components/motion/ClickBurstHost";
import PostHogInit from "@/components/analytics/PostHogInit";
import { reconcileLocalStateWithAuthUser } from "@/lib/diary/profileStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";

const CONTENT_CLASS =
  "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto app-hide-scrollbar px-2 py-2 w-full";

/**
 * 하이드레이션 충돌 방지:
 * - 서버/첫 페인트: 콘텐츠만 (헤더·네비 없음)
 * - 마운트 후: 헤더 + main + 하단 네비
 * 계정 전환 시 이전 유저 로컬 프로필이 헤더에 잠깐 보이지 않도록
 * ready 전에 auth reconcile을 먼저 끝낸다.
 */
export default function ClientShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    let lastApplied: string | null | undefined = undefined;

    const applyUser = (userId: string | null) => {
      if (lastApplied === userId) return;
      lastApplied = userId;
      reconcileLocalStateWithAuthUser(userId);
      resetDiaryStorageCache();
      resetJournalStorageCache();
    };

    void (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          applyUser(data.session?.user?.id ?? null);
        }
      } else if (!cancelled) {
        applyUser(null);
      }
      if (!cancelled) setReady(true);
    })();

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
                <p className="ui-hint p-4">불러오는 중...</p>
              </div>
            </div>
          ) : (
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
            </div>
          )}
        </div>
      </div>
    </ViewModeProvider>
  );
}
