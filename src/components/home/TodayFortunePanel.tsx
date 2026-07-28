"use client";

import { useEffect, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import type { FortuneSection } from "@/lib/journal/todayFortune";
import type {
  FortuneDomainCode,
  FortuneDomainResult,
} from "@/lib/journal/insight/types";
import type { CategoryCode, JournalEntry } from "@/lib/journal/types";
import {
  isDailyFortuneV2Enabled,
  isFortuneDetailsEnabled,
} from "@/lib/app/featureFlags";
import { trackContentExposure } from "@/lib/journal/exposure";
import ContentFeedbackButtons from "@/components/journal/ContentFeedbackButtons";
import { DOMAIN_KEYWORD_MAP } from "@/lib/journal/fortune/domains";
import {
  KEYWORD_CATALOG,
  type KeywordCode,
} from "@/lib/journal/keywords/catalog";
import type { FortuneEvidence } from "@/lib/journal/fortune/evidence";

type Props = {
  todayDate: string;
  sajuProfile: unknown | null;
  entries?: JournalEntry[];
  enabledCodes?: CategoryCode[];
};

const EMPTY_ENTRIES: JournalEntry[] = [];
const EMPTY_CODES: CategoryCode[] = [];

const LABEL_BY_CODE = Object.fromEntries(
  KEYWORD_CATALOG.map((k) => [k.code, k.plainLabel])
) as Record<KeywordCode, string>;

const FORTUNE_LOADING_LINES = [
  "오늘의 기운을 가만히 살피는 중…",
  "하루의 결을 천천히 풀어내는 중…",
  "마음 곁에 둘 말을 고르는 중…",
  "별자리 대신, 오늘의 흐름을 읽는 중…",
  "잠시만 — 오늘의 이야기를 모으고 있어요.",
];

function keywordLabelsForDomain(d: FortuneDomainResult): string[] {
  const fromEvidence = (d.evidenceCodes ?? [])
    .map((c) => LABEL_BY_CODE[c as KeywordCode])
    .filter((x): x is string => Boolean(x));
  if (fromEvidence.length >= 2) return fromEvidence.slice(0, 4);

  const fallbackCodes =
    DOMAIN_KEYWORD_MAP[d.domain as FortuneDomainCode] ?? [];
  const padded = [
    ...fromEvidence,
    ...fallbackCodes
      .map((c) => LABEL_BY_CODE[c])
      .filter((label): label is string => Boolean(label))
      .filter((label) => !fromEvidence.includes(label)),
  ];
  return padded.slice(0, 4);
}

/** 확신도를 숫자 대신 쉬운 말로 */
function confidencePlain(confidence: number | null | undefined): string {
  const c = confidence ?? 0;
  if (c >= 0.7) return "꽤 확실해요";
  if (c >= 0.45) return "참고해도 좋아요";
  return "참고용";
}

function KeywordChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1" aria-label="키워드">
      {labels.map((label, i) => (
        <span
          key={label}
          className="text-[10px] font-bold border px-1.5 py-0.5 leading-none motion-chip-stagger"
          style={{
            color: "var(--px-accent)",
            borderColor: "var(--px-border2)",
            background: "var(--px-bg3)",
            animationDelay: `${i * 55}ms`,
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function FortuneLoadingHint() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % FORTUNE_LOADING_LINES.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div
      className="pt-3 pb-1 flex items-start gap-2.5"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        className="mt-0.5 inline-block w-4 h-4 shrink-0 border-2 rounded-full animate-spin"
        style={{
          borderColor: "var(--px-border2)",
          borderTopColor: "var(--px-accent)",
        }}
        aria-hidden
      />
      <div className="min-w-0 space-y-0.5">
        <p
          className="text-[11px] font-black tracking-wide"
          style={{ color: "var(--px-accent)" }}
        >
          불러오는 중
        </p>
        <p
          className="text-xs leading-relaxed font-bold"
          style={{ color: "var(--px-text2)" }}
        >
          {FORTUNE_LOADING_LINES[idx]}
        </p>
      </div>
    </div>
  );
}

type V2Payload = {
  version?: string;
  overall?: FortuneDomainResult;
  domains?: FortuneDomainResult[];
  openAi?: OpenAiCallStatus;
  evidence?: FortuneEvidence | null;
  insight?: {
    primaryKeyword?: string | null;
    tensionKeyword?: string | null;
    overallConfidence?: number;
  };
};

/** 0~1 값을 가로 막대로 표시 */
function MeterBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className="h-1.5 w-full border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg3)" }}
    >
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: color ?? "var(--px-accent)",
        }}
      />
    </div>
  );
}

function WeightRow({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color?: string;
  hint: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="text-[11px] font-black"
          style={{ color: "var(--px-text)" }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-black tabular-nums"
          style={{ color: "var(--px-accent)" }}
        >
          {pct}%
        </span>
      </div>
      <MeterBar value={value} color={color} />
      <p className="text-[10px] leading-tight" style={{ color: "var(--px-text2)" }}>
        {hint}
      </p>
    </div>
  );
}

function FortuneEvidencePanel({ evidence }: { evidence: FortuneEvidence }) {
  const maturityPct = Math.round(evidence.maturity * 100);
  return (
    <div
      className="mt-1 p-2.5 space-y-3 border"
      style={{ borderColor: "var(--px-border2)", background: "var(--px-bg3)" }}
    >
      <div
        className="p-2 border-2 flex items-center justify-center gap-1 text-center"
        style={{ borderColor: "var(--px-accent)", background: "var(--px-bg2)" }}
      >
        <span className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          지금 운세 = 내 기록 {Math.round(evidence.weights.recent * 100 + evidence.weights.keyword * 100)}%
        </span>
        <span className="text-sm font-black" style={{ color: "var(--px-text2)" }}>
          + 사주 {Math.round(evidence.weights.natal * 100)}%
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-black" style={{ color: "var(--px-text)" }}>
            운세 맞춤 · {evidence.tierLabel}
          </span>
          <span
            className="text-[11px] font-black tabular-nums"
            style={{ color: "var(--px-accent)" }}
          >
            {maturityPct}%
          </span>
        </div>
        <MeterBar value={evidence.maturity} />
        <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
          Lv{evidence.level} · XP {evidence.effectiveXp}
          {evidence.onboardingCompleted ? " (온보딩 보정 포함)" : ""}
          . 레벨이 오를수록 개인 데이터 비중이 커지고 사주 비중은 줄어듭니다.
          (맞춤도 상한: Lv{evidence.maturityLevel})
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
          신호 혼합 비율
        </p>
        <WeightRow
          label="최근 상태(내 기록)"
          value={evidence.weights.recent}
          color="var(--px-accent)"
          hint="일기·체크인에서 뽑은 최근 카테고리 점수"
        />
        <WeightRow
          label="키워드 흐름"
          value={evidence.weights.keyword}
          color="var(--px-text)"
          hint="요즘 자주 올라오는 주제(현저성)"
        />
        <WeightRow
          label="사주×오늘 일진"
          value={evidence.weights.natal}
          color="var(--px-text2)"
          hint="원국 특징과 오늘 간지를 엮은 이론 신호"
        />
      </div>

      {evidence.natalDay && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
            원국 × 오늘 ({evidence.natalDay.ganjiKo})
          </p>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text)" }}>
            {evidence.natalDay.overallTraitPlain}
          </p>
          {evidence.natalDay.domains.map((d) => (
            <div key={d.domain} className="space-y-0.5">
              <p className="text-[10px] font-black" style={{ color: "var(--px-text2)" }}>
                {d.domain} · {d.tensionKind}
                {d.keywordLabels.length > 0
                  ? ` · ${d.keywordLabels.join("·")}`
                  : ""}
              </p>
              <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
                {d.tensionPlain}
              </p>
            </div>
          ))}
        </div>
      )}

      {evidence.topKeywords.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-black" style={{ color: "var(--px-accent)" }}>
            지금 뜨는 키워드
          </p>
          <div className="space-y-1">
            {evidence.topKeywords.map((k) => (
              <div key={k.code} className="flex items-center gap-2">
                <span
                  className="text-[10px] font-bold shrink-0 w-16 truncate"
                  style={{ color: "var(--px-text)" }}
                >
                  {k.plainLabel}
                </span>
                <div className="flex-1">
                  <MeterBar value={Math.min(1, k.score / 6)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed" style={{ color: "var(--px-text2)" }}>
        {confidencePlain(evidence.overallConfidence)} · 표본이 적으면 해석이
        가운데(균형) 쪽으로 당겨집니다.
      </p>
    </div>
  );
}

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
  const [evidence, setEvidence] = useState<FortuneEvidence | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
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
          setEvidence(data.evidence ?? null);
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
      <section className="space-y-2" aria-label="오늘의 운세">
        <div className="flex items-baseline justify-between gap-2">
          <p className="ui-section-title">■ 오늘의 운세</p>
          <button
            type="button"
            className="text-xs font-bold underline shrink-0"
            style={{ color: "var(--px-text2)" }}
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
            {open ? "접기" : "펼치기"}
          </button>
        </div>

        <div
          className="p-3 border-2 space-y-2"
          style={{
            borderColor: "var(--px-border)",
            background: "var(--px-bg2)",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          {!overall && <FortuneLoadingHint />}
          {overall && (
            <div className="space-y-1">
              <p className="text-xs font-semibold" style={{ color: "var(--px-accent)" }}>
                {overall.title}
              </p>
              <p className="text-sm font-bold leading-snug" style={{ color: "var(--px-text)" }}>
                {overall.headline}
              </p>
              {!open && (
                <p className="text-[11px] leading-snug" style={{ color: "var(--px-text2)" }}>
                  펼치면 설명과 테마 한 줄을 볼 수 있어요
                </p>
              )}
            </div>
          )}

          <div className="motion-expand" data-open={open ? "true" : "false"}>
            <div className="motion-expand-inner">
              {open && overall && (
                <div className="space-y-2">
                  <KeywordChips labels={keywordLabelsForDomain(overall)} />
                  <p className="text-xs leading-relaxed" style={{ color: "var(--px-text2)" }}>
                    {overall.summary}
                  </p>

                  {evidence && (
                    <div className="pt-0.5">
                      <button
                        type="button"
                        className="text-[11px] font-black underline"
                        style={{ color: "var(--px-accent)" }}
                        onClick={() => {
                          setShowEvidence(true);
                          void trackContentExposure({
                            eventDate: todayDate,
                            contentType: "daily_fortune",
                            contentId: "evidence",
                            eventType: "fortune_evidence_opened",
                          });
                        }}
                        aria-expanded={showEvidence}
                      >
                        근거 보기 ▼
                      </button>
                    </div>
                  )}

                  {detailsEnabled &&
                    domains.map((d) => {
                      const expanded = expandedDomain === d.domain;
                      const labels = keywordLabelsForDomain(d);
                      return (
                        <div
                          key={d.domain}
                          className="border-t pt-2"
                          style={{ borderColor: "var(--px-border)" }}
                        >
                          <button
                            type="button"
                            className="w-full flex items-start justify-between gap-2 text-left"
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
                            <span className="min-w-0 space-y-0.5">
                              <span
                                className="block text-[11px] font-black"
                                style={{ color: "var(--px-accent)" }}
                              >
                                {d.title}
                              </span>
                              <span
                                className="block text-xs font-bold leading-snug"
                                style={{ color: "var(--px-text)" }}
                              >
                                {d.headline}
                              </span>
                            </span>
                            <span
                              className="text-[10px] shrink-0 pt-0.5"
                              style={{ color: "var(--px-text2)" }}
                            >
                              {expanded ? "접기" : "더보기"}
                            </span>
                          </button>
                          {expanded && (
                            <div className="mt-1.5 space-y-1">
                              <KeywordChips labels={labels} />
                              <p
                                className="text-[11px] font-semibold"
                                style={{ color: "var(--px-text2)" }}
                              >
                                {confidencePlain(d.confidence)}
                              </p>
                              <p
                                className="text-xs leading-relaxed"
                                style={{ color: "var(--px-text2)" }}
                              >
                                {d.summary}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--px-text)" }}>
                                기회 · {d.opportunity}
                              </p>
                              <p className="text-[11px]" style={{ color: "var(--px-text)" }}>
                                주의 · {d.caution}
                              </p>
                              <p
                                className="text-[11px] font-bold"
                                style={{ color: "var(--px-accent)" }}
                              >
                                오늘 · {d.action}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  <div className="pt-2 space-y-2">
                    <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
                      이 내용이 잘 맞나요?
                    </p>
                    <ContentFeedbackButtons
                      eventDate={todayDate}
                      contentType="daily_fortune"
                      contentId="overall"
                    />
                  </div>

                  {shouldShowOpenAiStatus() && openAi && (
                    <p className="text-[10px] pt-1" style={{ color: "var(--px-text2)" }}>
                      {formatOpenAiStatus(openAi)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {showEvidence && evidence && (
          <div
            className="fixed inset-0 z-[88] flex items-end justify-center motion-modal-backdrop"
            style={{ background: "rgba(0,0,0,0.55)" }}
            role="dialog"
            aria-modal="true"
            aria-label="운세 근거"
            onClick={() => setShowEvidence(false)}
          >
            <div
              className="w-full max-w-md max-h-[75dvh] overflow-y-auto border-2 p-3 space-y-2 motion-bottom-sheet"
              style={{
                background: "var(--px-bg2)",
                borderColor: "var(--px-accent)",
                boxShadow: "0 -4px 0 #000",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
                  근거 보기
                </p>
                <button
                  type="button"
                  className="text-xs font-bold"
                  style={{ color: "var(--px-text2)" }}
                  onClick={() => setShowEvidence(false)}
                >
                  닫기
                </button>
              </div>
              <FortuneEvidencePanel evidence={evidence} />
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-2" aria-label="오늘의 운세">
      <div className="flex items-baseline justify-between gap-2">
        <p className="ui-section-title">■ 오늘의 운세</p>
        <button
          type="button"
          className="text-xs font-bold underline shrink-0"
          style={{ color: "var(--px-text2)" }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>
      <div className="motion-expand" data-open={open ? "true" : "false"}>
        <div className="motion-expand-inner">
          {open && (
            <div
              className="p-3 border-2 space-y-2"
              style={{
                borderColor: "var(--px-border)",
                background: "var(--px-bg2)",
                boxShadow: "2px 2px 0 #000",
              }}
            >
              {loading && <FortuneLoadingHint />}
              {!loading &&
                sections.map((s) => (
                  <div key={s.id} className="space-y-0.5">
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
        </div>
      </div>
    </section>
  );
}
