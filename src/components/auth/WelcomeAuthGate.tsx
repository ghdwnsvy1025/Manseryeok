"use client";

import { useState } from "react";
import { enableGuestMode, disableGuestMode } from "@/lib/auth/guestMode";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  onGuest: () => void;
};

type EmailMode = "login" | "signup";

function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl("/diary/login?oauth=success"),
        queryParams: { hl: "ko" },
      },
    });
    if (error) {
      setLoading(false);
      setMessage("Google 로그인을 시작하지 못했습니다.");
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
      if (emailMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl("/diary/login?email=confirmed"),
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
      setMessage(
        error instanceof Error ? error.message : "이메일 인증에 실패했습니다."
      );
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
          className="w-full px-4 py-3 text-sm font-bold border-2"
          style={{ background: "#fff", borderColor: "#111", color: "#111" }}
        >
          Google로 계속하기
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => setShowEmail((value) => !value)}
          className="w-full px-4 py-3 text-sm font-bold border-2"
          style={{
            background: "var(--px-bg2)",
            borderColor: "var(--px-accent)",
            color: "var(--px-accent)",
          }}
          aria-expanded={showEmail}
        >
          이메일로 계속하기
        </button>

        {showEmail && (
          <form
            onSubmit={submitEmail}
            className="mt-2 p-3 border space-y-2"
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
        className="w-full px-4 py-3 text-sm font-bold border-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border)",
          color: "var(--px-text2)",
        }}
      >
        비로그인으로 시작
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
