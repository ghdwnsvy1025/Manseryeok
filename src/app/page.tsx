"use client";

import { useEffect, useState, type ReactNode } from "react";
import WelcomeAuthGate from "@/components/auth/WelcomeAuthGate";
import SajuProfileSetup from "@/components/home/SajuProfileSetup";
import HomeHub from "@/components/home/HomeHub";
import HomeG from "@/components/home/HomeG";
import HomeSaveCelebration from "@/components/home/HomeSaveCelebration";
import { useUserAppState } from "@/hooks/useUserAppState";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";
import { isAnonymousUser } from "@/lib/auth/anonymousSession";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { isEntryUnlocked, unlockEntry, hideShellChrome, showShellChrome } from "@/lib/auth/entryGate";
import {
  disableGuestMode,
  enableGuestMode,
  isGuestMode,
} from "@/lib/auth/guestMode";
import {
  loadLocalSajuProfiles,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function withCelebration(node: ReactNode) {
  return (
    <>
      <HomeSaveCelebration />
      {node}
    </>
  );
}

function localHasSajuProfile(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return loadLocalSajuProfiles().length > 0;
  } catch {
    return false;
  }
}

type Phase = "loading" | "login" | "saju" | "home";

export default function HomePage() {
  const { state, refresh } = useUserAppState();
  const [phase, setPhase] = useState<Phase>("loading");
  const [localProfileHint, setLocalProfileHint] = useState(false);
  const [sajuDone, setSajuDone] = useState(false);
  const [loginError, setLoginError] = useState("");
  const newDiary = isNewDiaryEnabled();

  useEffect(() => {
    const syncLocal = () => setLocalProfileHint(localHasSajuProfile());
    syncLocal();
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, syncLocal);
    const t = window.setTimeout(syncLocal, 600);
    return () => {
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, syncLocal);
      window.clearTimeout(t);
    };
  }, [state]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    const goAfterAuth = () => {
      const hasProfile = localHasSajuProfile() || sajuDone;
      setPhase(hasProfile ? "home" : "saju");
    };

    const resolvePhase = async () => {
      // OAuth 성공 복귀
      const params = new URLSearchParams(window.location.search);
      if (params.get("oauth") === "success") {
        unlockEntry();
        disableGuestMode();
        try {
          const { syncLocalSajuProfileToAccount } = await import(
            "@/lib/diary/profileStorage"
          );
          await syncLocalSajuProfileToAccount();
        } catch {
          /* ignore */
        }
        void autoMigrateLocalJournalToAccount();
        window.history.replaceState({}, "", "/");
      }
      const authError = params.get("authError");
      if (authError) {
        const messages: Record<string, string> = {
          missing_code: "로그인 인증을 끝내지 못했어요. 다시 시도해 주세요.",
          not_configured: "로그인 서버가 설정되지 않았습니다.",
          exchange_failed: "로그인 세션을 만들지 못했어요. 다시 시도해 주세요.",
          identity_already_exists:
            "이미 가입된 Google 계정이에요. 그 계정으로 다시 로그인해 주세요.",
        };
        setLoginError(messages[authError] ?? "로그인에 실패했습니다.");
        window.history.replaceState({}, "", "/");
      }

      if (!supabase) {
        if (isEntryUnlocked() || isGuestMode()) {
          if (isGuestMode()) unlockEntry();
          goAfterAuth();
        } else {
          setPhase("login");
        }
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const user = data.session?.user ?? null;

        if (user && !isAnonymousUser(user)) {
          unlockEntry();
          disableGuestMode();
          void autoMigrateLocalJournalToAccount();
          goAfterAuth();
          return;
        }

        if (
          isEntryUnlocked() &&
          (isGuestMode() || (user && isAnonymousUser(user)))
        ) {
          if (user && isAnonymousUser(user)) enableGuestMode();
          void autoMigrateLocalJournalToAccount();
          goAfterAuth();
          return;
        }

        setPhase("login");
      } catch {
        if (!cancelled) setPhase("login");
      }
    };

    void resolvePhase();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const user = session?.user;
      if (user && !isAnonymousUser(user)) {
        unlockEntry();
        disableGuestMode();
        void autoMigrateLocalJournalToAccount();
        setPhase((prev) => {
          if (prev === "login" || prev === "loading") {
            return localHasSajuProfile() || sajuDone ? "home" : "saju";
          }
          return prev;
        });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "saju") return;
    if (localProfileHint || state?.hasSajuProfile) {
      setSajuDone(true);
      setPhase("home");
    }
  }, [phase, localProfileHint, state?.hasSajuProfile]);

  useEffect(() => {
    if (phase === "login" || phase === "saju" || phase === "loading") {
      hideShellChrome();
    } else if (phase === "home") {
      showShellChrome();
    }
  }, [phase]);

  if (phase === "loading") {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  if (phase === "login") {
    return (
      <WelcomeAuthGate
        authNextPath="/?oauth=success"
        initialMessage={loginError}
        onGuest={() => {
          setPhase(localHasSajuProfile() ? "home" : "saju");
          void refresh();
        }}
      />
    );
  }

  if (phase === "saju") {
    return (
      <SajuProfileSetup
        onCompleted={() => {
          setSajuDone(true);
          setLocalProfileHint(localHasSajuProfile());
          setPhase("home");
          void refresh();
        }}
      />
    );
  }

  if (newDiary || !state) {
    return withCelebration(<HomeG />);
  }

  return withCelebration(<HomeHub state={state} />);
}
