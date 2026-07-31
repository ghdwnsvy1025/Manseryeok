"use client";

/**
 * /saju 원국 종합풀이 — 종합만 공개, 세부 섹션은 잠금
 */
import { useCallback, useEffect, useState } from "react";
import type { SajuProfile } from "@/lib/diary/types";
import type { NatalReadingResult } from "@/lib/saju/reading/natalReadingTypes";
import { formatOpenAiStatus } from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Props = {
  profile: SajuProfile;
};

type ApiPayload = NatalReadingResult & {
  error?: string;
  detail?: string;
  cached?: boolean;
};

function LockedRow({ title }: { title: string }) {
  return (
    <div
      className="border px-3 py-2.5 flex items-center justify-between gap-2 opacity-55"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
    >
      <span
        className="text-sm font-black"
        style={{ color: "var(--px-text2)" }}
      >
        {title}
      </span>
      <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--px-text2)" }}>
        잠김
      </span>
    </div>
  );
}

export default function SajuNatalReadingPanel({ profile }: Props) {
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    void load();
  }, [load]);

  const lockedTitles = data
    ? [
        data.dayMaster.title,
        data.pillars.year.title,
        data.pillars.month.title,
        data.pillars.day.title,
        data.pillars.hour.title,
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

  return (
    <section className="space-y-3" aria-label="원국 종합풀이">
      <div className="ui-emphasize-head">
        <p className="ui-emphasize-title">사주 종합풀이</p>
        <button
          type="button"
          className="text-[10px] font-black shrink-0 underline"
          style={{ color: "var(--px-text2)" }}
          onClick={() => setExpanded((v) => !v)}
          disabled={loading && !data}
        >
          {expanded ? "접기" : "펼치기"}
        </button>
      </div>

      <div
        className="p-3 border-2 space-y-3"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg3)",
          boxShadow: "3px 3px 0 #4a3a00",
        }}
      >
        <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
          원국·대운 중심 · 지금은 종합만 공개
        </p>

        {loading && (
          <div
            className="py-6 space-y-2 text-center"
            role="status"
            aria-live="polite"
          >
            <p
              className="text-sm font-black"
              style={{ color: "var(--px-accent)" }}
            >
              종합풀이를 만드는 중…
            </p>
            <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
              원국을 읽고 있어요. 잠시만 기다려 주세요.
            </p>
            <div
              className="mx-auto mt-2 h-1.5 w-40 overflow-hidden border relative"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
              }}
              aria-hidden
            >
              <div
                className="absolute inset-y-0 left-0 w-1/2 animate-pulse"
                style={{ background: "var(--px-accent)" }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm font-bold" style={{ color: "#f87171" }}>
            {error}
            {error.includes("로그인") ? (
              <span
                className="block text-xs mt-1 font-bold"
                style={{ color: "var(--px-text2)" }}
              >
                로그인 후 종합풀이를 볼 수 있어요.
              </span>
            ) : null}
          </p>
        )}

        {!loading && !error && data && (
          <>
            <p
              className="text-base font-black leading-snug"
              style={{ color: "var(--px-accent)" }}
            >
              {data.headline}
            </p>
            <p
              className="text-sm font-black"
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

            {expanded && (
              <div className="space-y-2 pt-1">
                <p
                  className="text-[11px] font-bold"
                  style={{ color: "var(--px-text2)" }}
                >
                  세부 풀이는 곧 열려요
                </p>
                {lockedTitles.map((title) => (
                  <LockedRow key={title} title={title} />
                ))}
              </div>
            )}

            {isAdmin && (
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                {data.cached ? "저장본" : "새로 생성"} · 이론{" "}
                {data.theoryUsed ? "사용" : "없음"}
                {data.openAi ? ` · ${formatOpenAiStatus(data.openAi)}` : ""}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
