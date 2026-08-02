"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  JOURNAL_PROGRESS_CHANGED_EVENT,
} from "@/lib/journal/streak";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { SAJU_PROFILE_CHANGED_EVENT } from "@/lib/diary/profileStorage";
import { todayDateString } from "@/lib/diary/dayPillar";
import { personalizationFromXp } from "@/lib/journal/personalization";
import {
  formatPersonalizationLevel,
  progressFromTotalXp,
  totalJournalXp,
  type PersonalizationLevelProgress,
} from "@/lib/product/personalizationLevel";
import {
  HEADER_BADGE_PULSE_EVENT,
  OPEN_PERSONALIZATION_LEVEL_EVENT,
  type HeaderBadgePulseDetail,
} from "@/lib/ui/motionEvents";
import { XP_GAUGE_FILL } from "@/lib/ui/xpGauge";
import type { FortuneEvidence } from "@/lib/journal/fortune/evidence";
import { peekFortuneEvidenceForDate } from "@/lib/journal/fortune/localPeek";
import FortuneEvidencePanel, {
  FortuneEvidenceSummary,
} from "@/components/home/FortuneEvidenceView";
import JournalDayReportModal from "@/components/stats/JournalDayReportModal";
import type { JournalEntry } from "@/lib/journal/types";
import {
  listRecentEmptyDays,
  yesterdayOf,
} from "@/lib/journal/emptyDays";

/**
 * 헤더 오른쪽 — 레벨(탭 시 XP 팝업 + 운세 근거) + 오늘 쓰기/완료 CTA
 * 완료: 화면 유지 + 오늘 일기 요약 팝업 (+ 이전 일기 작성)
 */
export default function HeaderProgressBadge() {
  const [progress, setProgress] = useState<PersonalizationLevelProgress | null>(
    null
  );
  const [todayEntry, setTodayEntry] = useState<JournalEntry | null>(null);
  const [entryDates, setEntryDates] = useState<string[]>([]);
  const [listReady, setListReady] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [xpOpen, setXpOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [evidence, setEvidence] = useState<FortuneEvidence | null>(null);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);

  const recordedToday = todayEntry != null;

  const refresh = useCallback(async () => {
    try {
      const storage = await getJournalStorage();
      const list = await storage.list();
      const today = todayDateString();
      setTodayEntry(list.find((e) => e.entryDate === today) ?? null);
      setEntryDates(list.map((e) => e.entryDate));
      setProgress(progressFromTotalXp(totalJournalXp(list)));
      setListReady(true);
    } catch {
      /* keep previous */
      setListReady(true);
    }
  }, []);

  const refreshEvidence = useCallback(() => {
    setEvidence(peekFortuneEvidenceForDate(todayDateString()));
  }, []);

  const previousWriteDate = useMemo(() => {
    const today = todayDateString();
    const empties = listRecentEmptyDays({
      todayIso: today,
      dates: new Set(entryDates),
      lookback: 30,
    });
    return empties[0] ?? yesterdayOf(today);
  }, [entryDates]);

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
    const onOpenLevel = () => setXpOpen(true);
    window.addEventListener(OPEN_PERSONALIZATION_LEVEL_EVENT, onOpenLevel);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onProgress);
      window.removeEventListener(HEADER_BADGE_PULSE_EVENT, onPulse);
      window.removeEventListener(OPEN_PERSONALIZATION_LEVEL_EVENT, onOpenLevel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  useEffect(() => {
    if (!xpOpen) {
      setEvidenceExpanded(false);
      return;
    }
    refreshEvidence();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setXpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [xpOpen, refreshEvidence]);

  useEffect(() => {
    if (!reportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReportOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [reportOpen]);

  const openTodayReport = async () => {
    setXpOpen(false);
    try {
      const storage = await getJournalStorage();
      const list = await storage.list();
      const today = todayDateString();
      const entry = list.find((e) => e.entryDate === today) ?? null;
      setTodayEntry(entry);
      setEntryDates(list.map((e) => e.entryDate));
      setProgress(progressFromTotalXp(totalJournalXp(list)));
      if (entry) setReportOpen(true);
    } catch {
      if (todayEntry) setReportOpen(true);
    }
  };

  const levelLabel = progress
    ? formatPersonalizationLevel(progress.level)
    : null;
  const personalization = useMemo(
    () =>
      progress ? personalizationFromXp(progress.totalXp) : null,
    [progress]
  );

  if (levelLabel == null || progress == null || !listReady) {
    return (
      <div
        className="w-16 h-9 border shrink-0"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        aria-hidden
      />
    );
  }

  return (
    <>
      <div className="shrink-0 flex items-center gap-1.5">
        <button
          type="button"
          className="px-2.5 py-1.5 border-2 text-[11px] font-black tabular-nums whitespace-nowrap"
          style={{
            borderColor: "var(--px-accent)",
            background:
              "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))",
            color: "var(--px-accent)",
            boxShadow: "2px 2px 0 #000",
          }}
          aria-label={`개인화 레벨 ${levelLabel}, 경험치·운세 근거 보기`}
          onClick={() => setXpOpen(true)}
        >
          {levelLabel}
        </button>
        {recordedToday ? (
          <button
            type="button"
            className={`px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap${
              pulse ? " header-badge-ring-pulse" : ""
            }`}
            style={{
              borderColor: "var(--signal-condition)",
              background:
                "color-mix(in srgb, var(--signal-condition) 16%, var(--px-bg3))",
              color: "var(--signal-condition)",
              boxShadow: "2px 2px 0 #000",
            }}
            aria-label="오늘 일기 완료, 요약 보기"
            onClick={() => {
              void openTodayReport();
            }}
          >
            완료
          </button>
        ) : (
          <Link
            href="/journal"
            className={`px-2.5 py-1.5 border-2 text-[11px] font-black whitespace-nowrap${
              pulse ? " header-badge-streak-pop" : ""
            }`}
            style={{
              borderColor: "var(--px-accent)",
              background:
                "color-mix(in srgb, var(--px-accent) 18%, var(--px-bg3))",
              color: "var(--px-accent)",
              boxShadow: "2px 2px 0 #000",
            }}
            aria-label="오늘 아직 기록 안 함, 일기 쓰기로 이동"
          >
            오늘 쓰기
          </Link>
        )}
      </div>

      {xpOpen && personalization && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-xp-title"
          onClick={() => setXpOpen(false)}
        >
          <div
            className="w-full max-w-sm max-h-[85dvh] overflow-y-auto border-2 p-4 space-y-3 motion-modal-card"
            style={{
              borderColor: "var(--px-accent)",
              background: "var(--px-bg2)",
              boxShadow: "4px 4px 0 #4a3a00",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <p
                id="header-xp-title"
                className="text-sm font-black"
                style={{ color: "var(--px-accent)" }}
              >
                맞춤 레벨
              </p>
              <button
                type="button"
                className="text-xs font-bold underline shrink-0"
                style={{ color: "var(--px-text2)", background: "transparent" }}
                onClick={() => setXpOpen(false)}
              >
                닫기
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <p
                  className="text-sm font-bold shrink-0"
                  style={{ color: "var(--px-text)" }}
                >
                  {levelLabel}
                </p>
                <span
                  className="inline-flex items-center px-1.5 py-0.5 border text-[11px] font-black leading-none"
                  style={{
                    color: "var(--px-accent)",
                    borderColor: "var(--px-accent)",
                    background:
                      "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg3))",
                  }}
                >
                  {personalization.stageLabel}
                </span>
              </div>
              <p className="ui-hint shrink-0">
                {progress.isMax
                  ? "MAX"
                  : `다음까지 ${progress.xpToNext} XP`}
              </p>
            </div>

            <div
              className="h-2.5 border overflow-hidden"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg3)",
              }}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(4, Math.round(progress.progressRatio * 100))}%`,
                  background: XP_GAUGE_FILL,
                }}
              />
            </div>

            <p
              className="text-[12px] font-bold leading-snug"
              style={{ color: "var(--px-accent)" }}
            >
              {personalization.fitComplete
                ? "맞춤 완료 · 레벨이 오를수록 운세가 더 정확해져요"
                : "레벨이 높아질수록 운세가 더 정확해져요"}
            </p>

            <p
              className="text-[11px] font-bold"
              style={{ color: "var(--px-text2)" }}
            >
              누적 {progress.totalXp} XP
              {!progress.isMax &&
                ` · 다음 레벨 ${progress.nextLevelXp} XP`}
            </p>

            <div
              className="pt-2 border-t space-y-2"
              style={{ borderColor: "var(--px-border)" }}
            >
              <p
                className="text-[11px] font-black"
                style={{ color: "var(--px-accent)" }}
              >
                오늘 운세가 맞춰지는 방식
              </p>
              {evidence ? (
                <>
                  <FortuneEvidenceSummary
                    evidence={evidence}
                    detailLabel={evidenceExpanded ? "접기" : "자세히"}
                    onDetailClick={() =>
                      setEvidenceExpanded((v) => !v)
                    }
                  />
                  {evidenceExpanded && (
                    <FortuneEvidencePanel evidence={evidence} compact />
                  )}
                </>
              ) : (
                <p
                  className="text-[11px] font-bold leading-snug"
                  style={{ color: "var(--px-text2)" }}
                >
                  홈에서 오늘의 운세를 한 번 열면, 기록과 사주가 얼마나
                  섞였는지 여기에 보여요.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {reportOpen && todayEntry && (
        <JournalDayReportModal
          entry={todayEntry}
          previousWriteDate={previousWriteDate}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}
