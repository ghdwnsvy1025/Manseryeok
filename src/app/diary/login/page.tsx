"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import InstallAppButton from "@/components/InstallAppButton";
import LocalImportPanel from "@/components/diary/LocalImportPanel";
import { getIndexedDbStorage } from "@/lib/diary/indexedDbStorage";
import {
  getDiaryStorage,
  resetDiaryStorageCache,
} from "@/lib/diary/getStorage";
import { syncLocalSajuProfileToAccount } from "@/lib/diary/profileStorage";
import type { DiaryEntry } from "@/lib/diary/types";
import type { DiaryStorage } from "@/lib/diary/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Provider } from "@supabase/supabase-js";

type ImportReady = {
  localEntries: DiaryEntry[];
  remoteEntries: DiaryEntry[];
  remoteStorage: DiaryStorage;
};

export default function DiaryLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importReady, setImportReady] = useState<ImportReady | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const oauthHandled = useRef(false);

  const prepareImportPrompt = async (): Promise<boolean> => {
    resetDiaryStorageCache();
    await syncLocalSajuProfileToAccount();
    const localStorage = getIndexedDbStorage();
    const localEntries = await localStorage.list();
    if (localEntries.length === 0) {
      return false;
    }
    const remoteStorage = await getDiaryStorage();
    const remoteEntries = await remoteStorage.list();
    setImportReady({ localEntries, remoteEntries, remoteStorage });
    return true;
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user ? data.user.email ?? "소셜 계정" : null);
    });

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("authError");
    if (authError) {
      const messages: Record<string, string> = {
        missing_code: "로그인 인증 코드가 없습니다. 다시 시도해주세요.",
        not_configured: "Supabase 환경 변수가 설정되지 않았습니다.",
        exchange_failed: "로그인 세션을 만들지 못했습니다. 다시 시도해주세요.",
      };
      setMessage(messages[authError] ?? "소셜 로그인에 실패했습니다.");
      return;
    }

    if (
      oauthHandled.current ||
      (params.get("oauth") !== "success" && params.get("email") !== "confirmed")
    ) {
      return;
    }

    oauthHandled.current = true;
    setLoading(true);
    void prepareImportPrompt()
      .then((needsImport) => {
        if (!needsImport) {
          window.location.replace("/");
          return;
        }
        setMessage(
          "로그인되었습니다. 이 기기의 기존 기록을 계정으로 가져올지 선택해주세요."
        );
      })
      .catch(() => {
        setMessage("로그인은 완료됐지만 로컬 기록을 확인하지 못했습니다.");
      })
      .finally(() => setLoading(false));
    // 최초 OAuth 콜백 처리에서만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSocialLogin = async (provider: Extract<Provider, "google" | "kakao">) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setMessage("");
    const next = encodeURIComponent("/diary/login?oauth=success");
    const redirectTo = `${window.location.origin}/auth/callback?next=${next}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (error) {
      setLoading(false);
      setMessage(
        `${provider === "google" ? "Google" : "카카오"} 로그인을 시작하지 못했습니다. 관리자 설정을 확인해주세요.`
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 환경 변수가 설정되지 않았습니다.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const next = encodeURIComponent("/diary/login?email=confirmed");
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
          const needsImport = await prepareImportPrompt();
          if (!needsImport) {
            window.location.href = "/";
            return;
          }
          setMessage("가입과 로그인이 완료되었습니다. 로컬 기록을 가져올지 선택해주세요.");
        } else {
          setMessage("가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해주세요.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setCurrentEmail(data.user.email ?? email);
        const needsImport = await prepareImportPrompt();
        if (!needsImport) {
          window.location.href = "/";
          return;
        }
        setMessage("로그인되었습니다. 로컬 기록을 가져올지 선택해주세요.");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "인증에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    resetDiaryStorageCache();
    setImportReady(null);
    setCurrentEmail(null);
    setMessage("로그아웃되었습니다.");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
        ■ 일기 동기화 로그인
      </h2>
      <p className="text-xs" style={{ color: "var(--px-text2)" }}>
        로그인하면 사주 프로필과 일기를 안전하게 백업하고 다른 기기에서도 이어서
        사용할 수 있습니다. 로그인하지 않아도 이 기기에는 저장됩니다.
      </p>

      {!importReady && !currentEmail && (
        <div className="space-y-3">
          <div
            className="space-y-2 p-4 border-2"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border)",
            }}
          >
            <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
              간편 로그인
            </p>
            <button
              type="button"
              onClick={() => void handleSocialLogin("google")}
              disabled={loading}
              className="w-full px-4 py-3 text-sm font-bold border-2"
              style={{
                background: "#fff",
                borderColor: "#111",
                color: "#111",
              }}
            >
              Google로 계속하기
            </button>
            <button
              type="button"
              onClick={() => void handleSocialLogin("kakao")}
              disabled={loading}
              className="w-full px-4 py-3 text-sm font-bold border-2"
              style={{
                background: "#FEE500",
                borderColor: "#191919",
                color: "#191919",
              }}
            >
              카카오로 계속하기
            </button>
            <p className="ui-hint">
              소셜 로그인에서는 제공자가 전달하는 계정 식별 정보만 사용하며, 사주
              정보와 일기 원문은 로그인 제공자에게 보내지 않습니다.
            </p>
          </div>

          <div className="flex items-center gap-2" aria-hidden="true">
            <span className="h-px flex-1" style={{ background: "var(--px-border)" }} />
            <span className="text-[11px]" style={{ color: "var(--px-text2)" }}>
              또는 이메일
            </span>
            <span className="h-px flex-1" style={{ background: "var(--px-border)" }} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-3 p-4 border-2"
            style={{
              background: "var(--px-bg3)",
              borderColor: "var(--px-border)",
            }}
          >
            <p className="ui-hint">
              {mode === "signup"
                ? "가입에는 이메일과 비밀번호만 필요합니다. 이름·전화번호·생년월일은 받지 않습니다."
                : "이메일 계정으로 로그인하세요."}
            </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일"
            required
            className="w-full px-3 py-2 text-sm border-2"
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
            required
            minLength={8}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="w-full px-3 py-2 text-sm border-2"
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
              className="flex-1 px-4 py-2 text-xs font-bold border-2"
              style={{ background: "var(--px-accent)", borderColor: "#000", color: "#000" }}
            >
              {loading ? "처리 중..." : mode === "login" ? "로그인" : "가입"}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="px-3 py-2 text-xs font-bold border"
              style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            >
              {mode === "login" ? "가입" : "로그인"}
            </button>
          </div>
          </form>
        </div>
      )}

      {importReady && (
        <LocalImportPanel
          localEntries={importReady.localEntries}
          remoteEntries={importReady.remoteEntries}
          remoteStorage={importReady.remoteStorage}
          onSkip={() => {
            window.location.href = "/";
          }}
          onComplete={() => {
            window.location.href = "/";
          }}
        />
      )}

      {currentEmail && (
        <div className="flex items-center justify-between gap-2">
          <p className="ui-hint">{currentEmail} 계정으로 로그인됨</p>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-bold underline"
            style={{ color: "var(--px-text2)" }}
          >
            로그아웃
          </button>
        </div>
      )}

      {message && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {message}
        </p>
      )}

      <Link href="/diary" className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
        ← 일기로 돌아가기
      </Link>

      <InstallAppButton />
    </div>
  );
}
