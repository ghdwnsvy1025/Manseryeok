"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  formatPersonalizationLevel,
  progressFromTotalXp,
  totalJournalXp,
  type PersonalizationLevelProgress,
} from "@/lib/product/personalizationLevel";
import {
  computeJournalStreak,
  JOURNAL_PROGRESS_CHANGED_EVENT,
  type JournalStreak,
} from "@/lib/journal/streak";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { SAJU_PROFILE_CHANGED_EVENT } from "@/lib/diary/profileStorage";
import { todayDateString } from "@/lib/diary/dayPillar";
import {
  HEADER_BADGE_PULSE_EVENT,
  type HeaderBadgePulseDetail,
} from "@/lib/ui/motionEvents";

const RING = 34;
const STROKE = 3.5;
const R = (RING - STROKE) / 2;
const C = 2 * Math.PI * R;

type Snapshot = {
  level: PersonalizationLevelProgress;
  streak: JournalStreak;
};

function LevelRing({
  ratio,
  level,
  recordedToday,
  pulse,
}: {
  ratio: number;
  level: number;
  recordedToday: boolean;
  pulse: boolean;
}) {
  const offset = C * (1 - Math.min(1, Math.max(0, ratio)));
  const ringColor = recordedToday ? "var(--px-accent)" : "var(--px-border2)";
  const label = formatPersonalizationLevel(level);
  return (
    <svg
      width={RING}
      height={RING}
      viewBox={`0 0 ${RING} ${RING}`}
      aria-hidden
      className={`shrink-0${pulse ? " header-badge-ring-pulse" : ""}`}
    >
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={R}
        fill="var(--px-bg3)"
        stroke="var(--px-border)"
        strokeWidth={STROKE}
      />
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={R}
        fill="none"
        stroke={ringColor}
        strokeWidth={STROKE}
        strokeLinecap="butt"
        strokeDasharray={C}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
        style={{ transition: "stroke-dashoffset 0.55s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill={recordedToday ? "var(--px-accent)" : "var(--px-text-on-panel)"}
        fontSize={label.length >= 4 ? "8" : "9"}
        fontWeight="800"
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * 헤더용 압축 성장 배지 — 레벨 링 + 연속일, 탭 시 상세
 */
export default function HeaderProgressBadge() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [streakPop, setStreakPop] = useState(false);
  const [ringPulse, setRingPulse] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const refresh = useCallback(async () => {
    try {
      const storage = await getJournalStorage();
      const list = await storage.list();
      const dates = list.map((e) => e.entryDate);
      const level = progressFromTotalXp(totalJournalXp(list));
      const streak = computeJournalStreak(dates, todayDateString());
      setSnap({ level, streak });
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
      if (detail.streak !== false) {
        setStreakPop(false);
        requestAnimationFrame(() => setStreakPop(true));
        window.setTimeout(() => setStreakPop(false), 450);
      }
      if (detail.ring !== false) {
        setRingPulse(false);
        requestAnimationFrame(() => setRingPulse(true));
        window.setTimeout(() => setRingPulse(false), 600);
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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 스트릭 위험 시 살짝 깜빡임
  const atRiskBlink = snap?.streak.atRisk ?? false;

  if (!snap) {
    return (
      <div
        className="w-14 h-9 border shrink-0"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        aria-hidden
      />
    );
  }

  const { level, streak } = snap;
  const streakLabel = streak.recordedToday
    ? `연속 ${streak.days} ✓`
    : streak.atRisk
      ? `연속 ${streak.days} !`
      : streak.days <= 0
        ? "오늘 시작"
        : `연속 ${streak.days}`;
  const streakColor = streak.recordedToday
    ? "var(--px-accent)"
    : streak.atRisk || !streak.recordedToday
      ? "#fbbf24"
      : "var(--px-text2)";
  // 오늘 아직 기록하지 않았으면 배지에 신호를 준다
  const needsToday = !streak.recordedToday;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className="flex items-center gap-1.5 pl-0.5 pr-1.5 py-0.5 border-2"
        style={{
          borderColor: open ? "var(--px-accent)" : "var(--px-border)",
          background: "var(--px-bg3)",
          boxShadow: open ? "2px 2px 0 #000" : "none",
        }}
        aria-label={`레벨 ${level.level}, 연속 ${streak.days}일${
          streak.recordedToday
            ? ", 오늘 기록 완료"
            : ", 오늘 아직 기록 안 함"
        }`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((v) => !v)}
      >
        <LevelRing
          ratio={level.progressRatio}
          level={level.level}
          recordedToday={streak.recordedToday}
          pulse={ringPulse}
        />
        <span
          className={`text-[10px] font-bold leading-tight tabular-nums whitespace-nowrap${
            streakPop ? " header-badge-streak-pop" : ""
          }`}
          style={{
            color: streakColor,
            animation:
              atRiskBlink && !streakPop
                ? "motion-blink 1.4s ease-in-out infinite"
                : undefined,
          }}
        >
          {streakLabel}
        </span>
        {needsToday && (
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border"
            style={{
              background: "#f87171",
              borderColor: "var(--px-bg)",
              animation: "motion-blink 1.4s ease-in-out infinite",
            }}
            aria-hidden
          />
        )}
      </button>

      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="성장 상세"
          className="absolute right-0 top-[calc(100%+8px)] w-56 p-3 border-2 space-y-2 z-[70] motion-modal-card"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border2)",
            boxShadow: "4px 4px 0 #000",
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
              {formatPersonalizationLevel(level.level)}
            </p>
            <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
              {level.isMax ? "MAX" : `다음까지 ${level.xpToNext} XP`}
            </p>
          </div>

          <div
            className="h-2 border overflow-hidden"
            style={{ borderColor: "var(--px-border)", background: "var(--px-bg)" }}
          >
            <div
              className="h-full transition-[width] duration-300"
              style={{
                width: `${Math.round(level.progressRatio * 100)}%`,
                background: "var(--px-accent)",
              }}
            />
          </div>

          <p className="text-[11px] font-bold leading-snug" style={{ color: "var(--px-text-on-panel)" }}>
            {streak.days <= 0
              ? "오늘 기록하면 연속 1일이 시작돼요."
              : streak.recordedToday
                ? `연속 ${streak.days}일 · 오늘도 채웠어요.`
                : `연속 ${streak.days}일 · 오늘 기록하면 이어져요.`}
          </p>

          <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
            기록이 쌓일수록 운세·상태 해석이 나에게 더 맞춰져요.
          </p>

          {needsToday && (
            <Link
              href="/journal"
              className="ui-primary-btn block w-full py-2 text-center text-xs font-black"
              onClick={() => setOpen(false)}
            >
              오늘 기록하기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
