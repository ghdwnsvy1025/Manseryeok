"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InstallAppButton from "@/components/InstallAppButton";
import LocalImportPanel from "@/components/diary/LocalImportPanel";
import LocalJournalImportPanel from "@/components/diary/LocalJournalImportPanel";
import { getIndexedDbStorage } from "@/lib/diary/indexedDbStorage";
import {
  getDiaryStorage,
  resetDiaryStorageCache,
} from "@/lib/diary/getStorage";
import {
  syncLocalSajuProfileToAccount,
  clearLocalAccountScopedState,
  reconcileLocalStateWithAuthUser,
  loadPrimarySajuProfile,
} from "@/lib/diary/profileStorage";
import { disableGuestMode } from "@/lib/auth/guestMode";
import { takeAuthNextPath } from "@/lib/auth/redirectOrigin";
import type { DiaryEntry } from "@/lib/diary/types";
import type { DiaryStorage } from "@/lib/diary/storage";
import type { JournalEntry } from "@/lib/journal/types";
import type { JournalStorage } from "@/lib/journal/storage";
import { listAllLocalJournalEntries } from "@/lib/journal/indexedDbStorage";
import {
  getJournalStorage,
  resetJournalStorageCache,
} from "@/lib/journal/getStorage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import WelcomeAuthGate from "@/components/auth/WelcomeAuthGate";
import { useRouter } from "next/navigation";

type JournalImportReady = {
  kind: "journal";
  localEntries: JournalEntry[];
  remoteEntries: JournalEntry[];
  remoteStorage: JournalStorage;
  remoteSajuProfileId: string;
};

type DiaryImportReady = {
  kind: "diary";
  localEntries: DiaryEntry[];
  remoteEntries: DiaryEntry[];
  remoteStorage: DiaryStorage;
};

type ImportReady = JournalImportReady | DiaryImportReady;

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
  const [importReady, setImportReady] = useState<ImportReady | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const oauthHandled = useRef(false);
  const nextPathRef = useRef<string | null>(null);

  const goHomeOrNext = useCallback(() => {
    const stashed = takeAuthNextPath(nextPathRef.current ?? "/");
    window.location.href = stashed;
  }, []);

  const prepareImportPrompt = async (): Promise<boolean> => {
    resetDiaryStorageCache();
    resetJournalStorageCache();
    // 로컬 일기 스냅샷을 프로필 동기화 전에 확보 (프로필 id가 바뀌어도 IDB 원본 유지)
    const localJournal = await listAllLocalJournalEntries();
    const localDiary = await getIndexedDbStorage().list();
    setHasLocalBackup(localJournal.length > 0 || localDiary.length > 0);

    await syncLocalSajuProfileToAccount();
    const primary = await loadPrimarySajuProfile();
    const remoteProfileId = primary?.id ?? null;

    if (localJournal.length > 0 && remoteProfileId) {
      const remoteStorage = await getJournalStorage();
      const remoteEntries = await remoteStorage.list();
      setImportReady({
        kind: "journal",
        localEntries: localJournal,
        remoteEntries,
        remoteStorage,
        remoteSajuProfileId: remoteProfileId,
      });
      return true;
    }

    if (localDiary.length > 0) {
      const remoteStorage = await getDiaryStorage();
      const remoteEntries = await remoteStorage.list();
      setImportReady({
        kind: "diary",
        localEntries: localDiary,
        remoteEntries,
        remoteStorage,
      });
      return true;
    }

    return false;
  };

  const refreshLocalBackupFlag = useCallback(async () => {
    try {
      const [journal, diary] = await Promise.all([
        listAllLocalJournalEntries(),
        getIndexedDbStorage().list(),
      ]);
      setHasLocalBackup(journal.length > 0 || diary.length > 0);
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
        setAuthProvider(String(data.user.app_metadata?.provider ?? "email"));
        await refreshLocalBackupFlag();
      } else {
        setCurrentEmail(null);
        setAuthProvider(null);
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
          setMessage("이 기기 기록을 계정에 합칠까요? 선택하거나 건너뛸 수 있어요.");
        })
        .catch(() => {
          setMessage("로그인은 완료됐지만 로컬 기록을 확인하지 못했습니다.");
        })
        .finally(() => setLoading(false));
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
      setShowLoginForm(true);
      setImportReady(null);
      await refreshLocalBackupFlag();
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
      disableGuestMode();
      reconcileLocalStateWithAuthUser(null);
      clearLocalAccountScopedState({ notify: true });
      resetDiaryStorageCache();
      resetJournalStorageCache();
      setCurrentEmail(null);
      setAuthProvider(null);
      setShowLoginForm(true);
      setImportReady(null);
      await refreshLocalBackupFlag();
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
      } else {
        setMessage("이 기기 기록을 계정에 합칠까요? 선택하거나 건너뛸 수 있어요.");
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

  const showAuthGate = !importReady && (!loggedIn || showLoginForm);
  const showAccountPanel = !importReady && loggedIn && !showLoginForm;

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

      {importReady?.kind === "journal" && (
        <LocalJournalImportPanel
          localEntries={importReady.localEntries}
          remoteEntries={importReady.remoteEntries}
          remoteStorage={importReady.remoteStorage}
          remoteSajuProfileId={importReady.remoteSajuProfileId}
          onSkip={goHomeOrNext}
          onComplete={goHomeOrNext}
        />
      )}

      {importReady?.kind === "diary" && (
        <LocalImportPanel
          localEntries={importReady.localEntries}
          remoteEntries={importReady.remoteEntries}
          remoteStorage={importReady.remoteStorage}
          onSkip={goHomeOrNext}
          onComplete={goHomeOrNext}
        />
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
            </div>
            {hasLocalBackup && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void startManualImport()}
                className="w-full px-4 py-3.5 text-base font-black border-2"
                style={{
                  borderColor: "var(--px-accent)",
                  background: "var(--px-bg2)",
                  color: "var(--px-text-on-panel)",
                  boxShadow: "3px 3px 0 #000",
                }}
              >
                이 기기 기록 가져오기
              </button>
            )}
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
          onGuest={() => {
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
