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
  /** 계정 설정에서 로그아웃 후 등 */
  title?: string;
  subtitle?: string;
  /** OAuth 성공 후 돌아갈 경로 */
  authNextPath?: string;
};

const GOOGLE_BENEFITS = [
  "확인 메일·비밀번호 없이 3초 만에 시작",
  "폰을 바꿔도 일기·운세·패턴이 그대로",
  "이 기기만의 기록이 사라질 걱정 없이 백업",
] as const;

/**
 * 시작/로그아웃 공통 — Google + 비로그인만 (이메일 없음)
 */
export default function WelcomeAuthGate({
  onGuest,
  title = "시작하기",
  subtitle = "먼저 둘러보고, 마음에 들면 Google로 저장하세요.",
  authNextPath = "/diary/login?oauth=success",
}: Props) {
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
    stashAuthNextPath(authNextPath);
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
          onClick={() => {
            enableGuestMode();
            onGuest();
          }}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "#000",
            color: "var(--px-text-on-panel)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          로그인 없이 바로 써보기
        </button>
        <p
          className="text-[11px] font-bold text-center leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          베타 테스트용 · 기록은 이 기기에만 남아요
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
          {loading ? "연결 중…" : "Google로 시작하기"}
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
