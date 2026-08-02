"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { todayDateString } from "@/lib/diary/dayPillar";
import type { HomeEStats } from "@/lib/journal/homeStats";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import {
  buildTemplateRecentStatus,
  describeRecentHappiness,
  type RecentStatusPayload,
  type StatusFocus,
} from "@/lib/journal/recentStatus";
import {
  loadRecentStatusCache,
  recentStatusFingerprint,
  saveRecentStatusCache,
} from "@/lib/journal/recentStatusCache";
import OpenAiOriginHint from "@/components/journal/OpenAiOriginHint";
import WaveText from "@/components/motion/WaveText";
import WeekTopicsCard from "@/components/journal/WeekTopicsCard";
import type { WeekTopicSummary } from "@/lib/journal/topics/weekTopics";
import {
  buildCombinedAdviceFallback,
  weekTopicSupportFingerprint,
  type WeekTopicSupportItem,
} from "@/lib/journal/topics/topicSupport";
import {
  loadWeekTopicSupportCache,
  saveWeekTopicSupportCache,
} from "@/lib/journal/topics/weekTopicSupportCache";

function normalizeStatusPayload(
  data: RecentStatusPayload & { openAi?: OpenAiCallStatus }
): RecentStatusPayload | null {
  if (!data.headline && !data.message) return null;
  return {
    headline: data.headline ?? data.message ?? "",
    coreGood: data.coreGood ?? data.good ?? null,
    coreWatch: data.coreWatch ?? data.watch ?? null,
    domainGood: data.domainGood ?? null,
    domainWatch: data.domainWatch ?? null,
    good: data.coreGood ?? data.good ?? null,
    watch: data.coreWatch ?? data.watch ?? null,
    advice: data.advice ?? "",
    message: data.message ?? data.headline ?? "",
  };
}

type Props = {
  stats: HomeEStats;
  weekTopics?: WeekTopicSummary | null;
  /** 화제별 일기 발췌 — LLM 종합용 */
  weekTopicSupportItems?: WeekTopicSupportItem[];
};

function TypewriterText({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShown("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, 18);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <p className={className} style={style} aria-label={text}>
      {shown}
      {!done && <span className="motion-type-caret" aria-hidden />}
    </p>
  );
}

function HappinessGauge({ score }: { score: number }) {
  const band = describeRecentHappiness(score);
  const pct = Math.min(100, Math.max(0, score * 10));
  const barFill = `linear-gradient(90deg, color-mix(in srgb, ${band.color} 55%, #2dd4bf), ${band.color})`;

  return (
    <div
      className="p-4 border-2 space-y-3.5"
      style={{
        borderColor: `color-mix(in srgb, ${band.color} 45%, var(--px-border2))`,
        background: `linear-gradient(165deg, color-mix(in srgb, ${band.color} 16%, var(--px-bg2)), var(--px-bg3))`,
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label={`최근 7일 행복도 ${score}점, ${band.label} ${band.emoji}`}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <p
            className="text-[13px] font-black tracking-wide"
            style={{ color: "#fafafc" }}
          >
            최근 7일 행복도
          </p>
          <p
            className="text-[1.2rem] font-black leading-tight"
            style={{ color: band.color }}
          >
            <span className="mr-1.5 text-[1.35rem]" aria-hidden>
              {band.emoji}
            </span>
            {band.label}
          </p>
        </div>
        <p
          className="shrink-0 tabular-nums leading-none font-black"
          style={{ color: "#fffef8", fontSize: "2.05rem" }}
        >
          {score.toFixed(1)}
          <span
            className="ml-1 text-[14px] font-bold"
            style={{ color: "#c8c8d4" }}
          >
            /10
          </span>
        </p>
      </div>

      <div className="space-y-2">
        <div
          className="relative h-5 border-2 overflow-hidden"
          style={{
            borderColor: "var(--px-border2)",
            background: "var(--px-bg)",
          }}
        >
          <div
            className="h-full transition-[width] duration-700"
            style={{ width: `${pct}%`, background: barFill }}
          />
          <span
            className="absolute top-0 bottom-0 w-0.5"
            style={{
              left: "50%",
              background: "#fffef8",
              opacity: 0.7,
            }}
            aria-hidden
          />
        </div>
        <div
          className="flex justify-between text-[12px] font-bold"
          style={{ color: "#d4d4e0" }}
        >
          <span>낮음</span>
          <span>중간 5점</span>
          <span>높음</span>
        </div>
      </div>
    </div>
  );
}

function pickTopFocus(
  primary: StatusFocus | null | undefined,
  secondary: StatusFocus | null | undefined,
  prefer: "high" | "low"
): StatusFocus | null {
  const a = primary ?? null;
  const b = secondary ?? null;
  if (a && !b) return a;
  if (b && !a) return b;
  if (!a || !b) return null;
  const sa = a.score;
  const sb = b.score;
  if (sa == null && sb == null) return a;
  if (sa == null) return b;
  if (sb == null) return a;
  if (prefer === "high") return sa >= sb ? a : b;
  return sa <= sb ? a : b;
}

function FocusToneSquare({
  title,
  item,
  tone,
}: {
  title: string;
  item: StatusFocus;
  tone: "good" | "watch";
}) {
  const color = tone === "good" ? "#86efac" : "#fcd34d";
  const glyph = tone === "good" ? "👍" : "👀";
  const border =
    tone === "good"
      ? "color-mix(in srgb, #4ade80 60%, var(--px-border))"
      : "color-mix(in srgb, #fbbf24 60%, var(--px-border))";
  return (
    <div
      className="min-w-0 p-3 border-2 space-y-2"
      style={{
        borderColor: border,
        background: "var(--px-bg3)",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label={`${title} ${item.value}${item.score != null ? ` ${item.score}점` : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[1.35rem] leading-none" aria-hidden>
          {glyph}
        </span>
      </div>
      <p
        className="text-[1.05rem] font-black leading-snug truncate"
        style={{ color: "#fafafc" }}
        title={item.value}
      >
        {item.value}
      </p>
      {item.score != null && (
        <p
          className="text-[1.5rem] font-black tabular-nums leading-none"
          style={{ color }}
        >
          {item.score}
          <span
            className="text-[0.85rem] ml-0.5 font-semibold"
            style={{ color: "#c8c8d4" }}
          >
            /10
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * 홈 — 구조화된 "최근 나의 상태"
 * 점수·등급을 크게, 설명·조언은 밝고 덜 굵게
 * OpenAI는 당일·동일 통계 fingerprint일 때 localStorage 캐시로 재호출 생략
 */
export default function TodayStatusCard({
  stats,
  weekTopics,
  weekTopicSupportItems = [],
}: Props) {
  const [status, setStatus] = useState<RecentStatusPayload | null>(null);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cacheReady, setCacheReady] = useState(false);
  const [topicLines, setTopicLines] = useState<Record<string, string>>({});
  const [combinedAdvice, setCombinedAdvice] = useState<string | null>(null);

  const fingerprint = recentStatusFingerprint(stats);
  const cacheDate = todayDateString();
  const hasTopics = Boolean(
    weekTopics &&
      (weekTopics.topics.length > 0 || weekTopics.entryDays > 0)
  );
  const topicFp = weekTopicSupportFingerprint(weekTopicSupportItems);

  const displayWeekTopics = (() => {
    if (!weekTopics) return null;
    if (Object.keys(topicLines).length === 0) return weekTopics;
    return {
      ...weekTopics,
      topics: weekTopics.topics.map((t) => ({
        ...t,
        supportLine: topicLines[t.topicId] ?? t.supportLine,
      })),
    };
  })();
  // 페인트 전에 캐시 히트면 로딩 문구 없이 바로 표시
  useLayoutEffect(() => {
    const cached = loadRecentStatusCache(cacheDate, fingerprint);
    if (cached) {
      setStatus(cached.status);
      setOpenAi(cached.openAi);
      setLoading(false);
    } else {
      setStatus(null);
      setOpenAi(null);
      setLoading(true);
    }
    setCacheReady(true);
  }, [cacheDate, fingerprint]);

  useEffect(() => {
    if (!cacheReady) return;
    const cached = loadRecentStatusCache(cacheDate, fingerprint);
    if (cached) return;

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/journal/recent-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stats }),
        });
        const data = (await res.json().catch(() => null)) as
          | (RecentStatusPayload & { openAi?: OpenAiCallStatus; error?: string })
          | null;
        if (cancelled) return;
        const next =
          res.ok && data
            ? normalizeStatusPayload(data)
            : buildTemplateRecentStatus(stats);
        const openAiStatus =
          res.ok && data?.openAi
            ? data.openAi
            : ({ kind: "skipped", detail: "guest_or_offline" } satisfies OpenAiCallStatus);
        setStatus(next);
        setOpenAi(openAiStatus);
        if (next) {
          saveRecentStatusCache(cacheDate, fingerprint, next, openAiStatus);
        }
      } catch {
        if (!cancelled) {
          const fallback = buildTemplateRecentStatus(stats);
          setStatus(fallback);
          setOpenAi({ kind: "skipped", detail: "offline" });
          saveRecentStatusCache(cacheDate, fingerprint, fallback, {
            kind: "skipped",
            detail: "offline",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheReady, cacheDate, fingerprint, stats]);

  // 상위 화제 합쳐 조언 (+ 화제별 보조 문장)
  useLayoutEffect(() => {
    if (weekTopicSupportItems.length === 0) {
      setTopicLines({});
      setCombinedAdvice(null);
      return;
    }
    const cached = loadWeekTopicSupportCache(cacheDate, topicFp);
    if (cached) {
      setTopicLines(cached.lines);
      setCombinedAdvice(cached.combinedAdvice);
      return;
    }
    const fallback: Record<string, string> = {};
    for (const it of weekTopicSupportItems) {
      fallback[it.topicId] = it.fallbackLine;
    }
    setTopicLines(fallback);
    setCombinedAdvice(buildCombinedAdviceFallback(weekTopicSupportItems));
  }, [cacheDate, topicFp, weekTopicSupportItems]);

  useEffect(() => {
    if (weekTopicSupportItems.length === 0) return;
    const cached = loadWeekTopicSupportCache(cacheDate, topicFp);
    if (cached) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/journal/week-topic-support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asOf: cacheDate,
            topics: weekTopicSupportItems,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          lines?: Record<string, string>;
          combinedAdvice?: string;
          openAi?: OpenAiCallStatus;
        };
        if (cancelled || !data.lines) return;
        setTopicLines(data.lines);
        const combined =
          typeof data.combinedAdvice === "string" && data.combinedAdvice.trim()
            ? data.combinedAdvice.trim()
            : buildCombinedAdviceFallback(weekTopicSupportItems);
        setCombinedAdvice(combined);
        saveWeekTopicSupportCache(
          cacheDate,
          topicFp,
          data.lines,
          data.openAi ?? null,
          combined
        );
      } catch {
        /* 템플릿 폴백 유지 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheDate, topicFp, weekTopicSupportItems]);

  if (!loading && !status && !hasTopics) return null;

  const hasFocus = Boolean(
    status?.coreGood ||
      status?.coreWatch ||
      status?.domainGood ||
      status?.domainWatch
  );

  return (
    <section className="home-section home-section--status" aria-label="최근 나의 상태">
      <div className="home-section__label">
        <WaveText className="home-section__title">최근 나의 상태</WaveText>
      </div>
      <div className="home-section__body p-4 space-y-3.5">
        {loading && !status ? (
          <p
            className="text-sm font-medium"
            style={{ color: "var(--px-text2)" }}
          >
            요즘 흐름을 읽는 중…
          </p>
        ) : status ? (
          <>
            {stats.avg7 != null ? (
              <HappinessGauge score={stats.avg7} />
            ) : (
              <TypewriterText
                text={status.headline}
                className="text-lg font-extrabold leading-snug"
                style={{ color: "var(--px-text-on-panel)" }}
              />
            )}

            {(hasFocus || (displayWeekTopics && hasTopics)) && (
              <div className="space-y-3">
                {(() => {
                  const good = pickTopFocus(
                    status.coreGood,
                    status.domainGood,
                    "high"
                  );
                  const watch = pickTopFocus(
                    status.coreWatch,
                    status.domainWatch,
                    "low"
                  );
                  if (!good && !watch) return null;
                  return (
                    <div
                      className={`grid gap-2.5 ${good && watch ? "grid-cols-2" : "grid-cols-1"}`}
                    >
                      {good ? (
                        <FocusToneSquare
                          title="힘이 되는 쪽"
                          item={good}
                          tone="good"
                        />
                      ) : null}
                      {watch ? (
                        <FocusToneSquare
                          title="살피면 좋은 쪽"
                          item={watch}
                          tone="watch"
                        />
                      ) : null}
                    </div>
                  );
                })()}
                {displayWeekTopics && hasTopics && (
                  <WeekTopicsCard
                    summary={displayWeekTopics}
                    combinedAdvice={combinedAdvice}
                    variant="focus"
                  />
                )}
              </div>
            )}
          </>
        ) : displayWeekTopics && hasTopics ? (
          <WeekTopicsCard
            summary={displayWeekTopics}
            combinedAdvice={combinedAdvice}
            variant="focus"
          />
        ) : null}

        <OpenAiOriginHint status={openAi} className="text-[10px] leading-relaxed" />
      </div>
    </section>
  );
}
