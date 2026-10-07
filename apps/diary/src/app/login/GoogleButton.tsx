"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loginButtons, type LoginMode } from "@/lib/linkPrompt";

interface Props {
  next?: string;
}

function callbackUrl(next?: string): string {
  const callback = new URL("/auth/callback", window.location.origin);
  if (next && next.startsWith("/") && !next.startsWith("//")) callback.searchParams.set("next", next);
  return callback.toString();
}

const PRIMARY = "flex h-14 items-center justify-center gap-3 rounded-2xl bg-lamp text-[17px] font-bold text-lamp-ink disabled:opacity-60";
const SECONDARY = "flex h-13 items-center justify-center rounded-xl border border-frame text-[16px] font-bold text-ink disabled:opacity-60";

/**
 * /login의 Google 버튼 (B10). 세션이 익명이면 처음부터 두 개를 보인다 —
 * "이 기기의 기록에 Google 연결하기"(linkIdentity: 같은 user_id라 기록이 그대로)와
 * "기존 Google 계정으로 로그인하기"(signOut 뒤 OAuth: 전에 쓰던 기록으로 간다. 이 기기의 익명 기록은 더 못 본다).
 * 세션이 없으면 로그인 하나, 이미 Google 사용자면 버튼을 숨긴다 (docs/ANON_START.md 2절).
 */
export function GoogleButton({ next }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ isAnonymous: boolean } | null | undefined>(undefined);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSession(data.session ? { isAnonymous: Boolean(data.session.user.is_anonymous) } : null));
  }, []);

  async function go(mode: LoginMode) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const options = { redirectTo: callbackUrl(next) };
    let result: { error: { message: string } | null };
    if (mode === "link") {
      result = await supabase.auth.linkIdentity({ provider: "google", options });
    } else {
      // "fresh": 익명 세션을 버리고 기존 Google 계정으로. 이 기기의 익명 기록은 더 못 본다 — 버튼 아래에 적어 두었다
      if (mode === "fresh") await supabase.auth.signOut();
      result = await supabase.auth.signInWithOAuth({ provider: "google", options });
    }
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (result.error) {
      console.error("Google 로그인", result.error);
      setError("Google 로그인 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  // 세션을 아직 모르면(첫 그리기) 로그인 버튼 하나를 비활성으로 — 모양이 튀지 않게
  const buttons = session === undefined ? loginButtons(null) : loginButtons(session);
  if (buttons.length === 0) {
    return <p className="mt-8 text-center text-[15px] text-muted">이미 Google로 들어와 있어요.</p>;
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      {buttons.map((b, i) => (
        <div key={b.mode} className="flex flex-col gap-2">
          <button type="button" onClick={() => go(b.mode)} disabled={busy || session === undefined} className={i === 0 ? PRIMARY : SECONDARY}>
            {busy ? "Google로 이동하는 중…" : b.label}
          </button>
          {b.description && <p className="px-1 text-sm leading-relaxed text-muted">{b.description}</p>}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[15px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
