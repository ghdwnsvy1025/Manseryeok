"use client";

import { useCallback, useEffect, useState } from "react";
import { LinkReturnNote, useLinkReturn } from "@/components/LinkGoogleButton";
import { track } from "@/lib/analytics";
import { anonymousNow, callbackHref, clearLinkPending, markLinkPending } from "@/lib/googleLink";
import { createClient } from "@/lib/supabase/client";
import { loginButtons, type LoginMode } from "@/lib/linkPrompt";
import { safeNext } from "@/lib/safeNext";

interface Props {
  next?: string;
  /** 이 기기(익명 세션)의 기록 수. 1건 이상이면 "기존 계정으로 로그인"은 두 번 눌러야 실행된다 (전체검토 D-H-1b) */
  entryCount?: number;
}

/** 첫 누름 뒤 이 시간 안에 다시 눌러야 실행. 지나면 처음으로 (ClearAllButton과 같은 방식) */
export const CONFIRM_WINDOW_MS = 5000;

function callbackUrl(mode: LoginMode, next?: string): string {
  return callbackHref(window.location.origin, mode === "link" ? "link" : "fresh", safeNext(next, ""));
}

const PRIMARY = "flex h-14 items-center justify-center gap-3 rounded-2xl bg-gold text-[17px] font-bold text-gold-ink disabled:opacity-60";
const SECONDARY = "flex h-13 items-center justify-center rounded-xl border border-frame text-[16px] font-bold text-ink disabled:opacity-60";

/**
 * /login의 Google 버튼 (B10). 세션이 익명이면 처음부터 두 개를 보인다 —
 * "이 기기의 기록에 Google 연결하기"(linkIdentity: 같은 user_id라 기록이 그대로)와
 * "기존 Google 계정으로 로그인하기"(OAuth: 전에 쓰던 기록으로 간다. 이 기기의 익명 기록은 더 못 본다).
 * 세션이 없으면 로그인 하나, 이미 Google 사용자면 버튼을 숨긴다 (docs/ANON_START.md 2절).
 *
 * "fresh"는 OAuth 전에 signOut하지 않는다 — Google 화면에서 취소하거나 끊기면 익명 세션이 이미 사라져 기록을 영영 못 보던 문제
 * (전체검토 B-M2). 콜백의 exchangeCodeForSession이 성공했을 때만 세션이 바뀐다. 기록이 있으면 두 번 눌러 확인한다 (D-H-1b).
 */
export function GoogleButton({ next, entryCount = 0 }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ isAnonymous: boolean } | null | undefined>(undefined);
  const [armed, setArmed] = useState(false);
  // 연결 버튼을 누르고 돌아왔으면 토큰을 갱신해 연결됐는지 확인한다 (docs/ANON_START.md 6절)
  const linkReturn = useLinkReturn(useCallback(() => setBusy(false), []));

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSession(data.session ? { isAnonymous: Boolean(data.session.user.is_anonymous) } : null));
  }, []);

  // 돌아와서 연결이 확인되면 버튼 대신 "이미 Google로 들어와 있어요"
  useEffect(() => {
    if (linkReturn.status === "linked") setSession({ isAnonymous: false });
  }, [linkReturn.status]);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  async function go(mode: LoginMode) {
    if (mode === "fresh" && entryCount > 0 && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (mode === "link" && (await anonymousNow(supabase.auth)) === false) {
      // 토큰을 갱신해 보니 연결이 이미 끝나 있었다 — Google로 다시 가면 "이미 연결됨"으로 헛돈다 (2026-10-25)
      clearLinkPending();
      setSession({ isAnonymous: false });
      setBusy(false);
      return;
    }
    track("login_start", { provider: "google", mode, from: "login" });
    const options = { redirectTo: callbackUrl(mode, next) };
    let result: { error: { message: string } | null };
    if (mode === "link") {
      markLinkPending();
      result = await supabase.auth.linkIdentity({ provider: "google", options });
    } else {
      result = await supabase.auth.signInWithOAuth({ provider: "google", options });
    }
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (result.error) {
      console.error("Google 로그인", result.error);
      clearLinkPending();
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
          <button
            type="button"
            onClick={() => go(b.mode)}
            disabled={busy || session === undefined}
            aria-live={b.mode === "fresh" ? "polite" : undefined}
            className={`${i === 0 ? PRIMARY : SECONDARY} ${b.mode === "fresh" && armed ? "border-danger text-danger" : ""}`}
          >
            {busy ? "Google로 이동하는 중…" : b.mode === "fresh" && armed ? `정말 로그인하기 — 이 기기의 기록 ${entryCount}건은 더 못 봐요` : b.label}
          </button>
          {b.description && (
            <p className="px-1 text-sm leading-relaxed text-muted">
              {b.mode === "fresh" && armed ? "5초 안에 다시 누르면 Google로 가요. 기록을 남기려면 위의 '연결하기'를 눌러요." : b.description}
            </p>
          )}
        </div>
      ))}
      <LinkReturnNote status={linkReturn.status} recheck={linkReturn.recheck} />
      {error && (
        <p role="alert" className="text-[15px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
