"use client";

import { useTransition } from "react";
import { signOutAction } from "@/app/actions";

/**
 * 익명 사용자용 "기록 모두 지우기" (docs/ANON_START.md 3절).
 * 실제로는 로그아웃이다 — 익명 세션이 끊기면 이 기기에서 그 기록을 다시 볼 수 없다. 확인 한 번.
 */
export function ClearAllButton() {
  const [busy, startTransition] = useTransition();

  function clear() {
    if (!window.confirm("이 기기의 기록을 모두 지울까요? Google로 연결하지 않은 기록은 되돌릴 수 없어요.")) return;
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <button type="button" onClick={clear} disabled={busy} className="text-sm text-danger underline underline-offset-4 disabled:opacity-60">
      {busy ? "지우는 중…" : "기록 모두 지우기"}
    </button>
  );
}
