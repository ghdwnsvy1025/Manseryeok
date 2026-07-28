"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
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

const QUOTE_LOADING_HINTS = [
  "문장을 고르는 중…",
  "기록에 맞춰 다듬는 중…",
  "오늘의 한 줄을 준비하는 중…",
] as const;

const XP_GAUGE_FILL =
  "linear-gradient(90deg, #f5d76e 0%, #d4e34a 55%, #a3e635 100%)";

const CELEBRATE_COLORS = [
  "#c8a700",
  "#f5d76e",
  "#a3e635",
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#fb923c",
  "#e8e8f0",
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  spin: number;
  color: string;
  life: number;
  maxLife: number;
};

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

  // 저장 완료 축하 파티클 — 화면 중앙에서 방사형으로 터짐 (모바일 가시성)
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

    const particles: Particle[] = [];
    const spawn = (n: number, speedScale = 1) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.42;
      for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.35;
        const speed = (140 + Math.random() * 220) * speedScale;
        particles.push({
          x: cx + (Math.random() - 0.5) * 16,
          y: cy + (Math.random() - 0.5) * 16,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          w: 4 + Math.random() * 7,
          h: 6 + Math.random() * 10,
          rot: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 8,
          color:
            CELEBRATE_COLORS[
              Math.floor(Math.random() * CELEBRATE_COLORS.length)
            ]!,
          life: 0,
          maxLife: 1.4 + Math.random() * 1.1,
        });
      }
    };

    spawn(56, 1);
    const burst2 = window.setTimeout(() => spawn(28, 0.85), 220);
    const burst3 = window.setTimeout(() => spawn(18, 0.7), 480);

    let last = performance.now();
    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const W = window.innerWidth;
      const H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        if (p.life >= p.maxLife) continue;
        p.life += dt;
        p.vy += 520 * dt;
        p.vx *= 1 - 0.55 * dt;
        p.vy *= 1 - 0.12 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        const t = p.life / p.maxLife;
        const alpha =
          t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.88);
        const scale = 1 - t * 0.35;
        if (alpha <= 0.02) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(
          (-p.w / 2) * scale,
          (-p.h / 2) * scale,
          p.w * scale,
          p.h * scale
        );
        ctx.restore();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(burst2);
      window.clearTimeout(burst3);
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
    const xpStrength = Math.min(
      5,
      Math.max(1, Math.round(xp.gainedXp / 4))
    );
    const leveledBoost = xp.leveledUp ? 2 : 0;

    const burstAtXp = window.setTimeout(() => {
      if (xpFloatRef.current) {
        burstFromElement(xpFloatRef.current, {
          variant: "xp",
          value: xpStrength + leveledBoost,
        });
      }
    }, 60);

    const burstAtGauge = window.setTimeout(() => {
      if (gaugeRef.current) {
        burstFromElement(gaugeRef.current, {
          variant: "xp",
          value: xpStrength,
        });
      }
    }, 720);

    const burstNearEnd = window.setTimeout(() => {
      if (gaugeRef.current) {
        burstFromElement(gaugeRef.current, {
          variant: "xp",
          value: Math.min(5, xpStrength + 1),
        });
      }
    }, 1100);

    const duration = 1200;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const u = Math.min(1, (t - t0) / duration);
      const e = u * u * u;
      setGauge(from + (to - from) * e);
      if (u < 1) raf = requestAnimationFrame(tick);
      else {
        setGauge(to);
        window.setTimeout(() => setXpFloatVisible(false), 700);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(burstAtXp);
      window.clearTimeout(burstAtGauge);
      window.clearTimeout(burstNearEnd);
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

  const handleShare = async () => {
    if (!quote) return;
    const shareText = isVerified
      ? `${quote}\n— ${[authorName, workTitle].filter(Boolean).join(" · ")}`
      : `${quote}\n— ${sourceLabel ?? "오늘의 문장"}`;
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
            className="p-4 border-2 space-y-3 animate-[fadeIn_0.45s_ease]"
            style={{
              borderColor: "var(--px-accent)",
              background: "var(--px-bg3)",
            }}
          >
            <p
              className="text-xs font-black"
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
                <p
                  className="text-[17px] font-bold leading-relaxed"
                  style={{ color: "var(--px-text-on-panel)" }}
                >
                  {quote ??
                    "오늘도 기록을 남겨 줘서 고마워요. 작은 한 줄이 내일의 단서가 됩니다."}
                </p>
                <p className="text-xs" style={{ color: "var(--px-text2)" }}>
                  {isVerified
                    ? [authorName, workTitle, sourceLabel]
                        .filter(Boolean)
                        .join(" · ")
                    : sourceLabel ??
                      "앱이 오늘의 기록을 바탕으로 새로 쓴 문장입니다."}
                </p>
                <div className="flex gap-2">
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
                  style={{ color: "#c8e050" }}
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

          <section className="space-y-2">
            <button
              type="button"
              className="w-full flex items-center justify-between text-xs font-bold"
              style={{ color: "var(--px-text2)" }}
              onClick={() => setShowDetail((v) => !v)}
              aria-expanded={showDetail}
            >
              <span>오늘 상태 자세히 보기</span>
              <span aria-hidden>{showDetail ? "▲" : "▼"}</span>
            </button>
            {showDetail && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {entry.overallSatisfaction != null && (
                    <span
                      className="px-2 py-1 text-[11px] font-bold border"
                      style={{
                        borderColor: "var(--px-border)",
                        color: "var(--px-text)",
                        background: "var(--px-bg3)",
                      }}
                    >
                      행복도 {entry.overallSatisfaction}/10
                    </span>
                  )}
                  {moodChip && (
                    <span
                      className="px-2 py-1 text-[11px] font-bold border"
                      style={{
                        borderColor: "var(--px-border)",
                        color: "var(--px-text)",
                        background: "var(--px-bg3)",
                      }}
                    >
                      {moodChip}
                    </span>
                  )}
                  {tagChips.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-1 text-[11px] font-bold border"
                      style={{
                        borderColor: "var(--px-border)",
                        color: "var(--px-text)",
                        background: "var(--px-bg3)",
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <ul
                  className="text-xs space-y-1"
                  style={{ color: "var(--px-text2)" }}
                >
                  {entry.scores.slice(0, 6).map((s) => (
                    <li key={s.categoryCode}>
                      {getCategoryByCode(s.categoryCode)?.name ?? s.categoryCode}
                      :{" "}
                      {s.isNotApplicable
                        ? "해당 없음"
                        : `${formatFinalScore(s.finalScore)}/10`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {shouldShowOpenAiStatus() && (
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
