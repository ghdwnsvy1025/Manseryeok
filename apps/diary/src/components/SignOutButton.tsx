"use client";

import { useEffect, useState, useTransition } from "react";
import { signOutAction } from "@/app/actions";
import { CONFIRM_WINDOW_MS } from "./ClearAllButton";

/**
 * Google 사용자용 로그아웃 (전수조사 C "로그아웃 확인 없음").
 * ClearAllButton과 같은 방식 — 창 대신 두 번 누르기: 한 번 누르면 "정말 로그아웃"으로 바뀌고, 5초 안에 다시 누르면 실행한다.
 */
export function SignOutButton() {
  const [busy, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  function press() {
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={busy}
      aria-live="polite"
      className={`tap text-sm text-muted underline underline-offset-4 disabled:opacity-60 ${armed ? "font-bold text-ink" : ""}`}
    >
      {busy ? "나가는 중…" : armed ? "정말 로그아웃" : "로그아웃"}
    </button>
  );
}
