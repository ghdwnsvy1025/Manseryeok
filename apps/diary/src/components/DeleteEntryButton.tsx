"use client";
// 기록 고치기 모드의 "지우기" — 두 번 누르기 확인(ClearAllButton과 같은 방식). 서버 액션은 deleteEntryAction.
import { useEffect, useState } from "react";
import { deleteEntryAction } from "@/app/actions";
import { CONFIRM_WINDOW_MS } from "./ClearAllButton";

export function DeleteEntryButton({ date }: { date: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <form
      action={deleteEntryAction}
      className="mt-4 text-center"
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
        }
      }}
    >
      <input type="hidden" name="date" value={date} />
      <button type="submit" className={`tap text-[14px] underline underline-offset-4 ${armed ? "font-bold text-ink" : "text-muted"}`}>
        {armed ? "정말 지우기 (5초 안에 다시 누르면 지워져요)" : "이 기록 지우기"}
      </button>
    </form>
  );
}
