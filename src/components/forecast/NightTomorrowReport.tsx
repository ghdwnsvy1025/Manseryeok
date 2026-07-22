"use client";

import { useState } from "react";
import Link from "next/link";
import EvidenceDisclosure from "@/components/forecast/EvidenceDisclosure";
import ForecastMatchFeedback from "@/components/forecast/ForecastMatchFeedback";
import type { DailyForecast, MatchFeedbackLevel } from "@/lib/forecast/types";
import { MATURITY_LABELS } from "@/lib/forecast/maturity";
import {
  createFeedbackId,
  getForecastStorage,
} from "@/lib/forecast/storage";

type Props = {
  forecast: DailyForecast;
  maturityLabel?: string;
  onClose?: () => void;
};

function splitEvidence(forecast: DailyForecast["emotionForecast"]) {
  return {
    traditional: forecast.evidence.filter((e) => e.kind === "traditional"),
    observed: forecast.evidence.filter((e) => e.kind === "observed"),
    recent: forecast.evidence.filter((e) => e.kind === "recent"),
    caution: forecast.evidence.filter((e) => e.kind === "caution"),
  };
}

function DomainCard({
  title,
  block,
}: {
  title: string;
  block: DailyForecast["emotionForecast"];
}) {
  const ev = splitEvidence(block);
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
      <EvidenceDisclosure {...ev} />
    </div>
  );
}

export default function NightTomorrowReport({
  forecast,
  maturityLabel,
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
          <p className="ui-hint">
            {maturityLabel ?? MATURITY_LABELS[forecast.maturity]}
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
          <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
            가설이에요. 단정이 아닙니다.
          </p>
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
          {forecast.neededCondition.evidence.length > 0 && (
            <ul className="list-disc pl-4 text-[11px]" style={{ color: "var(--px-text2)" }}>
              {forecast.neededCondition.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
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
          <p className="ui-hint">{forecast.oneAction.reason}</p>
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

        <section
          className="p-2 border text-[11px] space-y-1"
          style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
        >
          <p className="font-black">분석 근거</p>
          <p>
            표본 — 간지 {forecast.sampleSizes.ganji} · 십신{" "}
            {forecast.sampleSizes.tenGod} · 천간 {forecast.sampleSizes.stem} · 지지{" "}
            {forecast.sampleSizes.branch}
          </p>
          <p>{forecast.recentStateSummary}</p>
          <p>{forecast.disclaimer}</p>
          <p>
            생성: {forecast.generationMode === "ai_assisted" ? "로컬+AI 문구" : "로컬 규칙"}{" "}
            · {forecast.ruleVersion}
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
            href="/"
            className="flex-1 py-2.5 text-sm text-center font-bold border-2"
            style={{ borderColor: "var(--px-border)", color: "var(--px-text2)" }}
            onClick={onClose}
          >
            홈에서 내일 보기
          </Link>
        </div>
      </div>
    </div>
  );
}
