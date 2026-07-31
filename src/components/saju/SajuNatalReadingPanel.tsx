"use client";

/**
 * /saju 원국 종합풀이 — 채팅형 장문 섹션
 */
import { useCallback, useEffect, useState } from "react";
import type { SajuProfile } from "@/lib/diary/types";
import type { NatalReadingResult } from "@/lib/saju/reading/natalReadingTypes";
import {
  formatOpenAiStatus,
} from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";

type Props = {
  profile: SajuProfile;
};

type ApiPayload = NatalReadingResult & {
  error?: string;
  detail?: string;
  cached?: boolean;
};

function SectionBlock({
  title,
  body,
  defaultOpen = false,
}: {
  title: string;
  body: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg2)" }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className="text-sm font-black"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {title}
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {open ? "접기" : "펼치기"}
        </span>
      </button>
      {open && (
        <div
          className="px-3 pb-3 pt-0 border-t"
          style={{ borderColor: "var(--px-border)" }}
        >
          <p
            className="text-sm font-bold leading-relaxed whitespace-pre-wrap pt-2"
            style={{ color: "var(--px-text)", lineHeight: 1.75 }}
          >
            {body}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SajuNatalReadingPanel({ profile }: Props) {
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (forceRefresh = false) => {
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
            forceRefresh,
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
          setError("종합풀이 생성 시간이 너무 길어요. 다시 시도해 주세요.");
        } else {
          setError(e instanceof Error ? e.message : "요청 실패");
        }
        setData(null);
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    },
    [profile]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <section className="space-y-3" aria-label="원국 종합풀이">
      <div className="ui-emphasize-head">
        <p className="ui-emphasize-title">사주 종합풀이</p>
        <button
          type="button"
          className="text-[10px] font-black shrink-0 underline"
          style={{ color: "var(--px-text2)" }}
          onClick={() => void load(true)}
          disabled={loading}
        >
          다시 생성
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
          원국·대운 중심 장문 해석 · 이론은 고정 요약 + 보조 검색
        </p>

        {loading && (
          <p className="text-sm font-bold" style={{ color: "var(--px-text2)" }}>
            종합풀이를 만드는 중… (잠시 걸릴 수 있어요)
          </p>
        )}

        {error && (
          <p className="text-sm font-bold" style={{ color: "#f87171" }}>
            {error}
            {error.includes("로그인") ? (
              <span className="block text-xs mt-1 font-bold" style={{ color: "var(--px-text2)" }}>
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
            <p
              className="text-sm font-bold leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--px-text)", lineHeight: 1.75 }}
            >
              {data.overview.longForm}
            </p>

            <div className="space-y-2 pt-1">
              <SectionBlock
                title={data.dayMaster.title}
                body={data.dayMaster.body}
                defaultOpen
              />
              <SectionBlock
                title={data.pillars.year.title}
                body={data.pillars.year.body}
              />
              <SectionBlock
                title={data.pillars.month.title}
                body={data.pillars.month.body}
              />
              <SectionBlock
                title={data.pillars.day.title}
                body={data.pillars.day.body}
              />
              <SectionBlock
                title={data.pillars.hour.title}
                body={data.pillars.hour.body}
              />
              <SectionBlock
                title={data.domains.personality.title}
                body={data.domains.personality.body}
                defaultOpen
              />
              <SectionBlock
                title={data.domains.work.title}
                body={data.domains.work.body}
              />
              <SectionBlock
                title={data.domains.relationships.title}
                body={data.domains.relationships.body}
              />
              <SectionBlock
                title={data.domains.love.title}
                body={data.domains.love.body}
              />
              <SectionBlock
                title={data.domains.money.title}
                body={data.domains.money.body}
              />
              <SectionBlock
                title={data.domains.health.title}
                body={data.domains.health.body}
              />
              <SectionBlock
                title={data.daeun.title}
                body={[
                  data.daeun.narrative,
                  ...data.daeun.chapters.map(
                    (c) => `· ${c.label}\n${c.body}`
                  ),
                ].join("\n\n")}
                defaultOpen
              />
            </div>

            {data.growthFormula.length > 0 && (
              <div className="pt-2 space-y-1">
                <p
                  className="text-[11px] font-black"
                  style={{ color: "var(--px-accent)" }}
                >
                  성장 공식
                </p>
                {data.growthFormula.map((line) => (
                  <p
                    key={line}
                    className="text-[12px] font-bold"
                    style={{ color: "var(--px-text)" }}
                  >
                    · {line}
                  </p>
                ))}
              </div>
            )}

            <div
              className="pt-2 border-t"
              style={{ borderColor: "var(--px-border)" }}
            >
              <p
                className="text-[11px] font-black mb-1"
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
