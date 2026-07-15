"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QuestProgressBar from "@/components/diary/journey/QuestProgressBar";
import { getDiaryStorage } from "@/lib/diary/getStorage";
import { getSeason1Quests, getStreakDays } from "@/lib/diary/quests";
import type { DiaryEntry } from "@/lib/diary/types";

type MissionMenuProps = {
  /** bottom tab bar trigger */
  variant?: "button" | "tab";
};

export default function MissionMenu({ variant = "button" }: MissionMenuProps) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  const load = useCallback(async () => {
    try {
      const storage = await getDiaryStorage();
      setEntries(await storage.list());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const season = useMemo(() => getSeason1Quests(entries), [entries]);
  const streakDays = useMemo(() => getStreakDays(entries), [entries]);

  const trigger =
    variant === "tab" ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex-1 w-full flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors"
        style={{
          background: open ? "var(--px-bg3)" : "transparent",
          color: open ? "var(--px-accent)" : "var(--px-text2)",
          boxShadow: open ? "inset 0 3px 0 var(--px-accent)" : "none",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="미션"
      >
        <span className="font-black leading-none pixel-font" style={{ fontSize: "11px" }}>
          任
        </span>
        <span className="text-xs font-bold">미션</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 w-9 h-9 flex items-center justify-center border-2 text-xs font-black"
        style={{
          borderColor: open ? "var(--px-accent)" : "var(--px-border)",
          background: open ? "var(--px-bg3)" : "var(--px-bg2)",
          color: "var(--px-accent)",
          boxShadow: "2px 2px 0 #000",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="메뉴 · 미션"
        title="메뉴"
      >
        ☰
      </button>
    );

  return (
    <>
      {trigger}

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(0,0,0,0.45)" }}
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[100] left-2 right-2 max-h-[70dvh] overflow-y-auto border-2 p-3 space-y-3"
            style={{
              bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
              background: "var(--px-bg2)",
              borderColor: "var(--px-accent)",
              boxShadow: "4px 4px 0 #000",
            }}
            role="dialog"
            aria-label="미션 메뉴"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                ■ 미션
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-bold px-2 py-1 border"
                style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
              >
                닫기
              </button>
            </div>

            {season.allComplete ? (
              <p className="ui-guide">이번 주 여정을 모두 완료했어요.</p>
            ) : (
              <QuestProgressBar season={season} streakDays={streakDays} />
            )}
          </div>
        </>
      )}
    </>
  );
}
