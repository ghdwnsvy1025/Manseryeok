"use client";

/**
 * /saju 원국 종합풀이 — 오늘의 운세처럼 한 칸 · 클릭 시 로딩 · 펼침
 */
import { useCallback, useEffect, useState } from "react";
import type { SajuProfile } from "@/lib/diary/types";
import type { NatalReadingResult } from "@/lib/saju/reading/natalReadingTypes";
import { formatOpenAiStatus } from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import EmotionalLoadingHint from "@/components/ui/EmotionalLoadingHint";

type Props = {
  profile: SajuProfile;
};

type ApiPayload = NatalReadingResult & {
  error?: string;
  detail?: string;
  cached?: boolean;
};

const NATAL_TEASE_LINES = [
  {
    title: "내 사주, 어떤 결일까요?",
    sub: "문을 열면 원국 종합이 보여요",
  },
  {
    title: "원국이 들려주는 이야기",
    sub: "당신만의 흐름을 짧게 읽어드려요",
  },
  {
    title: "한 줄로 만나는 나의 사주",
    sub: "눌러서 종합 풀이를 펼쳐보세요",
  },
] as const;

function LockedRow({ title }: { title: string }) {
  return (
    <div
      className="border px-3 py-2.5 flex items-center justify-between gap-2 opacity-55"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
    >
      <span className="text-sm font-black" style={{ color: "var(--px-text2)" }}>
        {title}
      </span>
      <span
        className="text-[10px] font-bold shrink-0"
        style={{ color: "var(--px-text2)" }}
      >
        잠김
      </span>
    </div>
  );
}

function NatalTeaseButton({
  onClick,
  ready,
}: {
  onClick: () => void;
  ready?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % NATAL_TEASE_LINES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);
  const line = NATAL_TEASE_LINES[idx]!;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fortune-tease w-full py-5 px-3 flex flex-col items-center text-center gap-2"
      aria-label={ready ? "사주 종합풀이 펼치기" : "사주 종합풀이 보기"}
    >
      <span className="fortune-tease-pulse" aria-hidden />
      <p
        key={line.title}
        className="fortune-tease-title text-[1.05rem] font-black leading-snug tracking-tight"
        style={{ color: "var(--px-accent)" }}
      >
        {line.title}
      </p>
      <p
        key={line.sub}
        className="fortune-tease-sub text-[12px] font-medium leading-relaxed max-w-[18rem]"
        style={{ color: "var(--px-text2)" }}
      >
        {line.sub}
      </p>
      <span
        className="mt-1 text-[11px] font-black tracking-wide fortune-tease-hint"
        style={{ color: "var(--px-text-on-panel)" }}
      >
        {ready ? "살짝 펼쳐보기 ↓" : "펼쳐서 종합 보기 ↓"}
      </span>
    </button>
  );
}

function NatalLoadingHint() {
  return <EmotionalLoadingHint status="종합풀이를 고르는 중…" />;
}

export default function SajuNatalReadingPanel({ profile }: Props) {
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("/api/saju/natal-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          sajuProfile: profile,
          sajuProfileId: profile.id,
          forceRefresh: false,
        }),
      });
      const json = (await res.json()) as ApiPayload;
      if (!res.ok) {
        setError(json.error || json.detail || `오류 ${res.status}`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setError("종합풀이 생성 시간이 너무 길어요. 잠시 후 다시 열어 주세요.");
      } else {
        setError(e instanceof Error ? e.message : "요청 실패");
      }
      setData(null);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [profile]);

  const captureNatalReadingOpened = (hadCache: boolean) => {
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(ANALYTICS_EVENTS.natalReadingOpened, "natal_reading_open", {
          surface: "saju_page",
          had_cache: hadCache,
        });
      }
    );
  };

  const openPanel = () => {
    setPanelOpen(true);
    captureNatalReadingOpened(Boolean(data));
    if (!data && !loading) {
      void load();
    }
  };

  const lockedTitles = data
    ? [
        data.domains.personality.title,
        data.domains.work.title,
        data.domains.relationships.title,
        data.domains.love.title,
        data.domains.money.title,
        data.domains.health.title,
        data.daeun.title,
        ...(data.growthFormula.length > 0 ? ["성장 공식"] : []),
      ]
    : [];

  const idle = !loading && !data && !error && !panelOpen;
  const readyClosed = Boolean(data) && !panelOpen && !loading;

  return (
    <section className="space-y-2" aria-label="원국 종합풀이">
      <div className="ui-emphasize-head">
        <p className="ui-emphasize-title">사주 종합풀이</p>
        {data && (
          <button
            type="button"
            className="text-xs font-bold underline shrink-0"
            style={{ color: "var(--px-text2)" }}
            onClick={() => {
              const next = !panelOpen;
              setPanelOpen(next);
              if (next) captureNatalReadingOpened(true);
            }}
            aria-expanded={panelOpen}
          >
            {panelOpen ? "접기" : "펼치기"}
          </button>
        )}
      </div>

      <div
        className="p-3 border-2 space-y-2"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        {idle && <NatalTeaseButton onClick={openPanel} />}

        {readyClosed && (
          <NatalTeaseButton
            ready
            onClick={() => {
              setPanelOpen(true);
              captureNatalReadingOpened(true);
            }}
          />
        )}

        {loading && !data && <NatalLoadingHint />}

        {error && !data && (
          <div className="space-y-3 py-2 text-center">
            <p
              className="text-xs font-bold leading-relaxed"
              style={{ color: "#f87171" }}
            >
              {error}
              {error.includes("로그인") ? (
                <span
                  className="block text-[11px] mt-1"
                  style={{ color: "var(--px-text2)" }}
                >
                  로그인 후 종합풀이를 볼 수 있어요.
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-black underline"
              style={{ color: "var(--px-accent)" }}
            >
              다시 시도
            </button>
          </div>
        )}

        {data && panelOpen && (
          <div className="space-y-3 fortune-readable">
            <p
              className="text-base font-black leading-snug text-center"
              style={{ color: "var(--px-accent)" }}
            >
              {data.headline}
            </p>
            <p
              className="text-sm font-black text-center"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              {data.overview.oneLiner}
            </p>

            <div
              className="pt-1 border-t space-y-1.5"
              style={{ borderColor: "var(--px-border)" }}
            >
              <p
                className="text-[11px] font-black"
                style={{ color: "var(--px-accent)" }}
              >
                종합
              </p>
              <p
                className="text-sm font-bold leading-relaxed whitespace-pre-wrap"
                style={{ color: "var(--px-text)", lineHeight: 1.75 }}
              >
                {data.summary}
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <p
                className="text-[11px] font-bold text-center"
                style={{ color: "var(--px-text2)" }}
              >
                세부 풀이는 곧 열려요
              </p>
              {lockedTitles.map((title) => (
                <LockedRow key={title} title={title} />
              ))}
            </div>

            {isAdmin && (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                {data.cached ? "저장본" : "새로 생성"} · 이론{" "}
                {data.theoryUsed ? "사용" : "없음"}
                {data.openAi ? ` · ${formatOpenAiStatus(data.openAi)}` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
