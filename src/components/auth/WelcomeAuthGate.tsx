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

type EmailMode = "login" | "signup";

function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("email not confirmed")) {
    return "이메일 인증이 아직 안 됐어요. 가입 메일의 링크를 눌러 주세요. (메일이 없으면 Google 로그인을 권장해요)";
  }
  if (lower.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 맞지 않아요.";
  }
  if (lower.includes("user already registered")) {
    return "이미 가입된 이메일이에요. 로그인으로 전환해 보세요.";
  }
  return raw;
}

/**
 * Google 우선 + 이메일(가입/로그인) 보조.
 * 이메일은 확인 메일 설정에 따라 막힐 수 있어 안내를 분명히 둔다.
 */
export default function WelcomeAuthGate({ onGuest }: Props) {
  const [emailMode, setEmailMode] = useState<EmailMode>("signup");
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
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
    try {
      captureEvent(ANALYTICS_EVENTS.authEmailSubmitted, {
        mode: emailMode,
      });
      if (emailMode === "signup") {
        stashAuthNextPath("/diary/login?email=confirmed");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/diary/login?oauth=success";
          return;
        }
        setMessage(
          "가입 확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료됩니다."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = "/diary/login?oauth=success";
      }
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "이메일 인증에 실패했습니다.";
      setMessage(friendlyAuthError(raw));
    } finally {
      setLoading(false);
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
          Google이면 확인 메일 없이 바로 시작해요. 이메일도 가능해요.
        </p>
      </section>

      <section
        className="p-4 border-2 space-y-2"
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
          className="text-[11px] font-bold text-center"
          style={{ color: "var(--px-text2)" }}
        >
          추천 · 가장 빠르고 안정적이에요
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={() => setShowEmail((value) => !value)}
          className="w-full px-4 py-2.5 text-sm font-bold border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-border)",
            color: "var(--px-text2)",
          }}
          aria-expanded={showEmail}
        >
          {showEmail ? "이메일 접기" : "이메일로 가입·로그인"}
        </button>

        {showEmail && (
          <form
            onSubmit={submitEmail}
            className="mt-1 p-3 border space-y-2"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg2)",
            }}
          >
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setEmailMode("signup")}
                className="px-2 py-2 text-xs font-bold border"
                style={{
                  borderColor:
                    emailMode === "signup"
                      ? "var(--px-accent)"
                      : "var(--px-border)",
                  color:
                    emailMode === "signup"
                      ? "var(--px-accent)"
                      : "var(--px-text2)",
                }}
              >
                가입
              </button>
              <button
                type="button"
                onClick={() => setEmailMode("login")}
                className="px-2 py-2 text-xs font-bold border"
                style={{
                  borderColor:
                    emailMode === "login"
                      ? "var(--px-accent)"
                      : "var(--px-border)",
                  color:
                    emailMode === "login"
                      ? "var(--px-accent)"
                      : "var(--px-text2)",
                }}
              >
                로그인
              </button>
            </div>
            <input
              id="welcome-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일"
              className="w-full px-3 py-2 text-sm border-2"
              style={{
                background: "var(--px-bg3)",
                borderColor: "var(--px-border)",
                color: "var(--px-text)",
              }}
            />
            <input
              id="welcome-password"
              type="password"
              autoComplete={
                emailMode === "signup" ? "new-password" : "current-password"
              }
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호 (8자 이상)"
              className="w-full px-3 py-2 text-sm border-2"
              style={{
                background: "var(--px-bg3)",
                borderColor: "var(--px-border)",
                color: "var(--px-text)",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="ui-primary-btn w-full py-3 text-sm"
            >
              {loading
                ? "처리 중..."
                : emailMode === "signup"
                  ? "가입하기"
                  : "로그인하기"}
            </button>
            <p
              className="text-[10px] font-bold leading-snug"
              style={{ color: "var(--px-text2)" }}
            >
              가입 시 확인 메일이 올 수 있어요. 메일이 안 오면 Google을
              써주세요.
            </p>
          </form>
        )}
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
