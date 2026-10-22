"use client";

import { useEffect, useState, useTransition } from "react";
import { deleteAllAction } from "@/app/actions";
import { track } from "@/lib/analytics";

/** 첫 누름 뒤 이 시간 안에 다시 눌러야 지운다. 지나면 처음으로 돌아간다 */
export const CONFIRM_WINDOW_MS = 5000;

/**
 * 익명 사용자용 "기록 모두 지우기" (docs/ANON_START.md 3절, B9).
 * 서버의 본인 행을 전부 지우고 계정까지 지운다 (deleteAllAction). 확인은 창 대신 버튼 두 번 누르기 —
 * 한 번 누르면 "정말 지우기"로 바뀌고, 5초 안에 다시 누르면 실행한다.
 * 라벨이 "기록 모두 지우기"인데 실제로는 계정(생년월일 포함)까지 지우므로, 두 번째 라벨에 지워지는 범위를 적는다 (전체검토 D-H-2).
 */
export function ClearAllButton({ entryCount }: { entryCount: number }) {
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
    track("clear_all", { entries: entryCount });
    startTransition(async () => {
      await deleteAllAction();
    });
  }

  return (
    <button
      type="button"
      onClick={press}
      disabled={busy}
      aria-live="polite"
      className={`tap text-sm underline underline-offset-4 disabled:opacity-60 ${armed ? "font-bold text-danger" : "text-danger"}`}
    >
      {busy ? "지우는 중…" : armed ? `정말 지우기 — 기록 ${entryCount}건과 생년월일이 사라져요` : "기록과 생년월일 모두 지우기"}
    </button>
  );
}
