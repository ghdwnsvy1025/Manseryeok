"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import TodayQuestionCard from "@/components/journal/TodayQuestionCard";
import TodayFortunePanel from "@/components/home/TodayFortunePanel";
import HomeEBlock from "@/components/home/HomeEBlock";
import { getJournalStorage } from "@/lib/journal/getStorage";
import { getEnabledCodesOrdered } from "@/lib/journal/preferences";
import { buildHomeEStats } from "@/lib/journal/homeStats";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import { todayDateString } from "@/lib/diary/dayPillar";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  loadLocalSajuProfile,
  loadPrimarySajuProfile,
} from "@/lib/diary/profileStorage";
import type { SajuProfile } from "@/lib/diary/types";
import {
  BRANCH_META,
  STEM_META,
  type Element,
} from "@/lib/saju/constants";

const ELEM: Record<Element, string> = {
  wood: "#4ade80",
  fire: "#f87171",
  earth: "#fbbf24",
  metal: "#cbd5e1",
  water: "#60a5fa",
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * G — 홈: 날짜·간지 → 오늘의 질문 → 운세(접이식) → E → 일기쓰기
 */
export default function HomeG() {
  const today = todayDateString();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [enabledCodes, setEnabledCodes] = useState<CategoryCode[]>([]);
  const [profile, setProfile] = useState<SajuProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storage = await getJournalStorage();
        const [list, prefs] = await Promise.all([
          storage.list(),
          storage.getPreferences(),
        ]);
        if (cancelled) return;
        setEntries(list);
        setEnabledCodes(getEnabledCodesOrdered(prefs));
        setProfile(loadLocalSajuProfile());
        try {
          const remote = await loadPrimarySajuProfile();
          if (!cancelled && remote) setProfile(remote);
        } catch {
          /* keep local */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dayPillar = useMemo(() => getPillarsForDate(today).dayPillar, [today]);
  const weekday = useMemo(
    () => WEEK[new Date(`${today}T12:00:00+09:00`).getDay()] ?? "",
    [today]
  );
  const stemColor = STEM_META[dayPillar.stem.hanja]?.element
    ? ELEM[STEM_META[dayPillar.stem.hanja]!.element]
    : "var(--px-accent)";
  const branchColor = BRANCH_META[dayPillar.branch.hanja]?.element
    ? ELEM[BRANCH_META[dayPillar.branch.hanja]!.element]
    : "var(--px-accent)";

  const eStats = useMemo(
    () => buildHomeEStats(entries, today, enabledCodes),
    [entries, today, enabledCodes]
  );

  if (loading) {
    return <p className="ui-hint p-4">불러오는 중…</p>;
  }

  return (
    <div className="space-y-3 pb-8">
      <section
        className="border-2 grid grid-cols-[1fr_1.1fr] items-stretch overflow-hidden"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border2)",
          boxShadow: "3px 3px 0 #000",
        }}
        aria-label="오늘"
      >
        <div className="px-3.5 py-3 flex flex-col justify-center gap-1.5 min-w-0">
          <p
            className="text-[10px] font-black tracking-wider"
            style={{ color: "var(--px-text2)" }}
          >
            TODAY
          </p>
          <div className="flex items-center gap-2">
            <p
              className="text-xl font-black tabular-nums leading-none"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {today.replaceAll("-", ".")}
            </p>
            <span
              className="inline-flex items-center justify-center w-6 h-6 text-xs font-black border shrink-0"
              style={{
                borderColor: "var(--px-border2)",
                background: "var(--px-bg3)",
                color: "var(--px-accent)",
              }}
            >
              {weekday}
            </span>
          </div>
          <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
            {dayPillar.ganjiKo}일
          </p>
        </div>

        <div
          className="px-2 py-3 flex flex-col items-center justify-center gap-1"
          style={{
            background: "var(--px-bg3)",
            borderLeft: "2px solid var(--px-border)",
          }}
        >
          <span
            className="font-black leading-none"
            style={{ color: stemColor, fontSize: "28px" }}
          >
            {dayPillar.stem.hanja}
          </span>
          <span
            className="font-black leading-none"
            style={{ color: branchColor, fontSize: "28px" }}
          >
            {dayPillar.branch.hanja}
          </span>
        </div>
      </section>

      {enabledCodes.length >= 4 ? (
        <TodayQuestionCard
          todayDate={today}
          enabledCodes={enabledCodes}
          entries={entries}
          sajuProfile={profile}
        />
      ) : (
        <div
          className="p-3 border-2 space-y-2"
          style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
        >
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            기록 카테고리를 먼저 골라주세요
          </p>
          <Link href="/journal/categories" className="ui-primary-btn inline-block px-3 py-2 text-xs">
            카테고리 설정
          </Link>
        </div>
      )}

      <TodayFortunePanel todayDate={today} sajuProfile={profile} />

      <HomeEBlock stats={eStats} />

      <Link
        href="/journal"
        className="ui-primary-btn block w-full py-3.5 text-center text-sm font-black"
      >
        일기 쓰기
      </Link>
    </div>
  );
}
