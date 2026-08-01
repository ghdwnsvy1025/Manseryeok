"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import TodayFortunePanel from "@/components/home/TodayFortunePanel";
import TodayStatusCard from "@/components/home/TodayStatusCard";
import TodayRecordPrompt from "@/components/home/TodayRecordPrompt";
import YesterdayGapPrompt from "@/components/home/YesterdayGapPrompt";
import InstallAppNudge from "@/components/home/InstallAppNudge";
import HomeInstallSheet from "@/components/home/HomeInstallSheet";
import HomeEBlock from "@/components/home/HomeEBlock";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import { buildHomeEStats } from "@/lib/journal/homeStats";
import { buildWeekTopicSummary } from "@/lib/journal/topics/weekTopics";
import { buildWeekTopicSupportItems } from "@/lib/journal/topics/topicSupport";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";
import { yesterdayOf } from "@/lib/journal/emptyDays";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { getPillarTenGods } from "@/lib/diary/currentDaeun";
import {
  loadLocalSajuProfiles,
  loadPrimarySajuProfile,
  SAJU_PROFILE_CHANGED_EVENT,
} from "@/lib/diary/profileStorage";
import type { SajuProfile } from "@/lib/diary/types";
import {
  BRANCH_META,
  STEM_META,
  type Element,
} from "@/lib/saju/constants";
import { tenGodPlain } from "@/lib/saju/tenGodPlain";
import WaveText from "@/components/motion/WaveText";
import { JOURNAL_PROGRESS_CHANGED_EVENT } from "@/lib/journal/streak";

const ELEM: Record<Element, { text: string; bg: string; border: string }> = {
  wood: { text: "#4ade80", bg: "#052e1688", border: "#4ade8077" },
  fire: { text: "#f87171", bg: "#2d000088", border: "#f8717177" },
  earth: { text: "#fbbf24", bg: "#2d200088", border: "#fbbf2477" },
  metal: { text: "#cbd5e1", bg: "#0d111788", border: "#cbd5e177" },
  water: { text: "#60a5fa", bg: "#0a0f2e88", border: "#60a5fa77" },
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"] as const;
const WEEK_FULL = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;
/** 요일 악센트 — 주말만 살짝 구분 */
const WEEK_ACCENT = [
  "#f87171",
  "var(--px-accent)",
  "var(--px-accent)",
  "var(--px-accent)",
  "var(--px-accent)",
  "var(--px-accent)",
  "#60a5fa",
] as const;

function elemOf(hanja: string, kind: "stem" | "branch") {
  const meta = kind === "stem" ? STEM_META[hanja] : BRANCH_META[hanja];
  return meta?.element ? ELEM[meta.element] : null;
}

function TenGodBox({
  label,
  color,
}: {
  label: string;
  color: { text: string; bg: string; border: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

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

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className="font-bold border leading-none"
        style={{
          color: color?.text ?? "var(--px-accent)",
          borderColor: color?.border ?? "var(--px-border)",
          background: color?.bg ?? "transparent",
          fontSize: "11px",
          padding: "2px 5px",
        }}
        aria-expanded={open}
        aria-label={`${label} 설명`}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute left-1/2 top-[calc(100%+6px)] z-20 w-44 -translate-x-1/2 p-2 border-2 text-left motion-modal-card"
          style={{
            background: "var(--px-bg3)",
            borderColor: "var(--px-border2)",
            boxShadow: "3px 3px 0 #000",
          }}
        >
          <span
            className="block text-[11px] font-black mb-1"
            style={{ color: "var(--px-accent)" }}
          >
            {label}
          </span>
          <span
            className="block text-[10px] leading-relaxed font-bold"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {tenGodPlain(label)}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * G — 홈: 날짜·간지(+기록 CTA) → 오늘의 운세 → (미기록 시)기록 유도 → 최근 상태 → 성장 → 일기쓰기
 */
export default function HomeG() {
  const today = todayDateString();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [profile, setProfile] = useState<SajuProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const list = loadLocalSajuProfiles();
      return list.find((p) => p.isPrimary) ?? list[0] ?? null;
    } catch {
      return null;
    }
  });
  /** 전체 화면을 막지 않음 — 운세 캐시가 첫 페인트에 바로 보이게 */
  const [showTenGods, setShowTenGods] = useState(false);

  useEffect(() => {
    try {
      setShowTenGods(
        window.localStorage.getItem("manseryeok:show_ten_gods_v1") === "1"
      );
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTenGods = () => {
    setShowTenGods((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(
          "manseryeok:show_ten_gods_v1",
          next ? "1" : "0"
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const load = async (opts?: { soft?: boolean }) => {
      const soft = Boolean(opts?.soft);
      try {
        const storage = await getJournalStorage();
        const [list, prefs] = await Promise.all([
          storage.list(),
          storage.getPreferences(),
        ]);
        if (cancelled) return;
        setEntries(list);
        setEnabledCodes(getEnabledCodesOrdered(prefs));
        if (!soft) {
          try {
            const remote = await loadPrimarySajuProfile();
            if (!cancelled && remote) setProfile(remote);
          } catch {
            /* keep local profile */
          }
        }
      } catch {
        /* show shell even if storage fails */
      }
    };

    void load();

    const onProgress = () => {
      void load({ soft: true });
    };
    const onProfile = () => {
      try {
        const list = loadLocalSajuProfiles();
        setProfile(list.find((p) => p.isPrimary) ?? list[0] ?? null);
      } catch {
        /* ignore */
      }
      void load({ soft: true });
    };
    window.addEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
    window.addEventListener("focus", onProgress);
    window.addEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfile);

    return () => {
      cancelled = true;
      window.removeEventListener(JOURNAL_PROGRESS_CHANGED_EVENT, onProgress);
      window.removeEventListener("focus", onProgress);
      window.removeEventListener(SAJU_PROFILE_CHANGED_EVENT, onProfile);
    };
  }, []);

  const dayPillar = useMemo(() => getPillarsForDate(today).dayPillar, [today]);
  const weekdayIndex = useMemo(
    () => new Date(`${today}T12:00:00+09:00`).getDay(),
    [today]
  );
  const weekday = WEEK[weekdayIndex] ?? "";
  const weekdayFull = WEEK_FULL[weekdayIndex] ?? `${weekday}요일`;
  const weekdayAccent = WEEK_ACCENT[weekdayIndex] ?? "var(--px-accent)";
  const stemColor = elemOf(dayPillar.stem.hanja, "stem");
  const branchColor = elemOf(dayPillar.branch.hanja, "branch");

  const dayStemHanja = profile?.pillars.day?.stemHanja;
  const todayGods = useMemo(() => {
    if (!dayStemHanja) return null;
    return getPillarTenGods(
      dayStemHanja,
      dayPillar.stem.hanja,
      dayPillar.branch.hanja
    );
  }, [dayStemHanja, dayPillar.stem.hanja, dayPillar.branch.hanja]);

  const eStats = useMemo(
    () => buildHomeEStats(entries, today, enabledCodes),
    [entries, today, enabledCodes]
  );

  const weekTopics = useMemo(
    () =>
      buildWeekTopicSummary(entries, {
        asOf: today,
        windowDays: 7,
        topN: 2,
        withSupport: true,
      }),
    [entries, today]
  );

  const weekTopicSupportItems = useMemo(
    () => buildWeekTopicSupportItems(weekTopics.topics, entries),
    [weekTopics.topics, entries]
  );
  const todayEntry = useMemo(
    () => entries.find((e) => e.entryDate === today) ?? null,
    [entries, today]
  );
  const yesterdayMissing = useMemo(() => {
    const y = yesterdayOf(today);
    return !entries.some((e) => e.entryDate === y);
  }, [entries, today]);
  const entryDates = useMemo(
    () => entries.map((e) => e.entryDate),
    [entries]
  );

  return (
    <div className="home-readable space-y-4 pb-8">
      {!profile && (
        <Link
          href="/saju/profiles"
          className="block p-3 border-2 text-sm font-bold"
          style={{
            borderColor: "var(--px-accent)",
            background: "color-mix(in srgb, var(--px-accent) 12%, var(--px-bg2))",
            color: "var(--px-text-on-panel)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          사주 프로필을 등록하면 운세·오늘의 문장이 더 잘 맞아요 →
        </Link>
      )}
      <section
        className="border-2 overflow-hidden"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "3px 3px 0 #000",
        }}
        aria-label="오늘"
      >
        <div className="grid grid-cols-[1.2fr_0.9fr] items-stretch">
          <div className="px-3.5 py-3 flex flex-col justify-center gap-2 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <WaveText
                className="text-xl font-black tabular-nums leading-none"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {today.replaceAll("-", ".")}
              </WaveText>
              <WaveText
                className="text-xl font-black leading-none"
                style={{ color: weekdayAccent }}
              >
                {weekdayFull}
              </WaveText>
            </div>
            <div
              className="flex items-center gap-1 pt-0.5"
              aria-label="이번 주 요일"
            >
              {WEEK.map((d, i) => {
                const active = i === weekdayIndex;
                return (
                  <span
                    key={d}
                    className="flex-1 min-w-0 text-center text-[10px] font-black leading-none py-1 border"
                    style={{
                      color: active ? "#0b0b12" : "var(--px-text2)",
                      background: active ? weekdayAccent : "transparent",
                      borderColor: active
                        ? weekdayAccent
                        : "var(--px-border)",
                      opacity: active ? 1 : 0.72,
                    }}
                    aria-current={active ? "date" : undefined}
                  >
                    {d}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            className="px-2.5 py-3 flex flex-col items-center justify-center gap-1"
            style={{
              background: "var(--px-bg3)",
              borderLeft: "2px solid var(--px-border)",
            }}
            title={`오늘 ${dayPillar.ganjiKo}`}
          >
            <div className="flex items-end gap-2">
              <div className="flex flex-col items-center gap-0.5">
                <WaveText
                  className="font-black leading-none"
                  style={{
                    color: stemColor?.text ?? "var(--px-accent)",
                    fontSize: "22px",
                  }}
                >
                  {dayPillar.stem.hanja}
                </WaveText>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "var(--px-text2)" }}
                >
                  {dayPillar.stem.ko}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <WaveText
                  className="font-black leading-none"
                  style={{
                    color: branchColor?.text ?? "var(--px-accent)",
                    fontSize: "22px",
                  }}
                >
                  {dayPillar.branch.hanja}
                </WaveText>
                <span
                  className="text-[10px] font-bold"
                  style={{ color: "var(--px-text2)" }}
                >
                  {dayPillar.branch.ko}
                </span>
              </div>
            </div>
            {todayGods && (todayGods.stemTenGod || todayGods.branchTenGod) && (
              <button
                type="button"
                className="mt-0.5 text-[10px] font-bold underline"
                style={{ color: "var(--px-text2)" }}
                onClick={toggleTenGods}
                aria-expanded={showTenGods}
              >
                {showTenGods ? "기운 접기" : "오늘의 기운 보기"}
              </button>
            )}
            {showTenGods && todayGods && (
              <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                {todayGods.stemTenGod && (
                  <TenGodBox label={todayGods.stemTenGod} color={stemColor} />
                )}
                {todayGods.branchTenGod && (
                  <TenGodBox label={todayGods.branchTenGod} color={branchColor} />
                )}
              </div>
            )}
          </div>
        </div>
        <Link
            href={`/journal?date=${today}`}
            className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t"
          style={{
            borderColor: "var(--px-border)",
            background: todayEntry
              ? "color-mix(in srgb, #4ade80 10%, var(--px-bg2))"
              : "color-mix(in srgb, var(--px-accent) 10%, var(--px-bg2))",
          }}
        >
          {todayEntry ? (
            <span className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                className="text-sm font-black shrink-0"
                style={{ color: "#4ade80" }}
              >
                오늘 기록 완료
              </span>
              {(todayEntry.happinessScore != null ||
                todayEntry.overallSatisfaction != null) && (
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 border tabular-nums"
                  style={{
                    color: "var(--px-text2)",
                    borderColor: "var(--px-border)",
                  }}
                >
                  행복{" "}
                  {todayEntry.happinessScore ??
                    todayEntry.overallSatisfaction}
                  /10
                </span>
              )}
              {todayEntry.xpAwarded > 0 && (
                <span
                  className="text-[11px] font-bold px-1.5 py-0.5 border tabular-nums"
                  style={{
                    color: "var(--px-text2)",
                    borderColor: "var(--px-border)",
                  }}
                >
                  +{todayEntry.xpAwarded} XP
                </span>
              )}
            </span>
          ) : (
            <span
              className="text-sm font-black"
              style={{ color: "var(--px-accent)" }}
            >
              아직 오늘 기록이 없어요
            </span>
          )}
          <span
            className="text-xs font-bold shrink-0 flex items-center gap-0.5"
            style={{ color: todayEntry ? "#4ade80" : "var(--px-accent)" }}
          >
            {todayEntry ? "수정" : "지금 쓰기"}
            <span aria-hidden>→</span>
          </span>
        </Link>
      </section>

      {enabledCodes.length < 4 && (
        <div
          className="p-3 border-2 space-y-2"
          style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
        >
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            기록 카테고리를 먼저 골라주세요
          </p>
          <Link
            href="/journal/categories"
            className="ui-primary-btn inline-block px-3 py-2 text-xs"
          >
            카테고리 설정
          </Link>
        </div>
      )}

      <TodayFortunePanel
        todayDate={today}
        sajuProfile={profile}
        entries={entries}
        enabledCodes={enabledCodes}
      />

      {!todayEntry && (
        <TodayRecordPrompt todayDate={today} entryDates={entryDates} />
      )}

      {yesterdayMissing && entries.length > 0 && (
        <YesterdayGapPrompt todayDate={today} entryDates={entryDates} />
      )}

      {entries.length > 0 && (
        <InstallAppNudge
          hasEntries
          uniqueDays={new Set(entries.map((e) => e.entryDate)).size}
        />
      )}

      <HomeInstallSheet />

      <TodayStatusCard
        stats={eStats}
        weekTopics={weekTopics}
        weekTopicSupportItems={weekTopicSupportItems}
      />

      <HomeEBlock stats={eStats} />

      <Link
        href={`/journal?date=${today}`}
        className="ui-primary-btn block w-full py-3.5 text-center text-sm font-black"
      >
        {todayEntry ? "오늘 일기 수정" : "일기 쓰기"}
      </Link>
    </div>
  );
}
