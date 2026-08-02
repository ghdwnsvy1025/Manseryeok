"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TodayFortunePanel from "@/components/home/TodayFortunePanel";
import TodayStatusCard from "@/components/home/TodayStatusCard";
import YesterdayGapPrompt from "@/components/home/YesterdayGapPrompt";
import HomeInstallSheet from "@/components/home/HomeInstallSheet";
import HomeInstallCTA from "@/components/home/HomeInstallCTA";
import HomeEBlock from "@/components/home/HomeEBlock";
import TenGodChip from "@/components/home/TenGodChip";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import { buildHomeEStats } from "@/lib/journal/homeStats";
import { buildWeekTopicSummary } from "@/lib/journal/topics/weekTopics";
import { buildWeekTopicSupportItems } from "@/lib/journal/topics/topicSupport";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";
import { yesterdayOf, entryDateSet, listRecentEmptyDays } from "@/lib/journal/emptyDays";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { addDays } from "@/lib/diary/nextGanjiDay";
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

/** 홈에서 넘길 수 있는 과거 일수 (오늘 포함 7일) */
const HOME_DAY_LOOKBACK = 6;

function elemOf(hanja: string, kind: "stem" | "branch") {
  const meta = kind === "stem" ? STEM_META[hanja] : BRANCH_META[hanja];
  return meta?.element ? ELEM[meta.element] : null;
}

/**
 * G — 홈: 날짜·간지(+기록 CTA) → 오늘의 운세 → (미기록 시)기록 유도 → 최근 상태 → 성장 → 일기쓰기
 */
export default function HomeG() {
  const today = todayDateString();
  const earliest = useMemo(
    () => addDays(today, -HOME_DAY_LOOKBACK),
    [today]
  );
  const [viewDate, setViewDate] = useState(today);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  /** prefs 로드 전에는 카테고리 CTA를 숨겨 깜빡임 방지 */
  const [prefsReady, setPrefsReady] = useState(false);
  /** 전체 화면을 막지 않음 — 운세 캐시가 첫 페인트에 바로 보이게 */
  const [profile, setProfile] = useState<SajuProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const list = loadLocalSajuProfiles();
      return list.find((p) => p.isPrimary) ?? list[0] ?? null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setViewDate(today);
  }, [today]);

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
        setPrefsReady(true);
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

  const isToday = viewDate === today;
  const canPrev = viewDate > earliest;
  const canNext = viewDate < today;

  const dayPillar = useMemo(
    () => getPillarsForDate(viewDate).dayPillar,
    [viewDate]
  );
  const weekdayIndex = useMemo(
    () => new Date(`${viewDate}T12:00:00+09:00`).getDay(),
    [viewDate]
  );
  const weekday = WEEK[weekdayIndex] ?? "";
  const weekdayFull = WEEK_FULL[weekdayIndex] ?? `${weekday}요일`;
  const weekdayAccent = WEEK_ACCENT[weekdayIndex] ?? "var(--px-accent)";
  const stemColor = elemOf(dayPillar.stem.hanja, "stem");
  const branchColor = elemOf(dayPillar.branch.hanja, "branch");

  const dayStemHanja = profile?.pillars.day?.stemHanja;
  const viewGods = useMemo(() => {
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
        windowDays: 30,
        topN: 5,
        withSupport: true,
      }),
    [entries, today]
  );

  const weekTopicSupportItems = useMemo(
    () => buildWeekTopicSupportItems(weekTopics.topics, entries, 3),
    [weekTopics.topics, entries]
  );
  const viewEntry = useMemo(
    () => entries.find((e) => e.entryDate === viewDate) ?? null,
    [entries, viewDate]
  );
  const todayEntry = useMemo(
    () => entries.find((e) => e.entryDate === today) ?? null,
    [entries, today]
  );
  const previousWriteDate = useMemo(() => {
    const empties = listRecentEmptyDays({
      todayIso: today,
      dates: entryDateSet(entries),
      lookback: 30,
    });
    return empties[0] ?? yesterdayOf(today);
  }, [entries, today]);
  const yesterdayMissing = useMemo(() => {
    const y = yesterdayOf(today);
    return !entries.some((e) => e.entryDate === y);
  }, [entries, today]);
  const entryDates = useMemo(
    () => entries.map((e) => e.entryDate),
    [entries]
  );

  const shiftView = (delta: number) => {
    const next = addDays(viewDate, delta);
    if (next < earliest || next > today) return;
    setViewDate(next);
  };

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
        className="border-2"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "3px 3px 0 #000",
        }}
        aria-label={isToday ? "오늘" : "선택한 날"}
      >
        <div className="grid grid-cols-[1.2fr_0.9fr] items-stretch">
          <div className="px-3.5 py-3 flex flex-col justify-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => shiftView(-1)}
                className="shrink-0 w-8 h-8 text-sm font-black border-2 disabled:opacity-35"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg3)",
                  color: "var(--px-text-on-panel)",
                }}
                aria-label="하루 전"
              >
                ‹
              </button>
              <div className="min-w-0 flex-1 flex items-baseline gap-2 flex-wrap justify-center">
                <WaveText
                  className="text-xl font-black tabular-nums leading-none"
                  style={{ color: "var(--px-text-on-panel)" }}
                >
                  {viewDate.replaceAll("-", ".")}
                </WaveText>
                <WaveText
                  className="text-xl font-black leading-none"
                  style={{ color: weekdayAccent }}
                >
                  {weekdayFull}
                </WaveText>
              </div>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => shiftView(1)}
                className="shrink-0 w-8 h-8 text-sm font-black border-2 disabled:opacity-35"
                style={{
                  borderColor: "var(--px-border)",
                  background: "var(--px-bg3)",
                  color: "var(--px-text-on-panel)",
                }}
                aria-label="하루 뒤"
              >
                ›
              </button>
            </div>
            {!isToday && (
              <button
                type="button"
                onClick={() => setViewDate(today)}
                className="text-[11px] font-bold underline self-center"
                style={{ color: "var(--px-text2)" }}
              >
                오늘로 돌아가기
              </button>
            )}
            <div
              className="flex items-center gap-1 pt-0.5"
              aria-label="최근 요일"
            >
              {Array.from({ length: HOME_DAY_LOOKBACK + 1 }, (_, i) => {
                const d = addDays(earliest, i);
                const idx = new Date(`${d}T12:00:00+09:00`).getDay();
                const label = WEEK[idx] ?? "";
                const active = d === viewDate;
                const isViewToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setViewDate(d)}
                    className="flex-1 min-w-0 text-center text-[10px] font-black leading-none py-1 border"
                    style={{
                      color: active ? "#0b0b12" : "var(--px-text2)",
                      background: active
                        ? isViewToday
                          ? weekdayAccent
                          : "var(--px-accent)"
                        : "transparent",
                      borderColor: active
                        ? isViewToday
                          ? weekdayAccent
                          : "var(--px-accent)"
                        : "var(--px-border)",
                      opacity: active ? 1 : 0.72,
                    }}
                    aria-current={active ? "date" : undefined}
                    aria-label={`${d} ${label}요일`}
                  >
                    {label}
                  </button>
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
            title={`${isToday ? "오늘" : "이날"} ${dayPillar.ganjiKo}`}
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
            {viewGods && (viewGods.stemTenGod || viewGods.branchTenGod) && (
              <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                {viewGods.stemTenGod && (
                  <TenGodChip label={viewGods.stemTenGod} color={stemColor} />
                )}
                {viewGods.branchTenGod && (
                  <TenGodChip
                    label={viewGods.branchTenGod}
                    color={branchColor}
                  />
                )}
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/journal?date=${viewDate}`}
          className="flex items-center justify-between gap-2 px-4 py-4 border-t"
          style={{
            borderColor: "var(--px-border)",
            background: viewEntry
              ? "color-mix(in srgb, #4ade80 12%, var(--px-bg2))"
              : "color-mix(in srgb, var(--px-accent) 16%, var(--px-bg2))",
          }}
          onClick={() => {
            void import("@/lib/analytics/posthog").then(
              ({ ANALYTICS_EVENTS, captureUiClick }) => {
                captureUiClick(
                  ANALYTICS_EVENTS.homeTodayEntryClicked,
                  "home_today_entry",
                  {
                    mode: viewEntry ? "edit" : "write",
                    target_date: viewDate,
                    is_today: isToday,
                  }
                );
              }
            );
          }}
        >
          {viewEntry ? (
            <span className="min-w-0 flex items-center gap-2 flex-wrap">
              <span
                className="text-[1.2rem] font-black shrink-0"
                style={{ color: "#4ade80" }}
              >
                {isToday ? "오늘 기록 완료" : "이날 기록 있음"}
              </span>
              {(viewEntry.happinessScore != null ||
                viewEntry.overallSatisfaction != null) && (
                <span
                  className="text-[14px] font-bold px-2 py-0.5 border tabular-nums"
                  style={{
                    color: "#e8e8f4",
                    borderColor: "var(--px-border2)",
                  }}
                >
                  행복{" "}
                  {viewEntry.happinessScore ?? viewEntry.overallSatisfaction}
                  /10
                </span>
              )}
              {viewEntry.xpAwarded > 0 && (
                <span
                  className="text-[14px] font-bold px-2 py-0.5 border tabular-nums"
                  style={{
                    color: "#e8e8f4",
                    borderColor: "var(--px-border2)",
                  }}
                >
                  +{viewEntry.xpAwarded} XP
                </span>
              )}
            </span>
          ) : (
            <span
              className="text-[1.2rem] font-black"
              style={{ color: "var(--px-accent)" }}
            >
              {isToday ? "아직 오늘 기록이 없어요" : "이날 기록이 없어요"}
            </span>
          )}
          <span
            className="text-[1.1rem] font-black shrink-0 flex items-center gap-0.5"
            style={{ color: viewEntry ? "#4ade80" : "var(--px-accent)" }}
          >
            {viewEntry ? "수정" : isToday ? "지금 쓰기" : "쓰기"}
            <span aria-hidden>→</span>
          </span>
        </Link>
      </section>

      {prefsReady && enabledCodes.length < 4 && (
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

      {isToday ? (
        <>
          <TodayFortunePanel
            todayDate={today}
            sajuProfile={profile}
            entries={entries}
            enabledCodes={enabledCodes}
          />

          {yesterdayMissing && entries.length > 0 && (
            <YesterdayGapPrompt todayDate={today} entryDates={entryDates} />
          )}
        </>
      ) : (
        <div
          className="p-3 border-2 space-y-1"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
          }}
        >
          <p
            className="text-[13px] font-black"
            style={{ color: "var(--px-accent)" }}
          >
            과거 날 보기
          </p>
          <p className="text-[12px] font-bold" style={{ color: "var(--px-text2)" }}>
            간지·기록만 볼 수 있어요. 운세는 오늘만 확인해요.
          </p>
        </div>
      )}

      <HomeInstallSheet />

      <TodayStatusCard
        stats={eStats}
        weekTopics={weekTopics}
        weekTopicSupportItems={weekTopicSupportItems}
      />

      <HomeEBlock stats={eStats} />

      <Link
        href={
          isToday
            ? todayEntry
              ? `/journal?date=${previousWriteDate}`
              : `/journal?date=${today}`
            : `/journal?date=${viewDate}`
        }
        className="ui-primary-btn block w-full py-4 text-center text-[1.05rem] font-black"
        onClick={() => {
          void import("@/lib/analytics/posthog").then(
            ({ ANALYTICS_EVENTS, captureUiClick }) => {
              captureUiClick(
                ANALYTICS_EVENTS.homeTodayEntryClicked,
                "home_today_entry",
                {
                  mode: isToday
                    ? todayEntry
                      ? "previous_write"
                      : "write"
                    : viewEntry
                      ? "edit"
                      : "write",
                  target_date: isToday
                    ? todayEntry
                      ? previousWriteDate
                      : today
                    : viewDate,
                }
              );
            }
          );
        }}
      >
        {isToday
          ? todayEntry
            ? "이전 일기 작성"
            : "일기 쓰기"
          : viewEntry
            ? "이날 기록 수정"
            : "이날 일기 쓰기"}
      </Link>

      <HomeInstallCTA />
    </div>
  );
}
