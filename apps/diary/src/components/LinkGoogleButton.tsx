"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { anonymousNow, callbackHref, clearLinkPending, markLinkPending, readLinkPending } from "@/lib/googleLink";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

interface Props {
  /** 돌아올 앱 안 경로 */
  next?: string;
  label?: string;
  className?: string;
}

export type LinkReturnStatus = "idle" | "checking" | "linked" | "unconfirmed";

/**
 * 연결 버튼을 누르고 돌아온 뒤의 확인 (docs/ANON_START.md 6절). iOS 홈 화면 앱은 Google 화면이 앱 밖에서 열리고 콜백도
 * 그쪽에서 끝나므로, 이 화면은 "다시 보이는" 것으로 돌아온다. 그때 토큰을 갱신하면 연결됐으면 is_anonymous가 false다 —
 * 서버 화면을 다시 그려 "연결됨"을 보인다. 아니면 "아직 연결되지 않았어요"를 분명히 보인다.
 * 누른 흔적(localStorage)이 있을 때만, 15분까지만 확인한다. onReturn은 화면이 다시 보일 때마다 — 앱 밖으로 나갔다 오면
 * 이 화면은 새로 그려지지 않아 버튼이 "이동하는 중"에 멈춰 있으므로 그것을 푼다.
 */
export function useLinkReturn(onReturn?: () => void): { status: LinkReturnStatus; recheck: () => void } {
  const router = useRouter();
  const [status, setStatus] = useState<LinkReturnStatus>("idle");

  const check = useCallback(async () => {
    if (readLinkPending() === null) return;
    setStatus("checking");
    try {
      const { data, error } = await createClient().auth.refreshSession();
      if (!error && data.session && !data.session.user.is_anonymous) {
        clearLinkPending();
        setStatus("linked");
        router.refresh();
        return;
      }
    } catch (e) {
      console.warn("Google 연결 확인", e);
    }
    setStatus("unconfirmed");
  }, [router]);

  useEffect(() => {
    void check();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      onReturn?.();
      void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [check, onReturn]);

  return { status, recheck: () => void check() };
}

/** 돌아온 뒤 확인 상태의 문구. idle이면 null */
export function linkReturnMessage(status: LinkReturnStatus): string | null {
  switch (status) {
    case "checking":
      return "연결됐는지 확인하고 있어요…";
    case "linked":
      return "연결됐어요.";
    case "unconfirmed":
      // 끝까지 마쳤는데 안 붙는 가장 흔한 까닭: 그 Google로 전에 로그인해 따로 생긴 기록이 있다 (identity_already_exists)
      return "아직 연결되지 않았어요. Google 화면을 끝까지 마쳤는데도 그렇다면, 그 Google 계정으로 전에 만든 기록이 따로 있는 거예요. 다른 Google 계정으로 연결해 주세요.";
    default:
      return null;
  }
}

/** 확인 결과 한 줄 + "다시 확인" (설정·로그인 화면 공용) */
export function LinkReturnNote({ status, recheck, className = "" }: { status: LinkReturnStatus; recheck: () => void; className?: string }) {
  const message = linkReturnMessage(status);
  if (!message) return null;
  return (
    <p role="status" aria-live="polite" className={`text-[15px] leading-relaxed ${status === "unconfirmed" ? "text-danger" : "text-muted"} ${className}`}>
      {message}
      {status === "unconfirmed" && (
        <>
          {" "}
          <button type="button" onClick={recheck} className="tap underline underline-offset-4">
            다시 확인
          </button>
        </>
      )}
    </p>
  );
}

/**
 * 익명 계정에 Google을 붙인다 (docs/ANON_START.md 2·6절). 같은 user_id라 기록은 그대로다.
 * 누르면 토큰부터 갱신한다. 이미 Google 계정이면(다른 창에서 연결이 끝남) 화면만 새로 그리고, 세션이 없으면(세션이 끊긴 기존
 * 사용자) linkIdentity 대신 signInWithOAuth로 간다.
 * 콜백은 기존 /auth/callback(`mode`로 연결·로그인을 알린다).
 */
export function LinkGoogleButton({ next = "/settings", label = "Google로 연결하기", className }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, recheck } = useLinkReturn(useCallback(() => setBusy(false), []));

  async function link() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const now = await anonymousNow(supabase.auth);
    if (now === false) {
      // 갱신해 보니 이미 Google 계정이다(앞서 누른 연결이 끝나 있었다) — Google로 다시 가지 않고 서버 화면을 새로 그려 "연결됨"을 보인다
      clearLinkPending();
      setBusy(false);
      router.refresh();
      return;
    }
    const anonymous = now === true;
    track("login_start", { provider: "google", mode: anonymous ? "link" : "fresh", from: next.startsWith("/settings") ? "settings" : "prompt" });
    const options = { redirectTo: callbackHref(window.location.origin, anonymous ? "link" : "fresh", safeNext(next, "")) };
    // 돌아왔을 때 확인할 수 있게 흔적을 남긴다. 성공하면 이 화면은 Google(또는 앱 밖 창)로 넘어간다
    if (anonymous) markLinkPending();
    const { error } = anonymous
      ? await supabase.auth.linkIdentity({ provider: "google", options })
      : await supabase.auth.signInWithOAuth({ provider: "google", options });
    // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
    if (error) {
      console.error("Google 연결", error);
      clearLinkPending();
      setError(/manual linking/i.test(error.message) ? "지금은 연결할 수 없어요. 잠시 뒤 다시 해 주세요." : "Google 창을 열지 못했어요. 다시 눌러 주세요.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={link}
        disabled={busy || status === "checking" || status === "linked"}
        // 기본은 금색 면 버튼(키트 gold-wash) — 설정·연결 안내 카드에서 화면의 유일한 금색 면. 다른 곳은 className으로 테두리형을 넘긴다
        className={className ?? "gold-plate flex h-14 items-center justify-center rounded-xl text-[17px] font-bold text-gold-ink disabled:opacity-60"}
      >
        {busy ? "Google로 이동하는 중…" : label}
      </button>
      <LinkReturnNote status={status} recheck={recheck} className="mt-3" />
      {error && (
        <p role="alert" className="mt-3 text-[15px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
