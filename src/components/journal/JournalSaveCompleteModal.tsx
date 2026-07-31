"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { progressFromTotalXp } from "@/lib/product/personalizationLevel";
import { formatFinalScore } from "@/lib/journal/finalScore";
import { getCategoryByCode } from "@/lib/journal/categoryCatalog";
import { getTagName } from "@/lib/journal/eventTagCatalog";
import type { JournalEntry } from "@/lib/journal/types";
import type { JournalSaveResult } from "@/lib/journal/storage";
import ContentFeedbackButtons from "@/components/journal/ContentFeedbackButtons";
import { submitContentFeedback } from "@/lib/journal/contentFeedback";
import { trackContentExposure } from "@/lib/journal/exposure";
import { burstFromElement, prefersReducedMotion } from "@/lib/ui/clickBurst";
import { XP_GAUGE_FILL, XP_GAIN_COLOR } from "@/lib/ui/xpGauge";

const QUOTE_LOADING_HINTS = [
  "문장을 고르는 중…",
  "기록에 맞춰 다듬는 중…",
  "오늘의 한 줄을 준비하는 중…",
] as const;

/** 벚꽃잎 팔레트 — 연분홍·살구·옅은 흰분홍 */
const PETAL_COLORS = [
  "#f6c6d4",
  "#f2b6c8",
  "#efd0da",
  "#f8d4dc",
  "#e8a8bc",
  "#fce8ee",
];

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 잎 크기 (px) */
  size: number;
  /** 현재 회전각 (rad) */
  rot: number;
  /** 회전 속도 */
  spin: number;
  /** 좌우 흔들림 위상 */
  sway: number;
  swayAmp: number;
  swaySpeed: number;
  color: string;
  life: number;
  maxLife: number;
};

/** 벚꽃잎 한 장 — 하트에 가까운 두 잎 실 */
function drawPetal(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string
) {
  const s = size;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.55);
  ctx.bezierCurveTo(s * 0.55, s * 0.15, s * 0.45, -s * 0.55, 0, -s * 0.35);
  ctx.bezierCurveTo(-s * 0.45, -s * 0.55, -s * 0.55, s * 0.15, 0, s * 0.55);
  ctx.closePath();
  ctx.fill();
  // 가운데 옅은 결
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(0.6, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.quadraticCurveTo(s * 0.04, 0, 0, -s * 0.2);
  ctx.stroke();
}

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
  const isAdmin = useIsAdmin();
  const [gauge, setGauge] = useState(0);
  const [xpFloatVisible, setXpFloatVisible] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  const [sharedLocal, setSharedLocal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [loadingHintIdx, setLoadingHintIdx] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gaugeRef = useRef<HTMLDivElement>(null);
  const xpFloatRef = useRef<HTMLParagraphElement>(null);
  const celebrateCanvasRef = useRef<HTMLCanvasElement>(null);
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

  // 저장 완료 — 벚꽃잎이 흩날림
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = celebrateCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const petals: Petal[] = [];
    const spawn = (n: number, nearCenter = false) => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const isNarrow = W < 480;
      for (let i = 0; i < n; i++) {
        // 팝업 바로 위~중간 높이에서 바로 흩날리도록
        const y = nearCenter
          ? H * (0.18 + Math.random() * 0.28)
          : H * (0.08 + Math.random() * 0.22);
        petals.push({
          x: W * (0.12 + Math.random() * 0.76),
          y,
          vx: (Math.random() - 0.5) * (isNarrow ? 48 : 72),
          vy: 8 + Math.random() * (isNarrow ? 36 : 52),
          size: (isNarrow ? 5 : 6.5) + Math.random() * (isNarrow ? 4 : 5.5),
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 3.2,
          sway: Math.random() * Math.PI * 2,
          swayAmp: 18 + Math.random() * 28,
          swaySpeed: 1.8 + Math.random() * 2.0,
          color:
            PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]!,
          life: 0,
          maxLife: 3.2 + Math.random() * 2.2,
        });
      }
    };

    const narrow = window.innerWidth < 480;
    // 첫 파동은 화면 중상단에서 바로 터지듯
    spawn(narrow ? 18 : 26, true);
    const wave2 = window.setTimeout(() => spawn(narrow ? 8 : 12, false), 280);
    const wave3 = window.setTimeout(() => spawn(narrow ? 5 : 8, true), 700);

    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      for (const p of petals) {
        if (p.life >= p.maxLife) continue;
        p.life += dt;
        p.sway += p.swaySpeed * dt;
        p.rot += p.spin * dt;
        p.vy += 14 * dt;
        p.vy = Math.min(p.vy, 110);
        p.vx *= 1 - 0.22 * dt;
        const swayX = Math.sin(p.sway) * p.swayAmp * dt;
        p.x += p.vx * dt + swayX;
        p.y += p.vy * dt;

        const t = p.life / p.maxLife;
        const fade =
          t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.45) / 0.55);
        const alpha = fade * 0.82;
        if (alpha <= 0.02) continue;

        const flip = 0.35 + 0.65 * Math.abs(Math.sin(p.sway * 0.7 + p.rot));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(flip, 1);
        drawPetal(ctx, p.size, p.color);
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(wave2);
      window.clearTimeout(wave3);
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    if (!showQuoteLoading) {
      setLoadingHintIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingHintIdx((i) => (i + 1) % QUOTE_LOADING_HINTS.length);
    }, 1600);
    return () => window.clearInterval(id);
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

  const handleSave = () => {
    if (!quote || typeof window === "undefined") return;
    try {
      const key = `manseryeok:saved-sentences:v1`;
      const raw = window.localStorage.getItem(key);
      const list = raw ? (JSON.parse(raw) as unknown[]) : [];
      list.unshift({
        text: quote,
        contentType,
        sourceLabel,
        authorName,
        workTitle,
        entryDate: entry.entryDate,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
      setSavedLocal(true);
      void submitContentFeedback({
        eventDate: entry.entryDate,
        contentType: contentType ?? "app_original_sentence",
        contentId: deliveryId,
        saved: true,
      });
    } catch {
      /* ignore */
    }
  };

  const attributionLine = isVerified
    ? [authorName, workTitle].filter(Boolean).join(" · ") ||
      sourceLabel ||
      "고전 명언"
    : sourceLabel ?? "앱이 오늘의 기록을 바탕으로 새로 쓴 문장입니다.";

  const handleShare = async () => {
    if (!quote) return;
    const shareText = `${quote}\n— ${attributionLine}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
      }
      setSharedLocal(true);
      void submitContentFeedback({
        eventDate: entry.entryDate,
        contentType: contentType ?? "app_original_sentence",
        contentId: deliveryId,
        shared: true,
      });
    } catch {
      /* ignore */
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
              <div
                className="space-y-3"
                aria-busy="true"
                aria-live="polite"
                aria-label="오늘의 명언을 준비하는 중"
              >
                <div className="space-y-2">
                  <div className="save-quote-skel h-3.5 w-[92%]" />
                  <div className="save-quote-skel h-3.5 w-[78%]" />
                  <div className="save-quote-skel h-3.5 w-[64%]" />
                </div>
                <p
                  className="text-xs font-bold flex items-center gap-1.5"
                  style={{ color: "var(--px-text2)" }}
                >
                  <span
                    className="inline-block w-3 h-3 border-2 rounded-full animate-spin shrink-0"
                    style={{
                      borderColor: "var(--px-border)",
                      borderTopColor: "var(--px-accent)",
                    }}
                    aria-hidden
                  />
                  <span key={loadingHintIdx} className="save-quote-hint">
                    {QUOTE_LOADING_HINTS[loadingHintIdx]}
                  </span>
                </p>
              </div>
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
                </blockquote>
                <div className="save-quote-actions flex gap-2 relative">
                  <button
                    type="button"
                    className="min-h-9 px-3 text-xs font-bold border-2"
                    style={{
                      borderColor: savedLocal
                        ? "var(--px-accent)"
                        : "var(--px-border)",
                      color: savedLocal
                        ? "var(--px-accent)"
                        : "var(--px-text-on-panel)",
                      background: "var(--px-bg2)",
                    }}
                    onClick={handleSave}
                    title="이 문장을 기기에 담아 두어요"
                  >
                    {savedLocal ? "담김" : "담기"}
                  </button>
                  <button
                    type="button"
                    className="min-h-9 px-3 text-xs font-bold border-2"
                    style={{
                      borderColor: sharedLocal
                        ? "var(--px-accent)"
                        : "var(--px-border)",
                      color: sharedLocal
                        ? "var(--px-accent)"
                        : "var(--px-text-on-panel)",
                      background: "var(--px-bg2)",
                    }}
                    onClick={() => void handleShare()}
                    title="공유 창이 없으면 클립보드에 복사해요"
                  >
                    {sharedLocal ? "공유됨" : "공유"}
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

          {isAdmin && (
            <div
              className="text-[10px] space-y-0.5"
              style={{ color: "var(--px-text2)" }}
            >
              {openAiExtract && (
                <p>점수 추출: {formatOpenAiStatus(openAiExtract)}</p>
              )}
              {quoteOpenAi && (
                <p>오늘의 문장: {formatOpenAiStatus(quoteOpenAi)}</p>
              )}
            </div>
          )}
        </div>

        <div
          className="shrink-0 p-3 border-t-2"
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
      <canvas
        ref={celebrateCanvasRef}
        className="pointer-events-none fixed inset-0 z-[120]"
        aria-hidden
      />
    </div>
  );
}
