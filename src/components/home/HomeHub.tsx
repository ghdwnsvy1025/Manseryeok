"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { UserAppState } from "@/lib/app/userAppState";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import { getRecentAvgWellbeing, getUniqueEntryDays } from "@/lib/diary/stats";
import { getPillarTenGods } from "@/lib/diary/currentDaeun";
import { findSameGanjiEntries } from "@/lib/saju/interpretation";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import {
  BRANCH_META,
  STEM_META,
  type Element,
} from "@/lib/saju/constants";
import TodayOneSentence from "@/components/home/TodayOneSentence";
import HomeDiaryStats from "@/components/home/HomeDiaryStats";

type Props = {
  state: UserAppState;
};

const ELEM: Record<Element, { text: string; bg: string; border: string }> = {
  wood: { text: "#4ade80", bg: "#052e1688", border: "#4ade8077" },
  fire: { text: "#f87171", bg: "#2d000088", border: "#f8717177" },
  earth: { text: "#fbbf24", bg: "#2d200088", border: "#fbbf2477" },
  metal: { text: "#cbd5e1", bg: "#0d111788", border: "#cbd5e177" },
  water: { text: "#60a5fa", bg: "#0a0f2e88", border: "#60a5fa77" },
};

function elemOf(hanja: string, kind: "stem" | "branch") {
  const meta = kind === "stem" ? STEM_META[hanja] : BRANCH_META[hanja];
  return meta?.element ? ELEM[meta.element] : null;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export default function HomeHub({ state }: Props) {
  const profile = state.sajuProfile;
  const todayPillar = useMemo(
    () => getPillarsForDate(state.todayDate).dayPillar,
    [state.todayDate]
  );
  const uniqueDays = useMemo(
    () => getUniqueEntryDays(state.entries),
    [state.entries]
  );
  const recentWellbeing = useMemo(
    () => getRecentAvgWellbeing(state.entries, 30),
    [state.entries]
  );

  const weekdayLabel = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${state.todayDate}T12:00:00+09:00`).getDay()
  ];

  const dayStemHanja = profile?.pillars.day?.stemHanja;
  const todayStemColor = elemOf(todayPillar.stem.hanja, "stem");
  const todayBranchColor = elemOf(todayPillar.branch.hanja, "branch");
  const todayGods = useMemo(() => {
    if (!dayStemHanja) return null;
    return getPillarTenGods(
      dayStemHanja,
      todayPillar.stem.hanja,
      todayPillar.branch.hanja
    );
  }, [dayStemHanja, todayPillar.stem.hanja, todayPillar.branch.hanja]);

  const relationLabels = useMemo(() => {
    if (!profile?.pillars.day) return [] as string[];
    return detectDayRelations({
      natalStemHanja: profile.pillars.day.stemHanja,
      natalBranchHanja: profile.pillars.day.branchHanja,
      todayStemHanja: todayPillar.stem.hanja,
      todayBranchHanja: todayPillar.branch.hanja,
    }).map((r) => r.label);
  }, [profile, todayPillar]);

  const sameGanjiStats = useMemo(() => {
    const matched = findSameGanjiEntries(
      state.entries,
      todayPillar.ganjiKo,
      state.todayDate
    );
    const happiness = matched
      .map((e) => e.happinessRating)
      .filter((v): v is number => typeof v === "number");
    const condition = matched
      .map((e) => e.conditionRating)
      .filter((v): v is number => typeof v === "number");
    return {
      count: matched.length,
      avgHappiness: avg(happiness),
      avgCondition: avg(condition),
    };
  }, [state.entries, todayPillar.ganjiKo, state.todayDate]);

  return (
    <div className="space-y-3 pb-8">
      {/* 오늘 — 날짜 + 세로 일주 */}
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
              {state.todayDate.replaceAll("-", ".")}
            </p>
            <span
              className="inline-flex items-center justify-center w-6 h-6 text-xs font-black border shrink-0"
              style={{
                borderColor: "var(--px-border2)",
                background: "var(--px-bg3)",
                color: "var(--px-accent)",
              }}
            >
              {weekdayLabel}
            </span>
          </div>
        </div>

        <div
          className="px-2 py-3 flex flex-col items-center justify-center gap-1"
          style={{
            background: "var(--px-bg3)",
            borderLeft: "2px solid var(--px-border)",
          }}
          title={`오늘 ${todayPillar.ganjiKo}`}
        >
          <span
            className="font-black leading-none"
            style={{
              color: todayStemColor?.text ?? "var(--px-accent)",
              fontSize: "28px",
              textShadow: todayStemColor
                ? `0 0 8px ${todayStemColor.text}66`
                : undefined,
            }}
          >
            {todayPillar.stem.hanja}
          </span>
          {todayGods?.stemTenGod && (
            <TenGodBox
              label={todayGods.stemTenGod}
              color={todayStemColor}
              size="md"
            />
          )}
          <span
            className="font-black leading-none"
            style={{
              color: todayBranchColor?.text ?? "var(--px-accent)",
              fontSize: "28px",
              textShadow: todayBranchColor
                ? `0 0 8px ${todayBranchColor.text}66`
                : undefined,
            }}
          >
            {todayPillar.branch.hanja}
          </span>
          {todayGods?.branchTenGod && (
            <TenGodBox
              label={todayGods.branchTenGod}
              color={todayBranchColor}
              size="md"
            />
          )}
        </div>
      </section>

      <TodayOneSentence
        ganjiKo={todayPillar.ganjiKo}
        stemKo={todayPillar.stem.ko}
        branchKo={todayPillar.branch.ko}
        tenGod={todayGods?.stemTenGod ?? null}
        relationLabels={relationLabels}
        sameGanjiCount={sameGanjiStats.count}
        sameGanjiAvgHappiness={sameGanjiStats.avgHappiness}
        sameGanjiAvgCondition={sameGanjiStats.avgCondition}
        totalEntryDays={uniqueDays}
        recentWellbeing={recentWellbeing > 0 ? recentWellbeing : null}
      />

      <HomeDiaryStats
        entries={state.entries}
        todayDate={state.todayDate}
        todayEntry={state.todayEntry}
      />

      <section className="grid grid-cols-2 gap-2" aria-label="바로가기">
        <QuickLink
          href="/forecast"
          title="예보"
          hint="오늘·내일 흐름"
          accent="var(--px-accent)"
        />
        <QuickLink
          href="/analysis"
          title="분석"
          hint="일·주·월 해석"
          accent="var(--signal-focus)"
        />
        <QuickLink
          href="/saju"
          title="내 사주"
          hint="만세력 보기"
          accent="var(--signal-saju)"
        />
        <QuickLink
          href="/diary/stats"
          title="패턴"
          hint="간지별 통계"
          accent="var(--signal-emotion)"
        />
      </section>
    </div>
  );
}

function TenGodBox({
  label,
  color,
  size = "sm",
}: {
  label: string;
  color: { text: string; bg: string; border: string } | null;
  size?: "sm" | "md";
}) {
  return (
    <span
      className="font-bold border leading-none"
      style={{
        color: color?.text ?? "var(--px-accent)",
        borderColor: color?.border ?? "var(--px-border)",
        background: color?.bg ?? "transparent",
        fontSize: size === "md" ? "11px" : "9px",
        padding: size === "md" ? "2px 5px" : "1px 3px",
      }}
    >
      {label}
    </span>
  );
}

function QuickLink({
  href,
  title,
  hint,
  accent,
}: {
  href: string;
  title: string;
  hint: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="p-3 border-2 space-y-0.5"
      style={{
        background: "var(--px-bg2)",
        borderColor: "var(--px-border)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <p className="text-sm font-black" style={{ color: accent }}>
        {title}
      </p>
      <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
        {hint}
      </p>
    </Link>
  );
}
