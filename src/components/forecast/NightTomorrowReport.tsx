"use client";

import { useState } from "react";
import Link from "next/link";
import ForecastMatchFeedback from "@/components/forecast/ForecastMatchFeedback";
import type { DailyForecast, MatchFeedbackLevel } from "@/lib/forecast/types";
import {
  createFeedbackId,
  getForecastStorage,
} from "@/lib/forecast/storage";

type Props = {
  forecast: DailyForecast;
  maturityLabel?: string;
  onClose?: () => void;
};

function DomainCard({
  title,
  block,
}: {
  title: string;
  block: DailyForecast["emotionForecast"];
}) {
  return (
    <div
      className="p-3 border space-y-1"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
    >
      <p className="text-xs font-black" style={{ color: "var(--px-accent)" }}>
        {title}
      </p>
      <p className="text-sm font-bold" style={{ color: "var(--px-text-on-panel)" }}>
        {block.forecast}
      </p>
    </div>
  );
}

export default function NightTomorrowReport({
  forecast,
  onClose,
}: Props) {
  const [innerFeedback, setInnerFeedback] = useState<MatchFeedbackLevel | null>(
    null
  );
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const saveInnerFeedback = async (level: MatchFeedbackLevel) => {
    setInnerFeedback(level);
    setSavingFeedback(true);
    setFeedbackMsg("");
    try {
      const storage = await getForecastStorage();
      const existing = await storage.getFeedbackByForecastId(forecast.id);
      const now = new Date().toISOString();
      await storage.saveFeedback({
        id: existing?.id ?? createFeedbackId(),
        forecastId: forecast.id,
        targetDate: forecast.targetDate,
        matchLevel: existing?.matchLevel ?? null,
        actionExecuted: existing?.actionExecuted ?? null,
        actionHelpfulness: existing?.actionHelpfulness ?? null,
        innerSignalFeedback: level,
        memo: existing?.memo ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      setFeedbackMsg(
        level === "match" || level === "partial"
          ? "긍정한 내용은 이후 개인화에 참고해요."
          : "피드백이 저장됐어요. 단정하지 않고 관찰을 이어갈게요."
      );
    } catch {
      setFeedbackMsg("피드백 저장에 실패했지만 예보는 그대로 볼 수 있어요.");
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="오늘을 정리하고 내일을 준비했어요"
    >
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto border-2 p-4 space-y-4"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-border)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <header className="space-y-1">
          <p className="ui-section-title">■ 오늘을 정리하고 내일을 준비했어요</p>
          <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
            내일 {forecast.targetDate} · {forecast.traditionalFacts.ganjiKo}일
            {forecast.traditionalFacts.tenGod
              ? ` · ${forecast.traditionalFacts.tenGod}`
              : ""}
          </p>
        </header>

        <section className="space-y-1">
          <p className="text-xs font-black">오늘의 마음</p>
          <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
            {forecast.todaySummary}
          </p>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-black">글 사이에 나타난 신호</p>
          <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
            {forecast.innerSignal.text}
          </p>
          <ForecastMatchFeedback
            title="이 마음 해석이 나와 맞았나요?"
            value={innerFeedback}
            onChange={saveInnerFeedback}
            disabled={savingFeedback}
          />
          {feedbackMsg && <p className="ui-hint">{feedbackMsg}</p>}
        </section>

        <section className="space-y-1">
          <p className="text-xs font-black">나에게 필요했던 조건</p>
          <p className="text-sm" style={{ color: "var(--px-text-on-panel)" }}>
            {forecast.neededCondition.text}
          </p>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-black">내일의 개인 예보</p>
          <DomainCard title="감정" block={forecast.emotionForecast} />
          <DomainCard title="일·집중" block={forecast.focusForecast} />
          <DomainCard title="에너지·컨디션" block={forecast.conditionForecast} />
        </section>

        <section className="space-y-1">
          <p className="text-xs font-black">내일의 한 가지 준비</p>
          <p className="text-sm font-bold" style={{ color: "var(--px-accent)" }}>
            {forecast.oneAction.action}
          </p>
        </section>

        <section className="space-y-1">
          <p className="text-xs font-black">오늘의 성찰 문장</p>
          <p
            className="text-sm font-bold italic"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {forecast.reflectionSentence}
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="ui-primary-btn flex-1 py-2.5 text-sm"
            onClick={onClose}
          >
            확인
          </button>
          <Link
            href="/forecast"
            className="flex-1 py-2.5 text-sm text-center font-bold border-2"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            onClick={onClose}
          >
            예보에서 내일 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
