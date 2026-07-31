"use client";

import { useState } from "react";
import { enableGuestMode, disableGuestMode } from "@/lib/auth/guestMode";
import {
  getAuthCallbackUrl,
  stashAuthNextPath,
} from "@/lib/auth/redirectOrigin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";

type Props = {
  onGuest: () => void;
};

/** 웰컴 게이트 — Google 전용 (이메일 가입은 확인 메일 이슈로 제외) */
export default function WelcomeAuthGate({ onGuest }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const startGoogle = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(
        "현재 로그인 서버가 설정되지 않았습니다. 비로그인으로 먼저 사용할 수 있어요."
      );
      return;
    }

    disableGuestMode();
    setLoading(true);
    setMessage("");
    captureEvent(ANALYTICS_EVENTS.authGoogleClicked);
    stashAuthNextPath("/diary/login?oauth=success");
    const redirectTo = getAuthCallbackUrl();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { hl: "ko" },
      },
    });
    if (error) {
      setLoading(false);
      setMessage(
        `Google 로그인을 시작하지 못했습니다. (돌아갈 주소: ${redirectTo})`
      );
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
          시작하기
        </h1>
        <p className="text-xs font-bold pt-1" style={{ color: "var(--px-text2)" }}>
          Google 한 번이면 가입·로그인 끝. 확인 메일 없이 바로 시작해요.
        </p>
      </section>

      <section
        className="p-4 border-2 space-y-3"
        style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}
        aria-label="로그인 방법 선택"
      >
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
          {loading ? "연결 중…" : "Google로 3초 만에 시작"}
        </button>
        <p
          className="text-[11px] font-bold text-center leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          추천 · 가장 빠르고 안정적이에요
        </p>
      </section>

      <button
        type="button"
        disabled={loading}
        onClick={() => {
          enableGuestMode();
          onGuest();
        }}
        className="w-full px-4 py-2 text-xs font-bold underline"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--px-text2)",
        }}
      >
        로그인 없이 둘러보기 (기록·AI 문장은 이 기기에만 / 제한됨)
      </button>

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
