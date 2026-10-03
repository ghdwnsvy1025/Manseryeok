"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const callback = new URL("/auth/callback", window.location.origin);
    if (next && next.startsWith("/") && !next.startsWith("//")) callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (error) {
      setError("Google 로그인 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="mt-8 flex h-14 items-center justify-center gap-3 rounded-2xl bg-lamp text-[17px] font-bold text-lamp-ink disabled:opacity-60"
      >
        {busy ? "Google로 이동하는 중…" : "Google로 시작하기"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
