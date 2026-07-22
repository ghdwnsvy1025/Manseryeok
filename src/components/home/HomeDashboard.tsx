"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BeginnerTodayFlowCards from "@/components/saju/BeginnerTodayFlowCards";
import ExpertInsightPanel from "@/components/saju/ExpertInsightPanel";
import TomorrowForecastCard from "@/components/forecast/TomorrowForecastCard";
import ActionSuggestionCard from "@/components/product/ActionSuggestionCard";
import ReflectionSentenceCard from "@/components/product/ReflectionSentenceCard";
import { getPillarsForDate } from "@/lib/diary/dayPillar";
import {
  buildBeginnerTodayFlow,
  buildExpertInsights,
  buildRecordPatternInsight,
} from "@/lib/saju/interpretation";
import { detectDayRelations } from "@/lib/saju/interpretation/relations";
import { getTenGod } from "@/lib/saju/hiddenStems";
import { STEMS } from "@/lib/saju/constants";
import type { UserAppState } from "@/lib/app/userAppState";
import {
  DEFAULT_EXPERIENCE_MODE,
  prefersSajuTerms,
  type UserExperienceMode,
} from "@/lib/product/modes";

const ACTION_POOL = [
  {
    action: "내일 반드시 끝낼 일 한 가지를 미리 정해보세요.",
    reason: "할 일이 명확할수록 집중이 이어지기 쉬운 흐름이에요.",
  },
  {
    action: "저녁에 짧은 회복 시간을 미리 비워두세요.",
    reason: "피로가 빠르게 쌓일 수 있어 여백이 도움이 될 수 있어요.",
  },
  {
    action: "오늘 마음에 남은 장면을 한 문장으로만 적어보세요.",
    reason: "감정을 짧게 정리하면 다음날 흐름을 보기 쉬워져요.",
  },
];

const REFLECTION_POOL = [
  "모든 것을 혼자 감당하는 것이 책임감의 증거는 아닙니다.",
  "오늘의 컨디션은 내일의 계획을 조금 줄여도 된다는 신호일 수 있어요.",
  "관계는 의도가 분명할 때 더 가볍게 흘러갈 수 있어요.",
];

type Props = {
  state: UserAppState;
  onModeChanged?: () => void;
};

export default function HomeDashboard({ state }: Props) {
  const mode: UserExperienceMode = state.experienceMode ?? DEFAULT_EXPERIENCE_MODE;
  const [actionIdx, setActionIdx] = useState(0);
  const [reflectionIdx, setReflectionIdx] = useState(0);

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

  const groundingFacts = useMemo(() => {
    const natal = state.sajuProfile?.pillars.day;
    let tenGod: string | null = null;
    if (natal?.stemHanja && STEMS.includes(natal.stemHanja as (typeof STEMS)[number])) {
      const todayStem = dayPillar.stem.hanja as (typeof STEMS)[number];
      if (STEMS.includes(todayStem)) {
        tenGod = getTenGod(natal.stemHanja as (typeof STEMS)[number], todayStem);
      }
    }
    const relations = natal
      ? detectDayRelations({
          natalStemHanja: natal.stemHanja,
          natalBranchHanja: natal.branchHanja,
          todayStemHanja: dayPillar.stem.hanja,
          todayBranchHanja: dayPillar.branch.hanja,
        })
      : [];
    return {
      ganjiKo: dayPillar.ganjiKo,
      heavenlyStem: dayPillar.stem.ko,
      earthlyBranch: dayPillar.branch.ko,
      tenGod,
      relationLabels: relations.map((r) => r.label),
    };
  }, [dayPillar, state.sajuProfile]);

  const weekdayLabel = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(`${state.todayDate}T12:00:00+09:00`).getDay()
  ];

  const action = ACTION_POOL[actionIdx % ACTION_POOL.length];
  const reflection = REFLECTION_POOL[reflectionIdx % REFLECTION_POOL.length];

  return (
    <div className="space-y-4 pb-8">
      <header className="space-y-2">
        <p className="ui-section-title">■ 예보</p>
        <p className="text-lg font-black" style={{ color: "var(--px-accent)" }}>
          {state.todayDate.replaceAll("-", ".")} {weekdayLabel}요일
        </p>
      </header>

      {prefersSajuTerms(mode) ? (
        <div className="space-y-3">
          <div
            className="p-3 border-2"
            style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
          >
            <p className="ui-section-title">오늘의 사주 흐름</p>
            <p className="text-sm mt-1" style={{ color: "var(--px-text)" }}>
              오늘 일진 {dayPillar.ganjiKo} ({dayPillar.ganji})
            </p>
            <Link
              href="/saju"
              className="inline-block mt-2 text-xs font-bold underline"
              style={{ color: "var(--px-accent)" }}
            >
              만세력 상세 보기 →
            </Link>
          </div>
          <ExpertInsightPanel
            sections={expertSections}
            groundingFacts={{ ...groundingFacts, surface: "today_expert" }}
          />
        </div>
      ) : (
        <BeginnerTodayFlowCards
          flow={beginnerFlow}
          compact={state.kind !== "logged_today"}
          groundingFacts={groundingFacts}
        />
      )}

      {similar && state.hasAnyDiary && (
        <div
          className="p-3 border-2"
          style={{ background: "var(--px-bg2)", borderColor: "var(--px-border)" }}
        >
          <p className="ui-section-title">{similar.title}</p>
          <p className="text-xs mt-1" style={{ color: "var(--px-text)" }}>
            {similar.summary}
          </p>
        </div>
      )}

      <TomorrowForecastCard
        todayDate={state.todayDate}
        sajuProfile={state.sajuProfile}
        entries={state.entries}
        todayEntry={state.todayEntry ?? null}
      />

      <ActionSuggestionCard
        action={action.action}
        reason={action.reason}
        onAccept={() => undefined}
        onNext={() => setActionIdx((i) => i + 1)}
        onReject={() => setActionIdx((i) => i + 1)}
      />

      <ReflectionSentenceCard
        text={reflection}
        source="generated"
        onSave={() => undefined}
        onNext={() => setReflectionIdx((i) => i + 1)}
        onReject={() => setReflectionIdx((i) => i + 1)}
      />

      {state.kind === "logged_today" && state.todayEntry && (
        <div
          className="p-3 border-2 space-y-2"
          style={{ background: "var(--px-bg3)", borderColor: "var(--px-accent)" }}
        >
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            오늘 기록 완료
          </p>
          <p className="text-xs" style={{ color: "var(--px-text)" }}>
            행복도 {state.todayEntry.happinessRating ?? "-"}점
            {state.todayEntry.conditionRating != null
              ? ` · 컨디션 ${state.todayEntry.conditionRating}점`
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/diary?date=${state.todayDate}`}
              className="ui-primary-btn px-3 py-2 text-xs"
            >
              기록 수정
            </Link>
            <Link
              href="/diary/stats"
              className="px-3 py-2 text-xs font-bold border"
              style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            >
              내 패턴 보기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
