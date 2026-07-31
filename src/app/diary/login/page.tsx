"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InstallAppButton from "@/components/InstallAppButton";
import LocalImportPanel from "@/components/diary/LocalImportPanel";
import { getIndexedDbStorage } from "@/lib/diary/indexedDbStorage";
import {
  getDiaryStorage,
  resetDiaryStorageCache,
} from "@/lib/diary/getStorage";
import {
  syncLocalSajuProfileToAccount,
  clearLocalAccountScopedState,
  reconcileLocalStateWithAuthUser,
} from "@/lib/diary/profileStorage";
import { disableGuestMode, enableGuestMode } from "@/lib/auth/guestMode";
import type { DiaryEntry } from "@/lib/diary/types";
import type { DiaryStorage } from "@/lib/diary/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportReady = {
  localEntries: DiaryEntry[];
  remoteEntries: DiaryEntry[];
  remoteStorage: DiaryStorage;
};

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importReady, setImportReady] = useState<ImportReady | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const oauthHandled = useRef(false);
  const nextPathRef = useRef<string | null>(null);

  const goHomeOrNext = useCallback(() => {
    window.location.href = nextPathRef.current ?? "/";
  }, []);

  const prepareImportPrompt = async (): Promise<boolean> => {
    resetDiaryStorageCache();
    await syncLocalSajuProfileToAccount();
    const localStorage = getIndexedDbStorage();
    const localEntries = await localStorage.list();
    setHasLocalBackup(localEntries.length > 0);
    if (localEntries.length === 0) {
      return false;
    }
    const remoteStorage = await getDiaryStorage();
    const remoteEntries = await remoteStorage.list();
    setImportReady({ localEntries, remoteEntries, remoteStorage });
    return true;
  };

  const refreshLocalBackupFlag = useCallback(async () => {
    try {
      const localEntries = await getIndexedDbStorage().list();
      setHasLocalBackup(localEntries.length > 0);
    } catch {
      setHasLocalBackup(false);
    }
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
        disableGuestMode();
        setCurrentEmail(data.user.email ?? "소셜 계정");
        await refreshLocalBackupFlag();
      } else {
        setCurrentEmail(null);
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
      };
      setMessage(messages[authError] ?? "소셜 로그인에 실패했습니다.");
      setShowLoginForm(true);
    } else if (
      !oauthHandled.current &&
      (params.get("oauth") === "success" || params.get("email") === "confirmed")
    ) {
      oauthHandled.current = true;
      setLoading(true);
      void prepareImportPrompt()
        .then((needsImport) => {
          if (!needsImport) {
            goHomeOrNext();
            return;
          }
          setMessage("이 기기 옛 기록을 계정에 합칠까요?");
        })
        .catch(() => {
          setMessage("로그인은 완료됐지만 로컬 기록을 확인하지 못했습니다.");
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleLogin = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("로그인 서버가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setMessage("");
    disableGuestMode();
    void import("@/lib/analytics/posthog")
      .then(({ ANALYTICS_EVENTS, captureEvent }) => {
        captureEvent(ANALYTICS_EVENTS.authGoogleClicked);
      })
      .catch(() => undefined);
    const next = encodeURIComponent(
      nextPathRef.current
        ? `/diary/login?oauth=success&next=${encodeURIComponent(nextPathRef.current)}`
        : "/diary/login?oauth=success"
    );
    const redirectTo = `${window.location.origin}/auth/callback?next=${next}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { hl: "ko", prompt: "select_account" },
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("로그인 서버가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setMessage("");
    disableGuestMode();

    try {
      void import("@/lib/analytics/posthog")
        .then(({ ANALYTICS_EVENTS, captureEvent }) => {
          captureEvent(ANALYTICS_EVENTS.authEmailSubmitted, { mode });
        })
        .catch(() => undefined);
      if (mode === "signup") {
        const next = encodeURIComponent(
          nextPathRef.current
            ? `/diary/login?email=confirmed&next=${encodeURIComponent(nextPathRef.current)}`
            : "/diary/login?email=confirmed"
        );
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${next}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          setCurrentEmail(data.user?.email ?? email);
          setShowLoginForm(false);
          const needsImport = await prepareImportPrompt();
          if (!needsImport) {
            goHomeOrNext();
            return;
          }
          setMessage("이 기기 옛 기록을 계정에 합칠까요?");
        } else {
          setMessage("가입 메일을 보냈어요. 메일 확인 후 로그인해 주세요.");
          setMode("login");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setCurrentEmail(data.user.email ?? email);
        setShowLoginForm(false);
        const needsImport = await prepareImportPrompt();
        if (!needsImport) {
          goHomeOrNext();
          return;
        }
        setMessage("이 기기 옛 기록을 계정에 합칠까요?");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      await supabase.auth.signOut();
      reconcileLocalStateWithAuthUser(null);
      clearLocalAccountScopedState({ notify: true });
      resetDiaryStorageCache();
      setCurrentEmail(null);
      setShowLoginForm(true);
      setImportReady(null);
      setHasLocalBackup(false);
      setMessage("로그아웃했어요.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "로그아웃에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      await supabase.auth.signOut();
      reconcileLocalStateWithAuthUser(null);
      clearLocalAccountScopedState({ notify: true });
      resetDiaryStorageCache();
      setCurrentEmail(null);
      setShowLoginForm(true);
      setImportReady(null);
      setMode("login");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "전환에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const startManualImport = async () => {
    setLoading(true);
    setMessage("");
    try {
      const needsImport = await prepareImportPrompt();
      if (!needsImport) {
        setMessage("가져올 로컬 기록이 없어요.");
      }
    } catch {
      setMessage("로컬 기록을 확인하지 못했어요.");
    } finally {
      setLoading(false);
    }
  };

  const loggedIn = Boolean(currentEmail);

  if (!authReady) {
    return <p className="ui-hint p-4">불러오는 중…</p>;
  }

  return (
    <div className="max-w-md mx-auto space-y-4 pb-8">
      <header>
        <h2
          className="text-xl font-black"
          style={{ color: "var(--px-accent)" }}
        >
          계정 및 설정
        </h2>
      </header>

      {importReady && (
        <LocalImportPanel
          localEntries={importReady.localEntries}
          remoteEntries={importReady.remoteEntries}
          remoteStorage={importReady.remoteStorage}
          onSkip={goHomeOrNext}
          onComplete={goHomeOrNext}
        />
      )}

      {!importReady && (
        <Section title="계정">
          {loggedIn && !showLoginForm ? (
            <div className="space-y-3">
              <div
                className="p-3.5 border-2"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg2)",
                }}
              >
                <p
                  className="text-base font-black break-all"
                  style={{ color: "var(--px-text-on-panel)" }}
                >
                  {currentEmail}
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
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={loading}
                className="w-full px-4 py-3.5 text-base font-black border-2"
                style={{
                  background: "#fff",
                  borderColor: "#111",
                  color: "#111",
                }}
              >
                Google로 계속하기
              </button>

              <div className="flex items-center gap-2" aria-hidden="true">
                <span
                  className="h-px flex-1"
                  style={{ background: "var(--px-border)" }}
                />
                <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
                  또는
                </span>
                <span
                  className="h-px flex-1"
                  style={{ background: "var(--px-border)" }}
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일"
                  aria-label="이메일"
                  required
                  className="w-full px-3 py-3 text-base border-2"
                  style={{
                    background: "var(--px-bg2)",
                    borderColor: "var(--px-border)",
                    color: "var(--px-text)",
                  }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  aria-label="비밀번호"
                  required
                  minLength={8}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  className="w-full px-3 py-3 text-base border-2"
                  style={{
                    background: "var(--px-bg2)",
                    borderColor: "var(--px-border)",
                    color: "var(--px-text)",
                  }}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3.5 text-base font-black border-2"
                    style={{
                      background: "var(--px-accent)",
                      borderColor: "#000",
                      color: "#000",
                    }}
                  >
                    {loading
                      ? "처리 중..."
                      : mode === "login"
                        ? "로그인"
                        : "가입하기"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMode(mode === "login" ? "signup" : "login")
                    }
                    className="px-4 py-3.5 text-sm font-bold border-2"
                    style={{
                      borderColor: "var(--px-border)",
                      color: "var(--px-text2)",
                    }}
                  >
                    {mode === "login" ? "가입" : "로그인"}
                  </button>
                </div>
              </form>

              {!loggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    enableGuestMode();
                    window.location.href = "/";
                  }}
                  className="w-full py-2 text-sm font-bold underline"
                  style={{ color: "var(--px-text2)", background: "transparent" }}
                >
                  로그인 없이 둘러보기
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      {!importReady && (
        <Section title="설정">
          <InstallAppButton />
          {loggedIn && !showLoginForm && hasLocalBackup && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void startManualImport()}
              className="w-full px-3 py-3.5 text-sm font-black border-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
                color: "var(--px-text-on-panel)",
              }}
            >
              이 기기 옛 기록 합치기
            </button>
          )}
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
