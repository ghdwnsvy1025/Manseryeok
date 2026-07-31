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
} from "@/lib/auth/anonymousSession";
import { autoMigrateLocalJournalToAccount } from "@/lib/auth/autoMigrateLocalJournal";
import { disableGuestMode, enableGuestMode } from "@/lib/auth/guestMode";
import { takeAuthNextPath } from "@/lib/auth/redirectOrigin";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";
import { resetJournalStorageCache } from "@/lib/journal/getStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import WelcomeAuthGate from "@/components/auth/WelcomeAuthGate";
import { useRouter } from "next/navigation";

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

export default function DiaryLoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [authReady, setAuthReady] = useState(false);
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
      setAuthReady(true);
      setShowLoginForm(true);
      return;
    }

    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const anon = isAnonymousUser(data.user);
        setIsAnonymous(anon);
        if (anon) {
          enableGuestMode();
          setCurrentEmail(null);
          setAuthProvider("anonymous");
          setShowLoginForm(true);
        } else {
          disableGuestMode();
          setCurrentEmail(data.user.email ?? "소셜 계정");
          setAuthProvider(String(data.user.app_metadata?.provider ?? "google"));
          setShowLoginForm(false);
        }
      } else {
        setCurrentEmail(null);
        setAuthProvider(null);
        setIsAnonymous(false);
        setShowLoginForm(true);
      }
      setAuthReady(true);
    })();

    const authError = params.get("authError");
    if (authError) {
      const messages: Record<string, string> = {
        missing_code: "로그인 인증 코드가 없습니다. 다시 시도해주세요.",
        not_configured: "로그인 서버가 설정되지 않았습니다.",
        exchange_failed: "로그인 세션을 만들지 못했습니다. 다시 시도해주세요.",
        identity_already_exists:
          "이미 가입된 Google 계정이에요. 익명 기록은 그대로 두고, 그 Google 계정으로는 따로 로그인해야 해요.",
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
          const migrated = await autoMigrateLocalJournalToAccount();
          if (migrated.uploaded > 0) {
            setMessage(`이 기기 기록 ${migrated.uploaded}건을 계정에 이어 담았어요.`);
          }
          // linkIdentity 성공 시 user_id 동일 — 선택 UI 없이 바로 홈
          goHomeOrNext();
        } catch {
          setMessage("로그인은 완료됐지만 기록을 확인하지 못했어요.");
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
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      await supabase.auth.signOut();
      disableGuestMode();
      reconcileLocalStateWithAuthUser(null);
      clearLocalAccountScopedState({ notify: true });
      resetDiaryStorageCache();
      resetJournalStorageCache();
      setCurrentEmail(null);
      setAuthProvider(null);
      setIsAnonymous(false);
      setShowLoginForm(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "로그아웃에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    await handleLogout();
  };

  const loggedInGoogle = Boolean(currentEmail) && !isAnonymous;

  if (!authReady) {
    return <p className="ui-hint p-4">불러오는 중…</p>;
  }

  const showAuthGate = !loggedInGoogle || showLoginForm;
  const showAccountPanel = loggedInGoogle && !showLoginForm;

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      {!showAuthGate && (
        <header>
          <h2
            className="text-xl font-black"
            style={{ color: "var(--px-accent)" }}
          >
            계정 및 설정
          </h2>
        </header>
      )}

      {showAccountPanel && (
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
                {authProvider === "google" ? "Google 계정" : "로그인됨"}
              </p>
              {currentEmail && currentEmail !== "소셜 계정" && (
                <p
                  className="text-xs font-bold break-all"
                  style={{ color: "var(--px-text2)" }}
                >
                  {currentEmail}
                </p>
              )}
              <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
                비로그인(익명)에서 Google로 바꾸면 기록이 같은 계정으로 이어집니다.
              </p>
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
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleSwitchAccount()}
              className="w-full py-2 text-sm font-bold underline"
              style={{ color: "var(--px-text2)", background: "transparent" }}
            >
              다른 계정으로 전환
            </button>
          </div>
        </Section>
      )}

      {showAuthGate && (
        <WelcomeAuthGate
          authNextPath={
            nextPathRef.current
              ? `/diary/login?oauth=success&next=${encodeURIComponent(nextPathRef.current)}`
              : "/diary/login?oauth=success"
          }
          onGuest={async () => {
            await ensureAnonymousSession();
            void autoMigrateLocalJournalToAccount();
            router.push("/");
          }}
        />
      )}

      {showAccountPanel && (
        <Section title="설정">
          <InstallAppButton surface="settings" />
        </Section>
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
