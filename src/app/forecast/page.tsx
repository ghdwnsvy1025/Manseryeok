"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HomeDashboard from "@/components/home/HomeDashboard";
import { useUserAppState } from "@/hooks/useUserAppState";
import { isGuestMode } from "@/lib/auth/guestMode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForecastPage() {
  const { state, loading, error, refresh } = useUserAppState();
  const [authReady, setAuthReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAllowed(isGuestMode());
      setAuthReady(true);
      return;
    }
    void supabase.auth.getUser().then(({ data }) => {
      setAllowed(Boolean(data.user) || isGuestMode());
      setAuthReady(true);
    });
  }, []);

  if (!authReady || loading) {
    return <p className="ui-hint p-4">불러오는 중...</p>;
  }

  if (!allowed) {
    return (
      <div className="p-4 space-y-3 text-center">
        <p className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
          예보를 보려면 로그인이 필요해요.
        </p>
        <Link href="/" className="ui-primary-btn inline-block px-4 py-2 text-sm">
          홈으로
        </Link>
      </div>
    );
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
    return (
      <div className="p-4 space-y-3 text-center">
        <p className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
          먼저 사주 프로필을 만들어 주세요.
        </p>
        <Link href="/" className="ui-primary-btn inline-block px-4 py-2 text-sm">
          홈으로
        </Link>
      </div>
    );
  }

  return <HomeDashboard state={state} />;
}
