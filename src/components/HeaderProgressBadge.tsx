"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  computeJournalStreak,
  JOURNAL_PROGRESS_CHANGED_EVENT,
} from "@/lib/journal/streak";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { SAJU_PROFILE_CHANGED_EVENT } from "@/lib/diary/profileStorage";
import { todayDateString } from "@/lib/diary/dayPillar";
import {
  HEADER_BADGE_PULSE_EVENT,
  type HeaderBadgePulseDetail,
} from "@/lib/ui/motionEvents";

/**
 * 헤더 오른쪽 — 오늘 기록 여부 (CTA)
 */
export default function HeaderProgressBadge() {
  const [recordedToday, setRecordedToday] = useState<boolean | null>(null);
  const [pulse, setPulse] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const storage = await getJournalStorage();
      const list = await storage.list();
      const dates = list.map((e) => e.entryDate);
      const streak = computeJournalStreak(dates, todayDateString());
      setRecordedToday(streak.recordedToday);
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

  if (recordedToday == null) {
    return (
      <div
        className="w-20 h-9 border shrink-0"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        aria-hidden
      />
    );
  }

  if (recordedToday) {
    return (
      <Link
        href="/journal"
        className={`shrink-0 px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap${
          pulse ? " header-badge-ring-pulse" : ""
        }`}
        style={{
          borderColor: "var(--signal-condition)",
          background:
            "color-mix(in srgb, var(--signal-condition) 16%, var(--px-bg3))",
          color: "var(--signal-condition)",
          boxShadow: "2px 2px 0 #000",
        }}
        aria-label="오늘 기록 완료, 일기 보기"
      >
        오늘 완료
      </Link>
    );
  }

  return (
    <Link
      href="/journal"
      className={`shrink-0 px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap${
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
  );
}
