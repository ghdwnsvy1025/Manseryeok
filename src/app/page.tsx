"use client";

import { useEffect, useState, type ReactNode } from "react";
import SajuProfileSetup from "@/components/home/SajuProfileSetup";
import HomeHub from "@/components/home/HomeHub";
import HomeG from "@/components/home/HomeG";
import HomeSaveCelebration from "@/components/home/HomeSaveCelebration";
import { useUserAppState } from "@/hooks/useUserAppState";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";
import {
  disableGuestMode,
  enableGuestMode,
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

function enterAsGuest(setEntryAllowed: (v: boolean) => void) {
  enableGuestMode();
  setEntryAllowed(true);
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
      // 서버 미설정이어도 게스트로 바로 사용
      enterAsGuest(setEntryAllowed);
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        // 세션 확인이 느리면 게스트로 진입 (이후 로그인 시 덮어씀)
        setEntryAllowed((prev) => {
          if (!prev) enableGuestMode();
          return true;
        });
        setAuthReady(true);
      }
    }, 1000);

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const signedIn = Boolean(data.session?.user);
        if (signedIn) {
          disableGuestMode();
          setEntryAllowed(true);
        } else {
          enterAsGuest(setEntryAllowed);
        }
        setAuthReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        enterAsGuest(setEntryAllowed);
        setAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        disableGuestMode();
        setEntryAllowed(true);
        setAuthReady(true);
      }
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (!authReady || !entryAllowed) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  const hasProfile = Boolean(state?.hasSajuProfile) || localProfileHint;

  if (!hasProfile) {
    // 원격 프로필이 곧 올 수 있어 최대 1.5초만 대기
    if (!waitedForProfile && state === null) {
      return <p className="ui-hint p-4">불러오는 중...</p>;
    }
    return <SajuProfileSetup onCompleted={() => void refresh()} />;
  }

  // 프로필 생기면 홈 — state 유무와 무관하게 더 이상 로딩에 가두지 않음
  if (newDiary || !state) {
    return withCelebration(<HomeG />);
  }

  return withCelebration(<HomeHub state={state} />);
}
