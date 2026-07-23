"use client";

import { useEffect, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { formatFinalScore } from "@/lib/journal/finalScore";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import type { JournalEntry } from "@/lib/journal/types";
import type { JournalSaveResult } from "@/lib/journal/storage";

type Props = {
  entry: JournalEntry;
  xp: JournalSaveResult["xp"];
  uniqueDays: number;
  openAiExtract: OpenAiCallStatus | null;
  aiSummary: string | null;
  quote: string | null;
  quoteOpenAi: OpenAiCallStatus | null;
  quoteLoading: boolean;
  onClose: () => void;
};

export default function JournalSaveCompleteModal({
  entry,
  xp,
  uniqueDays,
  openAiExtract,
  aiSummary,
  quote,
  quoteOpenAi,
  quoteLoading,
  onClose,
}: Props) {
  const [gauge, setGauge] = useState(0);

  useEffect(() => {
    const target = Math.min(1, xp.totalXp > 0 ? 0.35 + (xp.gainedXp > 0 ? 0.4 : 0.15) : 0.2);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setGauge(target * (0.5 - 0.5 * Math.cos(Math.PI * p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [xp.gainedXp, xp.totalXp]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label="저장 완료"
    >
      <div
        className="w-full max-w-sm max-h-[88dvh] overflow-y-auto p-4 border-2 space-y-3"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
      >
        <p className="text-base font-black" style={{ color: "var(--px-accent)" }}>
          {xp.wasFirstSaveOfDay ? "저장 완료" : "기록 업데이트"}
        </p>

        <p className="ui-hint">
          {xp.wasFirstSaveOfDay
            ? "오늘의 기록이 저장됐어요."
            : "오늘의 기록이 최신 내용으로 반영되었어요."}
        </p>

        <div className="space-y-1">
          <p className="text-xs font-bold" style={{ color: "var(--px-text)" }}>
            누적 기록 {uniqueDays}일 · L{xp.level}
            {xp.leveledUp ? " · 레벨업!" : ""}
          </p>
          {xp.wasFirstSaveOfDay ? (
            <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
              +{xp.gainedXp} XP
            </p>
          ) : (
            <p className="ui-hint">경험치는 오늘 이미 지급됐어요 (유지 {xp.dayXp} XP)</p>
          )}
          <div
            className="h-3 border-2 overflow-hidden"
            style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
            aria-hidden
          >
            <div
              className="h-full transition-none"
              style={{
                width: `${Math.round(gauge * 100)}%`,
                background: "var(--px-accent)",
              }}
            />
          </div>
        </div>

        <section className="space-y-1">
          <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
            오늘 상태 요약
          </p>
          <p className="ui-hint">
            행복도{" "}
            {entry.overallSatisfaction != null
              ? `${entry.overallSatisfaction}/10`
              : "-"}{" "}
            · 기분 {entry.moodLabel ?? "-"} · 태그{" "}
            {entry.tags.map((t) => getTagName(t.tagCode)).join(", ") || "없음"}
          </p>
          <ul className="text-[11px] space-y-0.5" style={{ color: "var(--px-text2)" }}>
            {entry.scores.slice(0, 6).map((s) => (
              <li key={s.categoryCode}>
                {getCategoryByCode(s.categoryCode)?.name ?? s.categoryCode}:{" "}
                {s.isNotApplicable
                  ? "해당 없음"
                  : `최종 ${formatFinalScore(s.finalScore)}/10`}
              </li>
            ))}
          </ul>
          {aiSummary && (
            <p className="text-xs leading-relaxed" style={{ color: "var(--px-text)" }}>
              {aiSummary}
            </p>
          )}
        </section>

        <section
          className="p-3 border space-y-1"
          style={{ borderColor: "var(--px-border)", background: "var(--px-bg3)" }}
        >
          <p className="text-[10px] font-black" style={{ color: "var(--px-accent)" }}>
            오늘의 명언
          </p>
          {quoteLoading ? (
            <p className="ui-hint">오늘의 문장을 만드는 중…</p>
          ) : (
            <p
              className="text-sm font-bold leading-relaxed"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {quote ?? "오늘도 기록을 남겨 줘서 고마워요. 작은 한 줄이 내일의 단서가 됩니다."}
            </p>
          )}
          <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
            생성된 문장입니다. 특정 인물의 명언이 아닙니다.
          </p>
        </section>

        {shouldShowOpenAiStatus() && (
          <div className="text-[10px] space-y-0.5" style={{ color: "var(--px-text2)" }}>
            {openAiExtract && (
              <p>점수 추출: {formatOpenAiStatus(openAiExtract)}</p>
            )}
            {quoteOpenAi && (
              <p>명언: {formatOpenAiStatus(quoteOpenAi)}</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="ui-primary-btn w-full py-2.5 text-sm"
        >
          확인
        </button>
      </div>
    </div>
  );
}
