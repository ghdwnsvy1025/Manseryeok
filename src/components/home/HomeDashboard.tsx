"use client";

import { useMemo } from "react";
import Link from "next/link";
import BeginnerTodayFlowCards from "@/components/saju/BeginnerTodayFlowCards";
import ExpertInsightPanel from "@/components/saju/ExpertInsightPanel";
import HappinessTrendChart from "@/components/diary/stats/HappinessTrendChart";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  buildBeginnerTodayFlow,
  buildExpertInsights,
  buildRecordPatternInsight,
} from "@/lib/saju/interpretation";
import { buildRatingTrend } from "@/lib/diary/trendStats";
import { saveExperienceMode } from "@/lib/app/experienceMode";
import type { UserAppState } from "@/lib/app/userAppState";
import type { ExperienceMode } from "@/lib/diary/types";

type Props = {
  state: UserAppState;
  onModeChanged?: () => void;
};

export default function HomeDashboard({ state, onModeChanged }: Props) {
  const mode: ExperienceMode = state.experienceMode ?? "beginner";
  const dayPillar = useMemo(
    () => getPillarsForDate(state.todayDate).dayPillar,
    [state.todayDate]
  );
  const beginnerFlow = useMemo(
    () =>
      buildBeginnerTodayFlow({
        dayPillar,
        sajuProfile: state.sajuProfile,
        entries: state.entries,
        todayDate: state.todayDate,
      }),
    [dayPillar, state.sajuProfile, state.entries, state.todayDate]
  );
  const expertSections = useMemo(
    () =>
      buildExpertInsights({
        dayPillar,
        sajuProfile: state.sajuProfile,
        entries: state.entries,
        todayDate: state.todayDate,
      }),
    [dayPillar, state.sajuProfile, state.entries, state.todayDate]
  );
  const similar = useMemo(
    () => buildRecordPatternInsight(state.entries, dayPillar.ganjiKo, state.todayDate),
    [state.entries, dayPillar.ganjiKo, state.todayDate]
  );
  const trend7 = useMemo(
    () => buildRatingTrend(state.entries, 7, "happiness"),
    [state.entries]
  );

  const switchMode = async (next: ExperienceMode) => {
    await saveExperienceMode(next);
    onModeChanged?.();
  };

  return (
    <div className="space-y-4 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="ui-section-title">■ 오늘의 흐름</p>
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            {state.todayDate} · {dayPillar.ganjiKo}일
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="px-2 py-1 text-[11px] font-bold border"
            style={{
              borderColor: mode === "beginner" ? "var(--px-accent)" : "var(--px-border)",
              color: mode === "beginner" ? "var(--px-accent)" : "var(--px-text2)",
            }}
            onClick={() => void switchMode("beginner")}
          >
            초보
          </button>
          <button
            type="button"
            className="px-2 py-1 text-[11px] font-bold border"
            style={{
              borderColor: mode === "expert" ? "var(--px-accent)" : "var(--px-border)",
              color: mode === "expert" ? "var(--px-accent)" : "var(--px-text2)",
            }}
            onClick={() => void switchMode("expert")}
          >
            전문
          </button>
        </div>
      </header>

      {state.kind === "profile_without_diary" && (
        <div className="p-3 border-2" style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
            오늘의 기본 흐름을 확인했어요.
          </p>
          <p className="ui-hint mt-1">
            오늘 하루를 기록하면 다음부터 내 실제 경험이 반영된 결과를 확인할 수 있어요.
          </p>
        </div>
      )}

      {mode === "beginner" ? (
        <BeginnerTodayFlowCards flow={beginnerFlow} compact={state.kind !== "logged_today"} />
      ) : (
        <div className="space-y-3">
          <div className="p-3 border-2" style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}>
            <p className="ui-section-title">기본 사주 분석</p>
            <p className="text-sm mt-1" style={{ color: "var(--px-text)" }}>
              오늘 일진 {dayPillar.ganjiKo} ({dayPillar.ganji})
            </p>
            <Link href="/saju" className="inline-block mt-2 text-xs font-bold underline" style={{ color: "var(--px-accent)" }}>
              전문 만세력 상세 보기 →
            </Link>
          </div>
          <ExpertInsightPanel sections={expertSections} />
        </div>
      )}

      {similar && state.hasAnyDiary && (
        <div className="p-3 border-2" style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}>
          <p className="ui-section-title">{similar.title}</p>
          <p className="text-xs mt-1" style={{ color: "var(--px-text)" }}>
            {similar.summary}
          </p>
        </div>
      )}

      {state.kind === "logged_today" && state.todayEntry && (
        <div className="p-3 border-2 space-y-2" style={{ background: "var(--px-bg3)", borderColor: "var(--px-accent)" }}>
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            오늘 기록 완료
          </p>
          <p className="text-xs" style={{ color: "var(--px-text)" }}>
            행복도 {state.todayEntry.happinessRating ?? "-"}점
            {state.todayEntry.conditionRating != null
              ? ` · 컨디션 ${state.todayEntry.conditionRating}점`
              : ""}
          </p>
          {trend7.points.some((p) => p.value != null) && (
            <HappinessTrendChart trend={trend7} title="최근 7일 행복도" />
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={`/diary?date=${state.todayDate}`} className="ui-primary-btn px-3 py-2 text-xs">
              기록 수정
            </Link>
            <Link
              href="/diary/stats"
              className="px-3 py-2 text-xs font-bold border"
              style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            >
              오늘 결과 비교하기
            </Link>
          </div>
        </div>
      )}

      {state.kind !== "logged_today" && (
        <div className="sticky bottom-2 z-10 pt-2">
          <Link
            href={`/diary?date=${state.todayDate}`}
            className="ui-primary-btn block w-full py-4 text-center text-base"
            style={{ boxShadow: "4px 4px 0 #000" }}
          >
            {state.kind === "profile_without_diary" ? "오늘의 기분 기록하기" : "오늘 기록하기"}
            <span className="block text-[11px] font-bold mt-1 opacity-90">30초면 기록할 수 있어요</span>
          </Link>
        </div>
      )}
    </div>
  );
}
