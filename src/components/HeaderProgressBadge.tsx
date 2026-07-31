"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  JOURNAL_PROGRESS_CHANGED_EVENT,
} from "@/lib/journal/streak";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { SAJU_PROFILE_CHANGED_EVENT } from "@/lib/diary/profileStorage";
import { todayDateString } from "@/lib/diary/dayPillar";
import {
  formatPersonalizationLevel,
  progressFromTotalXp,
  totalJournalXp,
} from "@/lib/product/personalizationLevel";
import {
  HEADER_BADGE_PULSE_EVENT,
  type HeaderBadgePulseDetail,
} from "@/lib/ui/motionEvents";

/**
 * 헤더 오른쪽 — 레벨 + 오늘 미기록 시 쓰기 CTA
 */
export default function HeaderProgressBadge() {
  const [levelLabel, setLevelLabel] = useState<string | null>(null);
  const [recordedToday, setRecordedToday] = useState<boolean | null>(null);
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const storage = await getJournalStorage();
      const list = await storage.list();
      const today = todayDateString();
      setRecordedToday(list.some((e) => e.entryDate === today));
      const progress = progressFromTotalXp(totalJournalXp(list));
      setLevelLabel(formatPersonalizationLevel(progress.level));
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onProgress = () => void refresh();
    window.addEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onProgress);
    const onPulse = (ev: Event) => {
      const detail = (ev as CustomEvent<HeaderBadgePulseDetail>).detail ?? {};
      if (detail.ring !== false || detail.streak !== false) {
        setPulse(false);
        requestAnimationFrame(() => setPulse(true));
        window.setTimeout(() => setPulse(false), 500);
      }
      void refresh();
    };
    window.addEventListener(HEADER_BADGE_PULSE_EVENT, onPulse);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onProgress);
      window.removeEventListener(HEADER_BADGE_PULSE_EVENT, onPulse);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  if (levelLabel == null || recordedToday == null) {
    return (
      <div
        className="w-16 h-9 border shrink-0"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        aria-hidden
      />
    );
  }

  if (!recordedToday) {
    return (
      <div className="shrink-0 flex items-center gap-1.5">
        <span
          className="text-[11px] font-black tabular-nums px-1"
          style={{ color: "var(--px-text2)" }}
          aria-label={`개인화 레벨 ${levelLabel}`}
        >
          {levelLabel}
        </span>
        <Link
          href="/journal"
          className={`px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap${
            pulse ? " header-badge-streak-pop" : ""
          }`}
          style={{
            borderColor: "var(--px-accent)",
            background: "color-mix(in srgb, var(--px-accent) 18%, var(--px-bg3))",
            color: "var(--px-accent)",
            boxShadow: "2px 2px 0 #000",
          }}
          aria-label="오늘 아직 기록 안 함, 일기 쓰기로 이동"
        >
          오늘 쓰기
        </Link>
      </div>
    );
  }

  return (
    <Link
      href="/stats"
      className={`shrink-0 px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap tabular-nums${
        pulse ? " header-badge-ring-pulse" : ""
      }`}
      style={{
        borderColor: "var(--signal-condition)",
        background:
          "color-mix(in srgb, var(--signal-condition) 16%, var(--px-bg3))",
        color: "var(--signal-condition)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label={`개인화 레벨 ${levelLabel}, 기록 보기`}
    >
      {levelLabel}
    </Link>
  );
}
