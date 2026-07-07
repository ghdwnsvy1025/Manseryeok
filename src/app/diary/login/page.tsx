"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetDiaryStorageCache } from "@/lib/diary/getStorage";

export default function DiaryLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("가입 완료! 이메일 확인 후 로그인하거나 바로 로그인해주세요.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        resetDiaryStorageCache();
        window.location.href = "/diary";
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
    setMessage("로그아웃되었습니다.");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h2 className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
        ■ 일기 동기화 로그인
      </h2>
      <p className="text-xs" style={{ color: "var(--px-text2)" }}>
        Supabase를 설정하면 노트북·PC에서 같은 일기를 사용할 수 있습니다.
        설정하지 않으면 브라우저 로컬(IndexedDB)에만 저장됩니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 p-4 border-2" style={{ background: "var(--px-bg3)", borderColor: "var(--px-border)" }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          className="w-full px-3 py-2 text-sm border-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)", color: "var(--px-text)" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          required
          minLength={6}
          className="w-full px-3 py-2 text-sm border-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)", color: "var(--px-text)" }}
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

      <button
        type="button"
        onClick={handleLogout}
        className="text-xs font-bold underline"
        style={{ color: "var(--px-text2)" }}
      >
        로그아웃
      </button>

      {message && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {message}
        </p>
      )}

      <Link href="/diary" className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
        ← 일기로 돌아가기
      </Link>
    </div>
  );
}
