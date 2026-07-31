"use client";

import { useEffect, useState, type ReactNode } from "react";
import SajuProfileSetup from "@/components/home/SajuProfileSetup";
import HomeHub from "@/components/home/HomeHub";
import HomeG from "@/components/home/HomeG";
import HomeSaveCelebration from "@/components/home/HomeSaveCelebration";
import { useUserAppState } from "@/hooks/useUserAppState";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";
import {
  ensureAnonymousSession,
  isAnonymousUser,
} from "@/lib/auth/anonymousSession";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { disableGuestMode, enableGuestMode } from "@/lib/auth/guestMode";
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

export default function HomePage() {
  const { state, refresh } = useUserAppState();
  const [authReady, setAuthReady] = useState(false);
  const [entryAllowed, setEntryAllowed] = useState(false);
  const [localProfileHint, setLocalProfileHint] = useState(false);
  const [waitedForProfile, setWaitedForProfile] = useState(false);
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
    const t = window.setTimeout(() => setWaitedForProfile(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      enableGuestMode();
      setEntryAllowed(true);
      setAuthReady(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session?.user) {
          if (isAnonymousUser(data.session.user)) enableGuestMode();
          else disableGuestMode();
          setEntryAllowed(true);
          void autoMigrateLocalJournalToAccount();
        } else {
          const anon = await ensureAnonymousSession();
          if (cancelled) return;
          setEntryAllowed(Boolean(anon.user) || anon.ok);
          void autoMigrateLocalJournalToAccount();
        }
      } catch {
        if (cancelled) return;
        enableGuestMode();
        setEntryAllowed(true);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        if (isAnonymousUser(session.user)) enableGuestMode();
        else disableGuestMode();
        setEntryAllowed(true);
        setAuthReady(true);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady || !entryAllowed) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  const hasProfile = Boolean(state?.hasSajuProfile) || localProfileHint;

  if (!hasProfile) {
    if (!waitedForProfile && state === null) {
      return <p className="ui-hint p-4">불러오는 중...</p>;
    }
    return <SajuProfileSetup onCompleted={() => void refresh()} />;
  }

  if (newDiary || !state) {
    return withCelebration(<HomeG />);
  }

  return withCelebration(<HomeHub state={state} />);
}
