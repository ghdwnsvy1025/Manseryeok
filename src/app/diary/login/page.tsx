"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InstallAppButton from "@/components/InstallAppButton";
import {
  syncLocalSajuProfileToAccount,
  clearLocalAccountScopedState,
  reconcileLocalStateWithAuthUser,
} from "@/lib/diary/profileStorage";
import {
  ensureAnonymousSession,
  isAnonymousUser,
  startGoogleAuth,
} from "@/lib/auth/anonymousSession";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { disableGuestMode, enableGuestMode, isGuestMode } from "@/lib/auth/guestMode";
import {
  getAuthCallbackUrl,
  stashAuthNextPath,
  takeAuthNextPath,
} from "@/lib/auth/redirectOrigin";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import WelcomeAuthGate from "@/components/auth/WelcomeAuthGate";
import { useRouter } from "next/navigation";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="space-y-3 p-4 border-2"
      style={{
        background: "var(--px-bg3)",
        borderColor: "var(--px-border)",
        boxShadow: "3px 3px 0 #000",
      }}
    >
      <h3
        className="text-sm font-black tracking-wide"
        style={{ color: "var(--px-accent)" }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

type AuthKind = "google" | "anonymous" | "guest" | null;

export default function DiaryLoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [authKind, setAuthKind] = useState<AuthKind>(null);
  const [authReady, setAuthReady] = useState(false);
  /** 로그아웃 직후·미로그인 시 WelcomeAuthGate */
  const [showLoginForm, setShowLoginForm] = useState(false);
  const oauthHandled = useRef(false);
  const nextPathRef = useRef<string | null>(null);

  const goHomeOrNext = useCallback(() => {
    const stashed = takeAuthNextPath(nextPathRef.current ?? "/");
    window.location.href = stashed;
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const params = new URLSearchParams(window.location.search);
    nextPathRef.current = safeNextPath(params.get("next"));

    if (!supabase) {
      setAuthKind(isGuestMode() ? "guest" : null);
      setShowLoginForm(!isGuestMode());
      setAuthReady(true);
      return;
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        if (isAnonymousUser(data.user)) {
          enableGuestMode();
          setAuthKind("anonymous");
          setCurrentEmail(null);
          setShowLoginForm(false);
        } else {
          disableGuestMode();
          setAuthKind("google");
          setCurrentEmail(data.user.email ?? "소셜 계정");
          setShowLoginForm(false);
        }
      } else if (isGuestMode()) {
        setAuthKind("guest");
        setCurrentEmail(null);
        setShowLoginForm(false);
      } else {
        setAuthKind(null);
        setCurrentEmail(null);
        setShowLoginForm(true);
      }
      setAuthReady(true);
    })();

    const authError = params.get("authError");
    if (authError) {
      const messages: Record<string, string> = {
        missing_code:
          "로그인 인증을 끝내지 못했어요. Google로 다시 시도해 주세요.",
        not_configured: "로그인 서버가 설정되지 않았습니다.",
        exchange_failed: "로그인 세션을 만들지 못했습니다. 다시 시도해주세요.",
        identity_already_exists:
          "이미 가입된 Google 계정이에요. 그 계정으로 다시 로그인해 주세요.",
      };
      setMessage(messages[authError] ?? "소셜 로그인에 실패했습니다.");
      setShowLoginForm(true);
    } else if (
      !oauthHandled.current &&
      (params.get("oauth") === "success" || params.get("email") === "confirmed")
    ) {
      oauthHandled.current = true;
      setLoading(true);
      void (async () => {
        try {
          disableGuestMode();
          await syncLocalSajuProfileToAccount();
          await autoMigrateLocalJournalToAccount();
          goHomeOrNext();
        } catch {
          goHomeOrNext();
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    setLoading(true);
    setMessage("");
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      disableGuestMode();
      reconcileLocalStateWithAuthUser(null);
      clearLocalAccountScopedState({ notify: true });
      resetDiaryStorageCache();
      resetJournalStorageCache();
      setCurrentEmail(null);
      setAuthKind(null);
      setShowLoginForm(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "로그아웃에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLinkGoogle = async () => {
    setLoading(true);
    setMessage("");
    captureEvent(ANALYTICS_EVENTS.authGoogleClicked);
    await ensureAnonymousSession();
    stashAuthNextPath("/diary/login?oauth=success");
    const result = await startGoogleAuth({ redirectTo: getAuthCallbackUrl() });
    if (!result.ok) {
      setMessage(result.error ?? "Google 연결에 실패했어요.");
      setLoading(false);
    }
  };

  if (!authReady) {
    return <p className="ui-hint p-4">불러오는 중…</p>;
  }

  const showAuthGate = showLoginForm || authKind === null;
  const showAccountPanel = !showAuthGate;

  const kindLabel =
    authKind === "google"
      ? "Google 계정"
      : authKind === "anonymous"
        ? "비로그인 (익명)"
        : authKind === "guest"
          ? "비로그인 (이 기기)"
          : "알 수 없음";

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      {showAccountPanel && (
        <>
          <header>
            <h2
              className="text-xl font-black"
              style={{ color: "var(--px-accent)" }}
            >
              계정 및 설정
            </h2>
          </header>

          <Section title="계정">
            <div className="space-y-3">
              <div
                className="p-3.5 border-2 space-y-1"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg2)",
                }}
              >
                <p
                  className="text-sm font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  {kindLabel}
                </p>
                {authKind === "google" &&
                  currentEmail &&
                  currentEmail !== "소셜 계정" && (
                    <p
                      className="text-xs font-bold break-all"
                      style={{ color: "var(--px-text2)" }}
                    >
                      {currentEmail}
                    </p>
                  )}
                {(authKind === "anonymous" || authKind === "guest") && (
                  <>
                    <p
                      className="text-[11px] font-bold"
                      style={{ color: "var(--px-text2)" }}
                    >
                      Google로 이어가면 기록이 계정에 자동으로 저장돼요.
                    </p>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => void handleLinkGoogle()}
                      className="w-full px-4 py-3.5 text-base font-black border-2"
                      style={{
                        borderColor: "#000",
                        background: "var(--px-accent)",
                        color: "#111",
                        boxShadow: "3px 3px 0 #000",
                      }}
                    >
                      {loading ? "연결 중…" : "Google로 이어가기"}
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleLogout()}
                className="w-full px-4 py-3.5 text-base font-black border-2"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg2)",
                  color: "var(--px-text-on-panel)",
                }}
              >
                로그아웃
              </button>
            </div>
          </Section>

          <Section title="설정">
            <InstallAppButton surface="settings" />
          </Section>
        </>
      )}

      {showAuthGate && (
        <WelcomeAuthGate
          authNextPath="/diary/login?oauth=success"
          onGuest={async () => {
            await ensureAnonymousSession();
            void autoMigrateLocalJournalToAccount();
            setAuthKind(isGuestMode() ? "guest" : "anonymous");
            setShowLoginForm(false);
            router.push("/");
          }}
        />
      )}

      {message && (
        <p
          className="p-3.5 border-2 text-sm font-bold"
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
