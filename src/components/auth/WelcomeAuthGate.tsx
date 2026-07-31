"use client";

import { useState } from "react";
import {
  ensureAnonymousSession,
  startGoogleAuth,
} from "@/lib/auth/anonymousSession";
import { unlockEntry } from "@/lib/auth/entryGate";
import {
  getAuthCallbackUrl,
  stashAuthNextPath,
} from "@/lib/auth/redirectOrigin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { enableGuestMode } from "@/lib/auth/guestMode";

type Props = {
  onGuest: () => void;
  authNextPath?: string;
  /** OAuth 등 외부에서 넘긴 안내 문구 */
  initialMessage?: string;
};

/**
 * 최초/로그아웃 후 — 로그인만 (Google 위 · 비로그인 아래)
 */
export default function WelcomeAuthGate({
  onGuest,
  authNextPath = "/?oauth=success",
  initialMessage = "",
}: Props) {
  const [loading, setLoading] = useState<"google" | "guest" | null>(null);
  const [message, setMessage] = useState(initialMessage);

  const startGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("로그인 서버가 설정되지 않았습니다.");
      return;
    }

    setLoading("google");
    setMessage("");
    captureEvent(ANALYTICS_EVENTS.authGoogleClicked);

    // 로그인 화면은 일반 OAuth (linkIdentity는 인증코드 누락·기존 계정 충돌이 잦음)
    stashAuthNextPath(authNextPath);
    const redirectTo = getAuthCallbackUrl();
    const result = await startGoogleAuth({
      redirectTo,
      preferLink: false,
    });
    if (!result.ok) {
      setLoading(null);
      setMessage(result.error ?? "Google 연결에 실패했어요.");
    }
  };

  const startAsGuest = async () => {
    setLoading("guest");
    setMessage("");
    await ensureAnonymousSession();
    enableGuestMode();
    unlockEntry();
    void autoMigrateLocalJournalToAccount();
    setLoading(null);
    onGuest();
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-6 pt-6 px-1">
      <section
        className="p-5 border-2 space-y-2 text-center"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          오늘의 사주 일기
        </p>
        <h1 className="text-xl font-black" style={{ color: "var(--px-accent)" }}>
          로그인
        </h1>
        <p className="text-xs font-bold leading-relaxed" style={{ color: "var(--px-text2)" }}>
          시작하려면 Google 또는 비로그인 중 하나를 골라 주세요.
        </p>
      </section>

      <section
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        aria-label="로그인 방법"
      >
        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void startGoogle()}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "var(--px-accent)",
            borderColor: "#000",
            color: "#111",
            boxShadow: "4px 4px 0 #000",
          }}
        >
          {loading === "google" ? "연결 중…" : "Google로 시작하기"}
        </button>
        <ul className="space-y-1.5" aria-label="Google 로그인 장점">
          {(
            [
              "확인 메일·비밀번호 없이 바로 시작",
              "기기 바꿔도 기록이 이어져요",
              "이 기기 기록도 계정에 자동 저장",
            ] as const
          ).map((line) => (
            <li
              key={line}
              className="text-[11px] font-bold leading-snug pl-2"
              style={{
                color: "var(--px-text2)",
                borderLeft: "2px solid var(--px-accent)",
              }}
            >
              {line}
            </li>
          ))}
        </ul>

        <div
          className="h-px w-full"
          style={{ background: "var(--px-border)" }}
          aria-hidden
        />

        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void startAsGuest()}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "#000",
            color: "var(--px-text-on-panel)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          {loading === "guest" ? "준비 중…" : "비로그인으로 시작하기"}
        </button>
        <p
          className="text-[11px] font-bold text-center leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          베타 테스트용 · 나중에 Google로 이어갈 수 있어요
        </p>
      </section>

      {message && (
        <p
          className="p-3 border text-xs font-bold"
          style={{
            borderColor: "var(--px-border)",
            color: "var(--px-text2)",
            background: "var(--px-bg2)",
          }}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
