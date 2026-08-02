"use client";

import Image from "next/image";
import { useState } from "react";
import { startGoogleAuth } from "@/lib/auth/anonymousSession";
import { unlockEntry } from "@/lib/auth/entryGate";
import {
  getAuthCallbackUrl,
  stashAuthNextPath,
} from "@/lib/auth/redirectOrigin";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  ANALYTICS_EVENTS,
  captureEvent,
  captureFlowError,
  identifyGuestUser,
} from "@/lib/analytics/posthog";
import { enableGuestMode } from "@/lib/auth/guestMode";
import { activateGuestWorkspace } from "@/lib/diary/profileStorage";
import CherryBlossomLayer from "@/components/motion/CherryBlossomLayer";

type Props = {
  onGuest: () => void;
  authNextPath?: string;
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
    captureEvent(ANALYTICS_EVENTS.authGoogleClicked, {
      surface: "landing",
      auth_state_before: "none",
      intent: "sign_in",
    });

    stashAuthNextPath(authNextPath);
    const redirectTo = getAuthCallbackUrl();
    const result = await startGoogleAuth({
      redirectTo,
      preferLink: false,
    });
    if (!result.ok) {
      setLoading(null);
      setMessage(result.error ?? "Google 연결에 실패했어요.");
      captureFlowError({
        step: "auth_google",
        errorCode: "OAUTH_FAILED",
        recoverable: true,
      });
    }
  };

  const startAsGuest = async () => {
    setLoading("guest");
    setMessage("");
    captureEvent(ANALYTICS_EVENTS.authGuestClicked, {
      surface: "landing",
      has_auth_session: false,
    });
    enableGuestMode();
    activateGuestWorkspace();
    identifyGuestUser();
    captureEvent(ANALYTICS_EVENTS.signedIn, {
      auth_provider: "guest",
      auth_transition: "guest_created",
    });
    unlockEntry();
    setLoading(null);
    onGuest();
  };

  return (
    <div
      className="max-w-md mx-auto w-full min-h-[calc(100dvh-1.5rem)] flex flex-col px-1 py-4 relative"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, var(--px-accent) 14%, transparent), transparent 70%)",
      }}
    >
      <CherryBlossomLayer continuous zIndex={2} />
      <div className="relative z-[3] flex flex-col flex-1 min-h-0">
      <section className="flex flex-col items-center text-center gap-3 pt-4 pb-2">
        <div
          className="relative w-[7.25rem] h-[7.25rem] overflow-hidden"
          style={{
            borderRadius: "1.35rem",
            boxShadow: "0 10px 28px rgba(0,0,0,0.35), 0 0 0 2px #f5c45155",
          }}
        >
          <Image
            src="/icons/app-icon-512.png"
            alt=""
            width={512}
            height={512}
            priority
            className="w-full h-full object-cover"
          />
        </div>
        <p
          className="text-[1.05rem] font-black tracking-[0.12em]"
          style={{ color: "var(--px-accent)" }}
        >
          오늘의 사주 일기
        </p>
        <h1
          className="text-[1.45rem] font-black leading-snug tracking-tight"
          style={{ color: "var(--px-text)" }}
        >
          밤의 한 줄이
          <br />
          내일의 결을 닮아갑니다
        </h1>
        <p
          className="text-[12px] font-bold leading-snug max-w-[20rem] px-3 py-2 border"
          style={{
            color: "var(--px-text-on-panel)",
            borderColor: "var(--px-border2)",
            background: "color-mix(in srgb, var(--px-bg2) 90%, transparent)",
          }}
          role="note"
        >
          일기·체크인은 본인만 볼 수 있어요.
          <br />
          링크를 공유해도 기록 내용은 열리지 않습니다.
        </p>
      </section>

      <section
        className="mt-5 p-4 border-2 space-y-3"
        style={{
          background: "var(--px-bg3)",
          borderColor: "var(--px-border)",
          boxShadow: "3px 3px 0 #000",
        }}
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

        <button
          type="button"
          disabled={loading !== null}
          onClick={() => void startAsGuest()}
          className="w-full px-4 py-4 text-base font-black border-2"
          style={{
            background: "color-mix(in srgb, var(--px-text-on-panel) 12%, var(--px-bg2))",
            borderColor: "#000",
            color: "var(--px-text-on-panel)",
            boxShadow: "4px 4px 0 #000",
          }}
        >
          {loading === "guest" ? "준비 중…" : "비로그인으로 둘러보기"}
        </button>
        <p
          className="text-[12px] font-bold text-center leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          이 기기에만 저장 · 나중에 Google로 이어갈 수 있어요
        </p>
      </section>

      {message && (
        <p
          className="mt-3 p-3 border text-xs font-bold"
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

      <div className="flex-1 min-h-6" aria-hidden />

      <section
        className="mt-auto pt-4 pb-2 space-y-3"
        aria-label="앱에서 할 수 있는 일"
      >
        <p
          className="text-[11px] font-black tracking-wide text-center"
          style={{ color: "var(--px-accent)" }}
        >
          여기서 할 수 있는 일
        </p>
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              {
                title: "오늘의 운세",
                body: "사주와 기록이 만나 오늘의 결을 읽어 줘요",
              },
              {
                title: "짧은 체크인",
                body: "기분·행복도를 남겨 나만의 패턴을 쌓아요",
              },
              {
                title: "주간 리포트",
                body: "한 주의 흐름을 숫자와 한 줄로 돌아봐요",
              },
            ] as const
          ).map((item) => (
            <div
              key={item.title}
              className="px-3 py-2.5 border-2 text-left"
              style={{
                borderColor: "var(--px-border)",
                background: "color-mix(in srgb, var(--px-bg2) 88%, transparent)",
              }}
            >
              <p
                className="text-[13px] font-black"
                style={{ color: "var(--px-text)" }}
              >
                {item.title}
              </p>
              <p
                className="mt-0.5 text-[12px] font-bold leading-snug"
                style={{ color: "var(--px-text2)" }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
