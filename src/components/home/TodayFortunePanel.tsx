"use client";

import { useEffect, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import type { FortuneSection } from "@/lib/journal/todayFortune";
import type { FortuneDomainResult } from "@/lib/journal/insight/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  isDailyFortuneV2Enabled,
  isFortuneDetailsEnabled,
} from "@/lib/app/featureFlags";
import { trackContentExposure } from "@/lib/journal/exposure";
import ContentFeedbackButtons from "@/components/journal/ContentFeedbackButtons";
import Link from "next/link";

type Props = {
  todayDate: string;
  sajuProfile: unknown | null;
  entries?: JournalEntry[];
  enabledCodes?: CategoryCode[];
};

const EMPTY_ENTRIES: JournalEntry[] = [];
const EMPTY_CODES: CategoryCode[] = [];

type V2Payload = {
  version?: string;
  overall?: FortuneDomainResult;
  domains?: FortuneDomainResult[];
  openAi?: OpenAiCallStatus;
  insight?: {
    primaryKeyword?: string | null;
    tensionKeyword?: string | null;
    overallConfidence?: number;
  };
};

export default function TodayFortunePanel({
  todayDate,
  sajuProfile,
  entries = EMPTY_ENTRIES,
  enabledCodes = EMPTY_CODES,
}: Props) {
  const v2 = isDailyFortuneV2Enabled();
  const detailsEnabled = isFortuneDetailsEnabled();
  const [open, setOpen] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [sections, setSections] = useState<FortuneSection[]>([]);
  const [overall, setOverall] = useState<FortuneDomainResult | null>(null);
  const [domains, setDomains] = useState<FortuneDomainResult[]>([]);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  // 배열 참조 변경으로 무한 fetch 되지 않도록 요약 키만 의존
  const entriesKey = `${entries.length}:${entries[0]?.id ?? ""}:${entries[entries.length - 1]?.id ?? ""}`;
  const codesKey = enabledCodes.join(",");

  useEffect(() => {
    if (!v2 || previewLoaded) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setPreviewLoaded(true);
    }, 20000);
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            todayDate,
            sajuProfile,
            // 최근 60일만 전송 — 페이로드/시간 폭주 방지
            entries: entries.slice(-60),
            enabledCodes,
            skipLlm: true,
          }),
        });
        const data = (await res.json()) as V2Payload;
        if (cancelled) return;
        if (data.version === "v2" && data.overall) {
          setOverall(data.overall);
          setDomains(data.domains ?? []);
          setOpenAi(data.openAi ?? null);
          setLoaded(true);
          void trackContentExposure({
            eventDate: todayDate,
            contentType: "daily_fortune",
            contentId: "overall",
            eventType: "fortune_summary_impression",
          });
        }
        setPreviewLoaded(true);
      } catch {
        if (!cancelled) setPreviewLoaded(true);
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [v2, previewLoaded, todayDate, sajuProfile, entries, enabledCodes, entriesKey, codesKey]);

  useEffect(() => {
    if (v2 || !open || loaded) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-fortune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ todayDate, sajuProfile }),
        });
        const data = (await res.json()) as {
          sections?: FortuneSection[];
          openAi?: OpenAiCallStatus;
        };
        if (cancelled) return;
        setSections(data.sections ?? []);
        setOpenAi(data.openAi ?? null);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setOpenAi({
            kind: "failed",
            reason: "network",
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [v2, open, loaded, todayDate, sajuProfile]);

  if (v2) {
    return (
      <section
        className="border-2 overflow-hidden"
        style={{
          borderColor: "var(--px-border)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
        }}
      >
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2.5 text-left"
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              if (next) {
                void trackContentExposure({
                  eventDate: todayDate,
                  contentType: "daily_fortune",
                  contentId: "detail",
                  eventType: "fortune_detail_opened",
                });
              }
              return next;
            });
          }}
          aria-expanded={open}
        >
          <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            ■ 오늘의 운세
          </span>
          <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
            {open ? "접기" : "펼치기"}
          </span>
        </button>

        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--px-border)" }}>
          {!overall && (
            <p className="ui-hint pt-2">운세를 준비하는 중…</p>
          )}
          {overall && (
            <div className="pt-2 space-y-1">
              <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
                {overall.title}
              </p>
              <p className="text-sm font-bold leading-snug" style={{ color: "var(--px-text)" }}>
                {overall.headline}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                {overall.summary}
              </p>
            </div>
          )}

          {open &&
            detailsEnabled &&
            domains.map((d) => {
              const expanded = expandedDomain === d.domain;
              return (
                <div
                  key={d.domain}
                  className="border-t pt-2"
                  style={{ borderColor: "var(--px-border)" }}
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-left"
                    onClick={() => {
                      const next = expanded ? null : d.domain;
                      setExpandedDomain(next);
                      if (next) {
                        void trackContentExposure({
                          eventDate: todayDate,
                          contentType: "daily_fortune",
                          contentId: d.domain,
                          eventType: "fortune_domain_opened",
                        });
                      }
                    }}
                    aria-expanded={expanded}
                  >
                    <span
                      className="text-[11px] font-black"
                      style={{ color: "var(--px-accent)" }}
                    >
                      {d.title}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                      {expanded ? "−" : "+"}
                    </span>
                  </button>
                  <p className="text-xs font-bold mt-0.5" style={{ color: "var(--px-text)" }}>
                    {d.headline}
                  </p>
                  {expanded && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                        {d.summary}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--px-text)" }}>
                        기회 · {d.opportunity}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--px-text)" }}>
                        주의 · {d.caution}
                      </p>
                      <p className="text-[11px] font-bold" style={{ color: "var(--px-accent)" }}>
                        오늘 · {d.action}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

          {overall && (
            <div className="pt-2 space-y-2">
              <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                이 내용이 잘 맞나요?
              </p>
              <ContentFeedbackButtons
                eventDate={todayDate}
                contentType="daily_fortune"
                contentId="overall"
              />
              <Link
                href="/journal"
                className="inline-block text-[11px] font-black underline"
                style={{ color: "var(--px-accent)" }}
                onClick={() =>
                  void trackContentExposure({
                    eventDate: todayDate,
                    contentType: "checkin",
                    eventType: "checkin_started",
                  })
                }
              >
                오늘의 상태 체크하러 가기 →
              </Link>
            </div>
          )}

          {shouldShowOpenAiStatus() && openAi && (
            <p className="text-[10px] pt-1" style={{ color: "var(--px-text2)" }}>
              {formatOpenAiStatus(openAi)}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="border-2 overflow-hidden"
      style={{
        borderColor: "var(--px-border)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          ■ 오늘의 운세
        </span>
        <span className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          {open ? "접기" : "펼치기"}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: "var(--px-border)" }}>
          {loading && <p className="ui-hint pt-2">운세를 준비하는 중…</p>}
          {!loading &&
            sections.map((s) => (
              <div key={s.id} className="pt-2 space-y-0.5">
                <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
                  {s.title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--px-text)" }}>
                  {s.lines[0]}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                  {s.lines[1]}
                </p>
              </div>
            ))}
          {shouldShowOpenAiStatus() && openAi && (
            <p className="text-[10px] pt-1" style={{ color: "var(--px-text2)" }}>
              {formatOpenAiStatus(openAi)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
