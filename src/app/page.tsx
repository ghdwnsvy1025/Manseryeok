"use client";

import { useEffect, useState } from "react";
import WelcomeAuthGate from "@/components/auth/WelcomeAuthGate";
import SajuProfileSetup from "@/components/home/SajuProfileSetup";
import HomeHub from "@/components/home/HomeHub";
import HomeG from "@/components/home/HomeG";
import { useUserAppState } from "@/hooks/useUserAppState";
import { isNewDiaryEnabled } from "@/lib/app/featureFlags";
import { disableGuestMode } from "@/lib/auth/guestMode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function HomePage() {
  const { state, loading, error, refresh } = useUserAppState();
  const [authReady, setAuthReady] = useState(false);
  const [entryAllowed, setEntryAllowed] = useState(false);
  const newDiary = isNewDiaryEnabled();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setEntryAllowed(false);
      setAuthReady(true);
      return;
    }

    void supabase.auth.getUser().then(({ data }) => {
      const signedIn = Boolean(data.user);
      if (signedIn) disableGuestMode();
      setEntryAllowed(signedIn);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        disableGuestMode();
        setEntryAllowed(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!authReady) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  if (!entryAllowed) {
    return <WelcomeAuthGate onGuest={() => setEntryAllowed(true)} />;
  }

  if (loading) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  if (error) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-sm font-bold" style={{ color: "#f87171" }}>
          {error}
        </p>
        <button
          type="button"
          className="ui-primary-btn px-3 py-2 text-xs"
          onClick={() => void refresh()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!state || state.kind === "new_user") {
    return <SajuProfileSetup onCompleted={() => void refresh()} />;
  }

  // G — 새 홈 (journal 플래그 ON)
  if (newDiary) {
    return <HomeG />;
  }

  return <HomeHub state={state} />;
}
