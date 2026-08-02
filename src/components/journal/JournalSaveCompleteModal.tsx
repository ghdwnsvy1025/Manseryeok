"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { progressFromTotalXp } from "@/lib/product/personalizationLevel";
import { formatFinalScore } from "@/lib/journal/finalScore";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import type { JournalEntry } from "@/lib/journal/types";
import type { JournalSaveResult } from "@/lib/journal/storage";
import ContentFeedbackButtons from "@/components/journal/ContentFeedbackButtons";
import OpenAiOriginHint from "@/components/journal/OpenAiOriginHint";
import { submitContentFeedback } from "@/lib/journal/contentFeedback";
import { trackContentExposure } from "@/lib/journal/exposure";
import { burstFromElement } from "@/lib/ui/clickBurst";
import { XP_GAUGE_FILL, XP_GAIN_COLOR } from "@/lib/ui/xpGauge";
import EmotionalLoadingHint from "@/components/ui/EmotionalLoadingHint";
import CherryBlossomLayer from "@/components/motion/CherryBlossomLayer";
import { shareAppText } from "@/lib/app/shareInvite";

type Props = {
  entry: JournalEntry;
  xp: JournalSaveResult["xp"];
  uniqueDays: number;
  openAiExtract: OpenAiCallStatus | null;
  aiSummary: string | null;
  aiExtracting?: boolean;
  quote: string | null;
  quoteOpenAi: OpenAiCallStatus | null;
  quoteLoading: boolean;
  contentType?: string | null;
  sourceLabel?: string | null;
  authorName?: string | null;
  workTitle?: string | null;
  deliveryId?: string | null;
  onClose: () => void;
};

export default function JournalSaveCompleteModal({
  entry,
  xp,
  uniqueDays,
  openAiExtract,
  aiSummary,
  aiExtracting = false,
  quote,
  quoteOpenAi,
  quoteLoading,
  contentType,
  sourceLabel,
  authorName,
  workTitle,
  deliveryId,
  onClose,
}: Props) {
  const [gauge, setGauge] = useState(0);
  const [xpFloatVisible, setXpFloatVisible] = useState(false);
  const [sharedLocal, setSharedLocal] = useState(false);
  const [showDetail, setShowDetail] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const xpFloatRef = useRef<HTMLParagraphElement>(null);
  const blossomFiredRef = useRef(false);
  const [blossomToken, setBlossomToken] = useState(0);
  const isVerified = contentType === "verified_quote";
  const title = isVerified ? "오늘의 명언" : "오늘의 문장";
  /** 계산 전·중에는 폴백 문장 대신 로딩 UI */
  const showQuoteLoading = quoteLoading || (!quote && !quoteOpenAi);

  const progress = progressFromTotalXp(xp.totalXp);
  const startProgress = useMemo(
    () =>
      progressFromTotalXp(Math.max(0, xp.totalXp - Math.max(0, xp.gainedXp))),
    [xp.totalXp, xp.gainedXp]
  );

  const moodChip =
    entry.moodLabel ?? entry.moodLabels?.[0] ?? null;
  const tagChips = entry.tags.map((t) => getTagName(t.tagCode)).filter(Boolean);

  // 명언/문장 로딩이 끝난 뒤에만 벚꽃 (모달 오픈·로딩 중에는 안 함)
  useEffect(() => {
    if (showQuoteLoading) {
      blossomFiredRef.current = false;
      return;
    }
    if (blossomFiredRef.current) return;
    blossomFiredRef.current = true;
    setBlossomToken((n) => n + 1);
  }, [showQuoteLoading]);

  useEffect(() => {
    const from = startProgress.progressRatio;
    const to = progress.progressRatio;
    setGauge(from);

    if (xp.gainedXp <= 0 || !xp.wasFirstSaveOfDay) {
      setGauge(to);
      setXpFloatVisible(false);
      return;
    }

    setXpFloatVisible(true);
    // 밤 감성: XP 버스트는 한 번만, 약하게
    const xpStrength = xp.leveledUp ? 2 : 1;

    const burstAtXp = window.setTimeout(() => {
      if (xpFloatRef.current) {
        burstFromElement(xpFloatRef.current, {
          variant: "xp",
          value: xpStrength,
        });
      }
    }, 180);

    // 게이지 채움 — 천천히 (ease-out cubic)
    const duration = 2600;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const u = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - u, 3);
      setGauge(from + (to - from) * e);
      if (u < 1) raf = requestAnimationFrame(tick);
      else {
        setGauge(to);
        window.setTimeout(() => setXpFloatVisible(false), 900);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(burstAtXp);
    };
  }, [
    startProgress.progressRatio,
    progress.progressRatio,
    xp.gainedXp,
    xp.wasFirstSaveOfDay,
    xp.leveledUp,
  ]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!quote || quoteLoading) return;
    void trackContentExposure({
      eventDate: entry.entryDate,
      contentType: contentType ?? "app_original_sentence",
      contentId: deliveryId,
      eventType: isVerified ? "quote_impression" : "sentence_impression",
      metadata: { surface: "save_modal" },
    });
    void import("@/lib/analytics/posthog")
      .then(({ ANALYTICS_EVENTS, captureEvent }) => {
        captureEvent(ANALYTICS_EVENTS.quoteShown, {
          verified: isVerified,
        });
      })
      .catch(() => {
        /* analytics optional */
      });
  }, [quote, quoteLoading, entry.entryDate, contentType, deliveryId, isVerified]);

  const attributionLine = isVerified
    ? [authorName, workTitle].filter(Boolean).join(" · ") ||
      sourceLabel ||
      "고전 명언"
    : sourceLabel ?? "앱이 오늘의 기록을 바탕으로 새로 쓴 문장입니다.";

  const handleShare = async () => {
    if (!quote) return;
    const body = `${quote}\n— ${attributionLine}`;
    try {
      await shareAppText(body, "/");
      setSharedLocal(true);
      void submitContentFeedback({
        eventDate: entry.entryDate,
        contentType: contentType ?? "app_original_sentence",
        contentId: deliveryId,
        shared: true,
      });
    } catch {
      /* ignore cancel / unavailable */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.6)" }}
      role="dialog"
      aria-modal="true"
      aria-label="저장 완료"
      onClick={onClose}
    >
      <div
        className="home-celebrate-banner relative z-10 w-full max-w-sm max-h-[88dvh] border-2 flex flex-col"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1">
            <p
              className="text-lg font-black leading-tight"
              style={{ color: "var(--px-accent)" }}
            >
              {xp.wasFirstSaveOfDay
                ? "오늘도 기록 완료"
                : "기록을 더 다듬었어요"}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
              {xp.wasFirstSaveOfDay
                ? "남긴 기록으로 오늘의 문장을 준비했어요."
                : "오늘의 명언은 그대로 두고, 기록만 반영했어요."}
            </p>
          </div>

          <section
            className={`p-4 border-2 space-y-3 relative overflow-hidden ${
              showQuoteLoading ? "" : "save-quote-card"
            }`}
            style={{
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
            }}
          >
            {!showQuoteLoading && (
              <span className="save-quote-shimmer" aria-hidden />
            )}
            <p
              className="text-xs font-black relative"
              style={{ color: "var(--px-accent)" }}
            >
              {showQuoteLoading ? "오늘의 명언" : title}
            </p>

            {showQuoteLoading ? (
              <EmotionalLoadingHint status="오늘의 한 줄을 고르는 중…" intervalMs={4200} />
            ) : (
              <>
                <blockquote className="save-quote-reveal relative m-0 space-y-2">
                  <p
                    className="text-[17px] font-bold leading-relaxed tracking-tight"
                    style={{ color: "var(--px-text-on-panel)", lineHeight: 1.65 }}
                  >
                    {quote ??
                      "오늘도 기록을 남겨 줘서 고마워요. 작은 한 줄이 내일의 단서가 됩니다."}
                  </p>
                  <p
                    className="save-quote-attr text-[11px] font-medium"
                    style={{ color: "var(--px-text2)" }}
                  >
                    — {attributionLine}
                  </p>
                  <OpenAiOriginHint
                    status={quoteOpenAi}
                    className="text-[10px] leading-relaxed"
                  />
                </blockquote>
                <div className="save-quote-actions relative">
                  <button
                    type="button"
                    className="w-full min-h-10 px-3 text-sm font-black border-2"
                    style={{
                      borderColor: sharedLocal
                        ? "var(--px-accent)"
                        : "#000",
                      color: sharedLocal ? "var(--px-accent)" : "#111",
                      background: sharedLocal
                        ? "color-mix(in srgb, var(--px-accent) 14%, var(--px-bg2))"
                        : "var(--px-accent)",
                      boxShadow: sharedLocal ? "none" : "2px 2px 0 #000",
                    }}
                    onClick={() => void handleShare()}
                    title="앱 링크와 함께 공유해요"
                  >
                    {sharedLocal ? "공유됨 · 링크 포함" : "친구에게 공유"}
                  </button>
                </div>
              </>
            )}
          </section>

          {!showQuoteLoading && (
            <section
              className="pt-1"
              style={{ borderTop: "1px solid var(--px-border)" }}
            >
              <ContentFeedbackButtons
                eventDate={entry.entryDate}
                contentType={contentType ?? "app_original_sentence"}
                contentId={deliveryId}
                mode="help"
                prompt="이 문장이 도움이 되었나요?"
              />
            </section>
          )}

          <section
            className="p-3 border-2 space-y-2"
            style={{
              borderColor: "var(--px-border)",
              background: "var(--px-bg3)",
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p
                className="text-sm font-black"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                Lv{xp.level}
                {xp.leveledUp ? " · 레벨업!" : ""}
                <span
                  className="ml-1.5 text-xs font-bold"
                  style={{ color: "var(--px-text2)" }}
                >
                  · 기록 {uniqueDays}일
                </span>
              </p>
              {xp.wasFirstSaveOfDay && xp.gainedXp > 0 && (
                <p
                  ref={xpFloatRef}
                  className={`text-base font-black tabular-nums ${
                    xpFloatVisible ? "save-xp-float" : ""
                  }`}
                  style={{ color: XP_GAIN_COLOR }}
                >
                  +{xp.gainedXp} XP
                </p>
              )}
            </div>
            <div
              ref={gaugeRef}
              className="h-3 border-2 overflow-hidden relative"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
              aria-hidden
            >
              <div
                className="h-full transition-none save-xp-gauge-fill"
                style={{
                  width: `${Math.round(gauge * 100)}%`,
                  background: XP_GAUGE_FILL,
                }}
              />
            </div>
            <p className="text-[11px] tabular-nums" style={{ color: "var(--px-text2)" }}>
              {progress.isMax
                ? "최고 레벨에 도달했어요."
                : `다음 레벨까지 ${progress.xpToNext} XP`}
              {!xp.wasFirstSaveOfDay ? " · 오늘 기록 유지됨" : ""}
            </p>
          </section>

          {aiExtracting ? (
            <p
              className="text-xs leading-relaxed flex items-center gap-1.5"
              style={{ color: "var(--px-text2)" }}
            >
              <span
                className="inline-block w-3 h-3 border-2 rounded-full animate-spin"
                style={{
                  borderColor: "var(--px-border)",
                  borderTopColor: "var(--px-accent)",
                }}
                aria-hidden
              />
              AI가 기록을 정리하고 있어요…
            </p>
          ) : (
            aiSummary && (
              <section className="space-y-1">
                <p className="text-[11px] font-bold" style={{ color: "var(--px-text2)" }}>
                  오늘 기록 한줄 요약
                </p>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--px-text-on-panel)" }}
                >
                  {aiSummary}
                </p>
              </section>
            )
          )}

          <section className="space-y-1.5">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 py-0.5"
              style={{ color: "var(--px-text2)" }}
              onClick={() => setShowDetail((v) => !v)}
              aria-expanded={showDetail}
            >
              <span className="text-[11px] font-bold tracking-tight">
                오늘 상태 자세히 보기
              </span>
              <span
                className="text-[10px] tabular-nums opacity-80"
                aria-hidden
              >
                {showDetail ? "접기 ▲" : "펼치기 ▼"}
              </span>
            </button>
            {showDetail && (
              <div
                className="rounded-sm border px-2.5 py-2 space-y-2"
                style={{
                  borderColor: "var(--px-border)",
                  background:
                    "color-mix(in srgb, var(--px-bg3) 70%, var(--px-bg2))",
                }}
              >
                {(entry.overallSatisfaction != null ||
                  moodChip ||
                  tagChips.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {entry.overallSatisfaction != null && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold leading-none"
                        style={{
                          color: "var(--px-accent)",
                          background:
                            "color-mix(in srgb, var(--px-accent) 12%, transparent)",
                        }}
                      >
                        <span className="opacity-70 font-medium">행복</span>
                        {entry.overallSatisfaction}
                        <span className="opacity-50">/10</span>
                      </span>
                    )}
                    {moodChip && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-bold leading-none"
                        style={{
                          color: "var(--px-text-on-panel)",
                          background: "var(--px-bg2)",
                        }}
                      >
                        {moodChip}
                      </span>
                    )}
                    {tagChips.slice(0, 6).map((name) => (
                      <span
                        key={name}
                        className="px-1.5 py-0.5 text-[10px] font-medium leading-none"
                        style={{
                          color: "var(--px-text2)",
                          background: "var(--px-bg2)",
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {entry.scores.slice(0, 6).map((s) => {
                    const name =
                      getCategoryByCode(s.categoryCode)?.name ?? s.categoryCode;
                    const na = s.isNotApplicable;
                    const val =
                      !na && typeof s.finalScore === "number"
                        ? Math.max(0, Math.min(10, s.finalScore))
                        : null;
                    const pct = val != null ? (val / 10) * 100 : 0;
                    return (
                      <div key={s.categoryCode} className="min-w-0 space-y-0.5">
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className="text-[10px] font-medium truncate"
                            style={{ color: "var(--px-text2)" }}
                            title={name}
                          >
                            {name}
                          </span>
                          <span
                            className="text-[10px] font-bold tabular-nums shrink-0"
                            style={{
                              color: na
                                ? "var(--px-text2)"
                                : "var(--px-text-on-panel)",
                            }}
                          >
                            {na ? "—" : `${formatFinalScore(s.finalScore)}`}
                          </span>
                        </div>
                        <div
                          className="h-[3px] w-full overflow-hidden"
                          style={{ background: "var(--px-bg2)" }}
                          aria-hidden
                        >
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              background: na
                                ? "transparent"
                                : "color-mix(in srgb, var(--px-accent) 55%, #a3e635)",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {openAiExtract && (
            <OpenAiOriginHint status={openAiExtract} surface="scores" />
          )}
        </div>

        <div
          className="shrink-0 p-3 border-t-2 space-y-2.5"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
          }}
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ui-primary-btn w-full py-2.5 text-sm"
          >
            홈으로
          </button>
        </div>
      </div>

      {/* 패널 위에 그려야 모바일에서도 가려지지 않음 */}
      <CherryBlossomLayer playToken={blossomToken} zIndex={120} />
    </div>
  );
}
