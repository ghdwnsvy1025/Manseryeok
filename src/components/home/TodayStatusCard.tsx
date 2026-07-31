"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { todayDateString } from "@/lib/diary/dayPillar";
import type { HomeEStats } from "@/lib/journal/homeStats";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import {
  describeRecentHappiness,
  STATUS_FOCUS_EMOJI,
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
  // 막대는 점수와 무관한 차분한 soft teal — 감정 단계는 이모지·라벨 색으로만 구분
  const barFill =
    "linear-gradient(90deg, #2dd4bf88, #5eead4)";

  return (
    <div
      className="p-3.5 border-2 space-y-3"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg3)",
      }}
      aria-label={`최근 7일 행복도 ${score}점, ${band.label} ${band.emoji}`}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p
            className="text-xs font-semibold tracking-wide"
            style={{ color: "var(--px-text2)" }}
          >
            최근 7일 행복도
          </p>
          <p
            className="text-lg font-extrabold leading-tight"
            style={{ color: band.color }}
          >
            <span className="mr-1.5" aria-hidden>
              {band.emoji}
            </span>
            {band.label}
          </p>
          <p
            className="text-xs font-medium leading-snug"
            style={{ color: "var(--px-text2)" }}
          >
            {band.description}
          </p>
        </div>
        <p
          className="shrink-0 tabular-nums leading-none font-extrabold"
          style={{ color: band.color, fontSize: "1.5rem" }}
        >
          {score.toFixed(1)}
          <span
            className="ml-1 text-xs font-semibold"
            style={{ color: "var(--px-text2)" }}
          >
            / 10
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <div
          className="relative h-3.5 border-2 overflow-hidden"
          style={{
            borderColor: "var(--px-border)",
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
              background: "var(--px-text-on-panel)",
              opacity: 0.55,
            }}
            aria-hidden
          />
        </div>
        <div
          className="flex justify-between text-xs font-semibold"
          style={{ color: "var(--px-text2)" }}
        >
          <span>낮음</span>
          <span>중간 5점</span>
          <span>높음</span>
        </div>
      </div>
    </div>
  );
}

function FocusChip({
  item,
  tone,
}: {
  item: StatusFocus;
  tone: "good" | "watch";
}) {
  const color = tone === "good" ? "#4ade80" : "#fbbf24";
  const border =
    tone === "good"
      ? "color-mix(in srgb, #4ade80 55%, var(--px-border))"
      : "color-mix(in srgb, #fbbf24 55%, var(--px-border))";
  return (
    <div
      className="p-3 border-2 space-y-1.5 min-w-0"
      style={{
        borderColor: border,
        background: "var(--px-bg3)",
      }}
    >
      <p
        className="text-sm font-black leading-snug truncate"
        style={{ color: "var(--px-text-on-panel)" }}
        title={item.value}
      >
        <span className="mr-1" aria-hidden>
          {STATUS_FOCUS_EMOJI[tone]}
        </span>
        {item.value}
      </p>
      {item.score != null && (
        <p className="text-sm font-bold tabular-nums" style={{ color }}>
          {item.score}
          <span
            className="text-xs ml-0.5 font-semibold"
            style={{ color: "var(--px-text2)" }}
          >
            /10
          </span>
        </p>
      )}
    </div>
  );
}

function FocusToneRow({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "good" | "watch";
  children: ReactNode;
}) {
  const color = tone === "good" ? "#4ade80" : "#fbbf24";
  return (
    <div
      className="space-y-2 pl-2.5"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <p className="text-xs font-black tracking-wide" style={{ color }}>
        <span className="mr-1" aria-hidden>
          {STATUS_FOCUS_EMOJI[tone]}
        </span>
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
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

  const fingerprint = recentStatusFingerprint(stats);
  const cacheDate = todayDateString();
  const hasTopics = Boolean(weekTopics && weekTopics.entryDays > 0);
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
        const data = (await res.json()) as RecentStatusPayload & {
          openAi?: OpenAiCallStatus;
        };
        if (cancelled) return;
        const next = normalizeStatusPayload(data);
        setStatus(next);
        setOpenAi(data.openAi ?? null);
        if (next) {
          saveRecentStatusCache(
            cacheDate,
            fingerprint,
            next,
            data.openAi ?? null
          );
        }
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheReady, cacheDate, fingerprint, stats]);

  // 화제별 일기 본문 종합 → 위로·조언 한 문장
  useLayoutEffect(() => {
    if (weekTopicSupportItems.length === 0) {
      setTopicLines({});
      return;
    }
    const cached = loadWeekTopicSupportCache(cacheDate, topicFp);
    if (cached) {
      setTopicLines(cached.lines);
      return;
    }
    const fallback: Record<string, string> = {};
    for (const it of weekTopicSupportItems) {
      fallback[it.topicId] = it.fallbackLine;
    }
    setTopicLines(fallback);
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
          openAi?: OpenAiCallStatus;
        };
        if (cancelled || !data.lines) return;
        setTopicLines(data.lines);
        saveWeekTopicSupportCache(
          cacheDate,
          topicFp,
          data.lines,
          data.openAi ?? null
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
    <section className="space-y-2" aria-label="최근 나의 상태">
      <div className="ui-emphasize-head">
        <WaveText className="ui-emphasize-title">최근 나의 상태</WaveText>
      </div>
      <div
        className="p-4 border-2 space-y-3.5"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
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
                {(status.coreGood || status.domainGood) && (
                  <FocusToneRow title="힘이 되는 쪽" tone="good">
                    {status.coreGood && (
                      <FocusChip item={status.coreGood} tone="good" />
                    )}
                    {status.domainGood && (
                      <FocusChip item={status.domainGood} tone="good" />
                    )}
                  </FocusToneRow>
                )}
                {(status.coreWatch || status.domainWatch) && (
                  <FocusToneRow title="살피면 좋은 쪽" tone="watch">
                    {status.coreWatch && (
                      <FocusChip item={status.coreWatch} tone="watch" />
                    )}
                    {status.domainWatch && (
                      <FocusChip item={status.domainWatch} tone="watch" />
                    )}
                  </FocusToneRow>
                )}
                {displayWeekTopics && hasTopics && (
                  <WeekTopicsCard summary={displayWeekTopics} variant="focus" />
                )}
              </div>
            )}

            {status.advice && (
              <div
                className="space-y-1.5 px-3 py-3"
                style={{
                  borderLeft: "3px solid var(--px-accent)",
                  background:
                    "color-mix(in srgb, var(--px-accent) 10%, var(--px-bg3))",
                }}
              >
                <p
                  className="text-[11px] font-black tracking-wide"
                  style={{ color: "var(--px-accent)" }}
                >
                  이렇게 해보면 좋아요
                </p>
                <p
                  className="text-sm font-bold leading-relaxed"
                  style={{ color: "var(--px-text-on-panel)", lineHeight: 1.65 }}
                >
                  {status.advice}
                </p>
              </div>
            )}
          </>
        ) : displayWeekTopics && hasTopics ? (
          <WeekTopicsCard summary={displayWeekTopics} variant="focus" />
        ) : null}

        <OpenAiOriginHint status={openAi} className="text-[10px] leading-relaxed" />
      </div>
    </section>
  );
}
