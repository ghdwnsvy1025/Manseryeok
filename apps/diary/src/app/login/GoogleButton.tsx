"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { googleButtonLabel } from "@/lib/linkPrompt";

interface Props {
  next?: string;
  /** 연결이 "이미 다른 계정에 묶인 Google"로 실패한 뒤: 익명 세션을 버리고 그 계정으로 로그인하는 길을 연다 */
  offerFreshLogin?: boolean;
}

function callbackUrl(next?: string): string {
  const callback = new URL("/auth/callback", window.location.origin);
  if (next && next.startsWith("/") && !next.startsWith("//")) callback.searchParams.set("next", next);
  return callback.toString();
}

/**
 * /login의 Google 버튼. 세션이 익명이면 로그인이 아니라 연결(linkIdentity) — 로그인하면 새 계정이 돼 익명 기록과 갈라진다 (docs/ANON_START.md 2절).
 * 세션이 없으면 보통 로그인. 이미 Google 사용자면 버튼을 숨긴다.
 */
export function GoogleButton({ next, offerFreshLogin = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ isAnonymous: boolean } | null | undefined>(undefined);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSession(data.session ? { isAnonymous: Boolean(data.session.user.is_anonymous) } : null));
  }, []);

  async function go(mode: "auto" | "fresh") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const options = { redirectTo: callbackUrl(next) };
    let result: { error: { message: string } | null };
    if (mode === "fresh") {
      // 익명 세션을 버리고 기존 Google 계정으로. 이 기기의 익명 기록은 더 못 본다 — 화면에 미리 적어 두었다
      await supabase.auth.signOut();
      result = await supabase.auth.signInWithOAuth({ provider: "google", options });
    } else if (session?.isAnonymous) {
      result = await supabase.auth.linkIdentity({ provider: "google", options });
    } else {
      result = await supabase.auth.signInWithOAuth({ provider: "google", options });
    }
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (result.error) {
      console.error("Google 로그인", result.error);
      setError("Google 로그인 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  const label = session === undefined ? "Google로 시작하기" : googleButtonLabel(session);
  if (label === null) {
    return <p className="mt-8 text-center text-[15px] text-muted">이미 Google로 들어와 있어요.</p>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => go("auto")}
        disabled={busy || session === undefined}
        className="mt-8 flex h-14 items-center justify-center gap-3 rounded-2xl bg-lamp text-[17px] font-bold text-lamp-ink disabled:opacity-60"
      >
        {busy ? "Google로 이동하는 중…" : label}
      </button>
      {offerFreshLogin && session?.isAnonymous && (
        <button
          type="button"
          onClick={() => go("fresh")}
          disabled={busy}
          className="mt-3 flex h-13 items-center justify-center rounded-xl border border-frame font-bold text-ink disabled:opacity-60"
        >
          기존 Google 계정으로 로그인
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
