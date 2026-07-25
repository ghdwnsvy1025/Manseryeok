"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { hasLocalFitFeedback } from "@/lib/journal/questionFeedback";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";
import { loadLocalKeywordBiases } from "@/lib/journal/keywords/learning";

type KeywordRow = {
  code?: string;
  plainLabel?: string;
  score?: number;
  reasons?: string[];
};

type DebugInfo = {
  isolation?: {
    ragRole?: string;
    ridgeRole?: string;
    decisionBeforeRag?: boolean;
    feedbackLearning?: boolean;
  };
  decision?: {
    focusCategory?: string | null;
    contentScore?: number | null;
    topKeywords?: string[];
  };
  sajuWeight?: number;
  priorUniqueDays?: number;
  feedbackBiasApplied?: boolean;
  leakageGuard?: {
    excludedToday?: boolean;
    priorEntryCount?: number;
  };
  keywords?: KeywordRow[];
};

type Props = {
  todayDate: string;
  enabledCodes: string[];
  entries: unknown[];
  sajuProfile: unknown | null;
};

export default function TodayQuestionCard({
  todayDate,
  enabledCodes,
  entries,
  sajuProfile,
}: Props) {
  const [question, setQuestion] = useState<string | null>(null);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordCodes, setKeywordCodes] = useState<string[]>([]);
  const [fit, setFit] = useState<"good" | "bad" | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const shownSent = useRef(false);
  const codesKey = enabledCodes.join("|");
  const entriesKey = String(entries.length);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFit(null);
    setFeedbackMsg("");
    setDebug(null);
    shownSent.current = false;
    void (async () => {
      try {
        const res = await fetch("/api/journal/today-question", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            todayDate,
            enabledCodes,
            entries,
            sajuProfile,
            keywordBiases: loadLocalKeywordBiases(),
          }),
        });
        const data = (await res.json()) as DebugInfo & {
          question?: string;
          openAi?: OpenAiCallStatus;
          error?: string;
          keywords?: KeywordRow[];
        };
        if (cancelled) return;
        const q = !res.ok
          ? "오늘 하루, 마음에 가장 남는 순간은 무엇이었나요?"
          : data.question ?? null;
        setQuestion(q);
        setOpenAi(
          !res.ok
            ? {
                kind: "failed",
                reason: "request_failed",
                detail: data.error,
              }
            : data.openAi ?? null
        );
        const rows = Array.isArray(data.keywords) ? data.keywords : [];
        const kwLabels = rows
          .map((k) => k.plainLabel)
          .filter((x): x is string => Boolean(x));
        const kwCodes = rows
          .map((k) => k.code)
          .filter((x): x is string => Boolean(x));
        setKeywords(kwLabels);
        setKeywordCodes(kwCodes);
        setDebug({
          isolation: data.isolation,
          decision: data.decision,
          sajuWeight: data.sajuWeight,
          priorUniqueDays: data.priorUniqueDays,
          feedbackBiasApplied: data.feedbackBiasApplied,
          leakageGuard: data.leakageGuard,
          keywords: rows,
        });

        if (hasLocalFitFeedback(todayDate)) {
          setFit("good");
          setFeedbackMsg("오늘 피드백을 남겨주셨어요.");
        }

        if (q && !shownSent.current) {
          shownSent.current = true;
          void reportQuestionFeedback({
            questionDate: todayDate,
            eventType: "shown",
            questionText: q,
            payload: {
              keywords: kwCodes.length > 0 ? kwCodes : kwLabels,
            },
          });
        }
      } catch (err) {
        if (!cancelled) {
          setQuestion("오늘 하루, 마음에 가장 남는 순간은 무엇이었나요?");
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
  }, [todayDate, enabledCodes, entries, sajuProfile, codesKey, entriesKey]);

  const sendFit = async (kind: "fit_good" | "fit_bad") => {
    if (!question || fit) return;
    setFit(kind === "fit_good" ? "good" : "bad");
    setFeedbackMsg(
      kind === "fit_good"
        ? "맞아요 — 다음 질문에 반영할게요."
        : "별로예요 — 다음 질문에 참고할게요."
    );
    await reportQuestionFeedback({
      questionDate: todayDate,
      eventType: kind,
      questionText: question,
      rating: kind === "fit_good" ? 5 : 2,
      payload: {
        keywords: keywordCodes.length > 0 ? keywordCodes : keywords,
      },
    });
  };

  const showDebug = shouldShowOpenAiStatus();

  return (
    <section
      className="p-3 border-2 space-y-2"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
      <p
        className="text-[10px] font-black tracking-wider"
        style={{ color: "var(--px-text2)" }}
      >
        오늘의 질문
      </p>
      {loading ? (
        <p className="ui-hint">질문을 준비하는 중…</p>
      ) : (
        <p
          className="text-sm font-bold leading-relaxed"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {question}
        </p>
      )}

      {!loading && question && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className="text-[10px] font-bold"
            style={{ color: "var(--px-text2)" }}
          >
            이 질문이 오늘과 맞나요?
          </span>
          <button
            type="button"
            disabled={fit != null}
            aria-pressed={fit === "good"}
            onClick={() => void sendFit("fit_good")}
            className="px-2.5 py-1 text-[11px] font-black border-2 disabled:opacity-50"
            style={{
              borderColor:
                fit === "good" ? "var(--px-accent)" : "var(--px-border)",
              color: fit === "good" ? "var(--px-accent)" : "var(--px-text)",
              background: "var(--px-bg3)",
            }}
          >
            맞아요
          </button>
          <button
            type="button"
            disabled={fit != null}
            aria-pressed={fit === "bad"}
            onClick={() => void sendFit("fit_bad")}
            className="px-2.5 py-1 text-[11px] font-black border-2 disabled:opacity-50"
            style={{
              borderColor:
                fit === "bad" ? "var(--px-accent)" : "var(--px-border)",
              color: fit === "bad" ? "var(--px-accent)" : "var(--px-text)",
              background: "var(--px-bg3)",
            }}
          >
            별로예요
          </button>
          {feedbackMsg && <p className="ui-hint w-full">{feedbackMsg}</p>}
        </div>
      )}

      {shouldShowOpenAiStatus() && openAi && (
        <p className="text-[10px]" style={{ color: "var(--px-text2)" }}>
          {formatOpenAiStatus(openAi)}
        </p>
      )}

      {showDebug && debug && (
        <div className="pt-1 border-t" style={{ borderColor: "var(--px-border)" }}>
          <button
            type="button"
            className="text-[10px] font-bold underline"
            style={{ color: "var(--px-text2)" }}
            onClick={() => setDebugOpen((v) => !v)}
          >
            {debugOpen ? "근거 닫기" : "질문 근거(디버그)"}
          </button>
          {debugOpen && (
            <div
              className="mt-2 space-y-1 text-[10px] font-mono leading-relaxed"
              style={{ color: "var(--px-text2)" }}
            >
              <p>
                focus: {debug.decision?.focusCategory ?? "—"} · score:{" "}
                {debug.decision?.contentScore ?? "—"}
              </p>
              <p>
                keywords: {(debug.decision?.topKeywords ?? []).join(", ") || "—"}
              </p>
              <p>
                sajuWeight: {debug.sajuWeight ?? "—"} · priorDays:{" "}
                {debug.priorUniqueDays ?? "—"} · feedbackBias:{" "}
                {debug.feedbackBiasApplied ? "yes" : "no"}
              </p>
              <p>
                RAG: {debug.isolation?.ragRole ?? "—"} · Ridge:{" "}
                {debug.isolation?.ridgeRole ?? "—"} · noTodayLeak:{" "}
                {debug.leakageGuard?.excludedToday ? "yes" : "no"}
              </p>
              {debug.keywords?.slice(0, 3).map((k) => (
                <p key={k.code ?? k.plainLabel}>
                  · {k.plainLabel} ({k.score?.toFixed?.(2) ?? k.score})
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
