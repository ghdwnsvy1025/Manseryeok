"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** 돌아올 앱 안 경로 */
  next?: string;
  label?: string;
  className?: string;
}

function safeNext(next?: string): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/**
 * 익명 계정에 Google을 붙인다 (docs/ANON_START.md 2절). 같은 user_id라 기록은 그대로다.
 * 세션이 익명이 아니면(이미 Google 사용자) linkIdentity 대신 signInWithOAuth로 간다 — 세션이 끊긴 기존 사용자용.
 * 콜백은 기존 /auth/callback.
 */
export function LinkGoogleButton({ next = "/settings", label = "Google로 연결하기", className }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const callback = new URL("/auth/callback", window.location.origin);
    const n = safeNext(next);
    if (n) callback.searchParams.set("next", n);
    const { data } = await supabase.auth.getSession();
    const anonymous = Boolean(data.session?.user.is_anonymous);
    const options = { redirectTo: callback.toString() };
    const { error } = anonymous
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (error) {
      console.error("Google 연결", error);
      setError(/manual linking/i.test(error.message) ? "지금은 연결할 수 없어요. 잠시 뒤 다시 해 주세요." : "Google 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={link}
        disabled={busy}
        // 기본은 금색 면 버튼(키트 gold-wash) — 설정·연결 안내 카드에서 화면의 유일한 금색 면. 다른 곳은 className으로 테두리형을 넘긴다
        className={className ?? "gold-plate flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-60"}
      >
        {busy ? "Google로 이동하는 중…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
