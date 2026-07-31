"use client";

import { useState } from "react";
import {
  ensureAnonymousSession,
  startGoogleAuth,
} from "@/lib/auth/anonymousSession";
import {
  getAuthCallbackUrl,
  stashAuthNextPath,
} from "@/lib/auth/redirectOrigin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";

type Props = {
  onGuest: () => void;
  title?: string;
  subtitle?: string;
  authNextPath?: string;
};

const GOOGLE_BENEFITS = [
  "확인 메일·비밀번호 없이 3초 만에 시작",
  "같은 기기에서 쓰던 기록이 Google 계정으로 이어져요",
  "폰을 바꿔도 일기·운세·패턴이 그대로",
] as const;

/**
 * 시작/로그아웃 공통 — 게스트 + Google
 * Anonymous 서버 설정이 없어도 게스트·Google OAuth는 동작.
 */
export default function WelcomeAuthGate({
  onGuest,
  title = "시작하기",
  subtitle = "먼저 둘러보고, 마음에 들면 Google로 이어서 저장하세요.",
  authNextPath = "/diary/login?oauth=success",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const startAsGuest = async () => {
    setLoading(true);
    setMessage("");
    // Anonymous 꺼져 있어도 로컬 게스트로 진입
    await ensureAnonymousSession();
    void autoMigrateLocalJournalToAccount();
    setLoading(false);
    onGuest();
  };

  const startGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(
        "현재 로그인 서버가 설정되지 않았습니다. 비로그인으로 먼저 사용할 수 있어요."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    captureEvent(ANALYTICS_EVENTS.authGoogleClicked);

    // 익명 가능하면 만들어 linkIdentity, 안 되면 그냥 OAuth
    await ensureAnonymousSession();

    stashAuthNextPath(authNextPath);
    const redirectTo = getAuthCallbackUrl();
    const result = await startGoogleAuth({ redirectTo });
    if (!result.ok) {
      setLoading(false);
      setMessage(result.error ?? "Google 연결에 실패했어요.");
      return;
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-6">
      <section
        className="p-4 border-2 space-y-1 text-center"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          오늘의 사주 일기
        </p>
        <h1 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          {title}
        </h1>
        <p className="text-xs font-bold pt-1" style={{ color: "var(--px-text2)" }}>
          {subtitle}
        </p>
      </section>

      <section
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        aria-label="시작 방법 선택"
      >
        <button
          type="button"
          disabled={loading}
          onClick={() => void startAsGuest()}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "#000",
            color: "var(--px-text-on-panel)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          {loading ? "준비 중…" : "로그인 없이 바로 써보기"}
        </button>
        <p
          className="text-[11px] font-bold text-center leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          바로 시작 · Google로 바꾸면 기록이 이어져요
        </p>

        <div
          className="h-px w-full"
          style={{ background: "var(--px-border)" }}
          aria-hidden
        />

        <button
          type="button"
          disabled={loading}
          onClick={() => void startGoogle()}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "var(--px-accent)",
            borderColor: "#000",
            color: "#111",
            boxShadow: "4px 4px 0 #000",
          }}
        >
          {loading ? "연결 중…" : "Google로 이어가기"}
        </button>

        <ul className="space-y-1.5 pt-0.5" aria-label="Google 로그인 장점">
          {GOOGLE_BENEFITS.map((line) => (
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
