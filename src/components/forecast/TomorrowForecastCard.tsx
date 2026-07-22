"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ForecastMatchFeedback from "@/components/forecast/ForecastMatchFeedback";
import ErrorState from "@/components/product/ErrorState";
import {
  addDaysToDateString,
  buildTomorrowSajuContext,
  createFeedbackId,
  getForecastStorage,
  type DailyForecast,
} from "@/lib/forecast";
import { MATURITY_LABELS } from "@/lib/forecast/maturity";
import type { ActionHelpfulness, MatchFeedbackLevel } from "@/lib/forecast/types";
import type { DiaryEntry, SajuProfile } from "@/lib/diary/types";
import { getForecastService } from "@/services/analysis";
import type { ServiceResultState } from "@/services/analysis";
import { loadExperienceModeLocal } from "@/lib/app/experienceMode";
import { DEFAULT_EXPERIENCE_MODE } from "@/lib/product/modes";

type Props = {
  todayDate: string;
  sajuProfile?: SajuProfile | null;
  entries?: DiaryEntry[];
  todayEntry?: DiaryEntry | null;
};

const ACTION_OPTIONS: Array<{ id: ActionHelpfulness; label: string }> = [
  { id: "helped", label: "실행했고 도움이 됐어요" },
  { id: "no_difference", label: "실행했지만 큰 차이는 없었어요" },
  { id: "not_done", label: "실행하지 못했어요" },
  { id: "not_applicable", label: "내 상황과 맞지 않았어요" },
];

export default function TomorrowForecastCard({
  todayDate,
  sajuProfile,
  entries = [],
  todayEntry = null,
}: Props) {
  const [tomorrowForecast, setTomorrowForecast] = useState<DailyForecast | null>(
    null
  );
  const [forecastState, setForecastState] = useState<ServiceResultState | null>(
    null
  );
  const [forecastMessage, setForecastMessage] = useState<string | null>(null);
  const [todayAsTarget, setTodayAsTarget] = useState<DailyForecast | null>(null);
  const [matchLevel, setMatchLevel] = useState<MatchFeedbackLevel | null>(null);
  const [actionHelp, setActionHelp] = useState<ActionHelpfulness | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const previewFacts = useMemo(
    () =>
      buildTomorrowSajuContext({
        todayDate,
        sajuProfile,
      }),
    [todayDate, sajuProfile]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const storage = await getForecastStorage();
        const tomorrowDate = addDaysToDateString(todayDate, 1);
        const [forTomorrow, forToday] = await Promise.all([
          storage.getForecastByDate(tomorrowDate),
          storage.getForecastByDate(todayDate),
        ]);
        if (cancelled) return;

        if (forTomorrow) {
          setTomorrowForecast(forTomorrow);
          setForecastState("ready");
          setForecastMessage(null);
        } else if (todayEntry) {
          const result = await getForecastService().createForecast({
            todayDate,
            todayEntry,
            entries,
            sajuProfile: sajuProfile ?? null,
            mode: loadExperienceModeLocal() ?? DEFAULT_EXPERIENCE_MODE,
          });
          if (cancelled) return;
          setTomorrowForecast(result.forecast);
          setForecastState(result.state);
          setForecastMessage(result.message ?? null);
          if (result.forecast) {
            try {
              await storage.saveForecast(result.forecast);
            } catch {
              /* 캐시 실패 무시 */
            }
          }
        } else {
          setTomorrowForecast(null);
          setForecastState("no_today_entry");
          setForecastMessage("오늘을 기록하면 내일의 개인 예보를 만들 수 있어요.");
        }

        setTodayAsTarget(forToday);
        if (forToday) {
          const fb = await storage.getFeedbackByForecastId(forToday.id);
          if (!cancelled && fb) {
            setMatchLevel(fb.matchLevel);
            setActionHelp(fb.actionHelpfulness);
          }
        }
      } catch {
        if (!cancelled) {
          setTomorrowForecast(null);
          setTodayAsTarget(null);
          setForecastState("error");
          setForecastMessage("예보를 불러오지 못했어요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [todayDate, sajuProfile, todayEntry, entries]);

  const saveMatchFeedback = async (
    nextMatch: MatchFeedbackLevel | null,
    nextAction: ActionHelpfulness | null
  ) => {
    if (!todayAsTarget) return;
    if (nextMatch) setMatchLevel(nextMatch);
    if (nextAction) setActionHelp(nextAction);
    try {
      const storage = await getForecastStorage();
      const existing = await storage.getFeedbackByForecastId(todayAsTarget.id);
      const now = new Date().toISOString();
      await storage.saveFeedback({
        id: existing?.id ?? createFeedbackId(),
        forecastId: todayAsTarget.id,
        targetDate: todayAsTarget.targetDate,
        matchLevel: nextMatch ?? existing?.matchLevel ?? matchLevel,
        actionExecuted:
          nextAction != null
            ? nextAction !== "not_done"
            : existing?.actionExecuted ?? null,
        actionHelpfulness: nextAction ?? existing?.actionHelpfulness ?? actionHelp,
        innerSignalFeedback: existing?.innerSignalFeedback ?? null,
        memo: existing?.memo ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setFeedbackMsg("예보 피드백이 저장됐어요. 다음 예보에 참고합니다.");
    } catch {
      setFeedbackMsg("피드백 저장에 실패했어요. 나중에 다시 시도해주세요.");
    }
  };

  if (loading) {
    return (
      <section
        className="p-3 border-2"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        aria-busy="true"
      >
        <p className="ui-hint">내일 예보를 불러오는 중…</p>
      </section>
    );
  }

  if (forecastState === "error" && !tomorrowForecast) {
    return (
      <ErrorState
        title="예보를 불러오지 못했어요"
        message={forecastMessage ?? "잠시 후 다시 시도해주세요."}
      />
    );
  }

  return (
    <section className="space-y-3">
      <div
        className="p-3 border-2 space-y-2"
        style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="ui-section-title">■ 내일의 개인 예보</p>
            <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
              {previewFacts.targetDate} · {previewFacts.ganjiKo}일
              {previewFacts.tenGod ? ` · ${previewFacts.tenGod}` : ""}
            </p>
          </div>
        </div>

        {tomorrowForecast ? (
          <>
            {(forecastState === "insufficient_data" || forecastMessage) && (
              <p className="ui-hint">
                {forecastMessage ??
                  "아직 비슷한 날 기록이 적어 기본 흐름을 중심으로 보여드려요."}
              </p>
            )}
            <p className="ui-hint">{MATURITY_LABELS[tomorrowForecast.maturity]}</p>
            <div className="space-y-2 text-sm" style={{ color: "var(--px-text-on-panel)" }}>
              <p>
                <span className="font-black" style={{ color: "var(--px-accent)" }}>
                  감정 ·{" "}
                </span>
                {tomorrowForecast.emotionForecast.forecast}
              </p>
              <p>
                <span className="font-black" style={{ color: "var(--px-accent)" }}>
                  일·집중 ·{" "}
                </span>
                {tomorrowForecast.focusForecast.forecast}
              </p>
              <p>
                <span className="font-black" style={{ color: "var(--px-accent)" }}>
                  에너지 ·{" "}
                </span>
                {tomorrowForecast.conditionForecast.forecast}
              </p>
            </div>
            <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              한 가지 준비: {tomorrowForecast.oneAction.action}
            </p>
            <p className="ui-hint">
              참고 표본 — 간지 {tomorrowForecast.sampleSizes.ganji} · 십신{" "}
              {tomorrowForecast.sampleSizes.tenGod} · 천간{" "}
              {tomorrowForecast.sampleSizes.stem} · 지지{" "}
              {tomorrowForecast.sampleSizes.branch}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
              {forecastMessage ??
                (previewFacts.tenGod
                  ? `내일은 일간 기준 「${previewFacts.tenGod}」 흐름이 될 수 있어요. 오늘을 기록하면 내 패턴이 반영된 예보를 보여드려요.`
                  : `내일은 ${previewFacts.ganjiKo}일이에요. 사주를 등록하고 오늘을 기록하면 더 개인화된 예보를 볼 수 있어요.`)}
            </p>
            <p className="ui-hint">
              아직 개인 기록이 적어 전통 명리 해석을 중심으로 안내할 수 있어요.
            </p>
            <Link href="/diary" className="ui-primary-btn inline-block px-3 py-2 text-xs">
              오늘 기록하고 내일 보기
            </Link>
          </>
        )}
      </div>

      {todayAsTarget && (
        <div
          className="p-3 border-2 space-y-2"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
        >
          <p className="ui-section-title">■ 어제 예보 확인</p>
          <p className="ui-hint">
            오늘({todayAsTarget.targetDate})에 대해 이전에 준비한 예보와 실제는
            어땠나요?
          </p>
          <p className="text-xs" style={{ color: "var(--px-text2)" }}>
            예보 요약: {todayAsTarget.emotionForecast.forecast}
          </p>
          <ForecastMatchFeedback
            title="어제 예보와 실제 하루는 얼마나 비슷했나요?"
            value={matchLevel}
            onChange={(v) => void saveMatchFeedback(v, null)}
          />
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
              제안한 행동이 실제로 도움이 됐나요?
            </p>
            <div className="flex flex-wrap gap-1">
              {ACTION_OPTIONS.map((opt) => {
                const selected = actionHelp === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => void saveMatchFeedback(null, opt.id)}
                    className="px-2 py-1.5 text-[11px] font-bold border"
                    style={{
                      borderColor: selected ? "var(--px-accent)" : "var(--px-border)",
                      background: selected
                        ? "color-mix(in srgb, var(--px-accent) 16%, var(--px-bg2))"
                        : "var(--px-bg3)",
                      color: selected ? "var(--px-accent)" : "var(--px-text2)",
                    }}
                    aria-pressed={selected}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          {feedbackMsg && <p className="ui-hint">{feedbackMsg}</p>}
        </div>
      )}
    </section>
  );
}
