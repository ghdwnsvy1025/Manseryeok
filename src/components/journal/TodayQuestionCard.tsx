"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatOpenAiStatus,
  shouldShowOpenAiStatus,
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import {
  hasLocalFitFeedback,
  QUESTION_FIT_LEVELS,
  type FitLevel,
} from "@/lib/journal/questionFeedback";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";
import { loadLocalKeywordBiases } from "@/lib/journal/keywords/learning";
import { trackContentExposure } from "@/lib/journal/exposure";

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

type Phase = "idle" | "loading" | "ready";

export default function TodayQuestionCard({
  todayDate,
  enabledCodes,
  entries,
  sajuProfile,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<string | null>(null);
  const [openAi, setOpenAi] = useState<OpenAiCallStatus | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordCodes, setKeywordCodes] = useState<string[]>([]);
  const [fit, setFit] = useState<FitLevel | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const shownSent = useRef(false);
  /**
   * 언마운트 시 "응답 없이 떠남"(dismissed)을 실제로 발화하기 위한 최신 상태 스냅샷.
   * cleanup 클로저는 옛 state를 보므로 ref로 들고 있어야 한다.
   */
  const answeredRef = useRef(false);
  const dismissSentRef = useRef(false);
  const contextRef = useRef<{
    questionText: string | null;
    keywords: string[];
  }>({ questionText: null, keywords: [] });
  const requestIdRef = useRef(0);

  // 날짜가 바뀌면 다시 눌러서 받게 한다 — 자동 재호출로 OpenAI를 쓰지 않는다.
  useEffect(() => {
    requestIdRef.current += 1;
    setPhase("idle");
    setQuestion(null);
    setOpenAi(null);
    setKeywords([]);
    setKeywordCodes([]);
    setFit(null);
    setSkipped(false);
    setFeedbackMsg("");
    setDebug(null);
    setDebugOpen(false);
    shownSent.current = false;
    answeredRef.current = false;
    dismissSentRef.current = false;
    contextRef.current = { questionText: null, keywords: [] };
  }, [todayDate]);

  useEffect(() => {
    return () => {
      if (
        shownSent.current &&
        !answeredRef.current &&
        !dismissSentRef.current &&
        contextRef.current.questionText
      ) {
        dismissSentRef.current = true;
        void reportQuestionFeedback({
          questionDate: todayDate,
          eventType: "dismissed",
          questionText: contextRef.current.questionText,
          payload: { keywords: contextRef.current.keywords },
        });
      }
    };
  }, [todayDate]);

  const loadQuestion = useCallback(async () => {
    if (phase === "loading") return;
    const requestId = ++requestIdRef.current;
    setPhase("loading");
    setFit(null);
    setSkipped(false);
    setFeedbackMsg("");
    setDebug(null);
    shownSent.current = false;
    answeredRef.current = false;
    dismissSentRef.current = false;
    contextRef.current = { questionText: null, keywords: [] };

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
      if (requestId !== requestIdRef.current) return;

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

      contextRef.current = {
        questionText: q,
        keywords: kwCodes.length > 0 ? kwCodes : kwLabels,
      };

      if (hasLocalFitFeedback(todayDate)) {
        setFit("good");
        answeredRef.current = true;
        setFeedbackMsg("오늘 피드백을 남겨주셨어요.");
      }

      if (q && !shownSent.current) {
        shownSent.current = true;
        const kws = kwCodes.length > 0 ? kwCodes : kwLabels;
        void reportQuestionFeedback({
          questionDate: todayDate,
          eventType: "shown",
          questionText: q,
          payload: { keywords: kws },
        });
        void trackContentExposure({
          eventDate: todayDate,
          contentType: "daily_question",
          eventType: "question_impression",
          metadata: { keywords: kws, surface: "journal_home" },
        });
      }
      setPhase("ready");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setQuestion("오늘 하루, 마음에 가장 남는 순간은 무엇이었나요?");
      setOpenAi({
        kind: "failed",
        reason: "network",
        detail: err instanceof Error ? err.message : String(err),
      });
      setPhase("ready");
    }
  }, [phase, todayDate, enabledCodes, entries, sajuProfile]);

  const answered = fit != null || skipped;

  const sendFit = async (level: FitLevel) => {
    const option = QUESTION_FIT_LEVELS.find((l) => l.level === level);
    if (!question || answered || !option) return;
    setFit(level);
    answeredRef.current = true;
    setFeedbackMsg(option.ack);
    await reportQuestionFeedback({
      questionDate: todayDate,
      eventType: option.eventType,
      questionText: question,
      rating: option.rating,
      payload: {
        keywords: keywordCodes.length > 0 ? keywordCodes : keywords,
      },
    });
  };

  const sendSkip = async () => {
    if (!question || answered) return;
    setSkipped(true);
    answeredRef.current = true;
    setFeedbackMsg("건너뛰었어요 — 다음엔 다른 질문을 드릴게요.");
    await reportQuestionFeedback({
      questionDate: todayDate,
      eventType: "skipped",
      questionText: question,
      payload: {
        keywords: keywordCodes.length > 0 ? keywordCodes : keywords,
      },
    });
  };

  const showDebug = shouldShowOpenAiStatus();

  if (phase === "idle") {
    return (
      <button
        type="button"
        onClick={() => void loadQuestion()}
        className="w-full text-left p-3 border-2 space-y-1"
        style={{
          borderColor: "var(--px-border2)",
          background: "var(--px-bg2)",
          boxShadow: "2px 2px 0 #000",
          color: "var(--px-text-on-panel)",
        }}
      >
        <p
          className="text-[10px] font-black tracking-wider"
          style={{ color: "var(--px-text2)" }}
        >
          오늘의 질문
        </p>
        <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
          눌러서 오늘의 질문 받기
        </p>
      </button>
    );
  }

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
      {phase === "loading" ? (
        <p className="ui-hint">질문을 준비하는 중…</p>
      ) : (
        <p
          className="text-sm font-bold leading-relaxed"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {question}
        </p>
      )}

      {phase === "ready" && question && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className="text-[10px] font-bold"
            style={{ color: "var(--px-text2)" }}
          >
            이 질문이 오늘과 맞나요?
          </span>
          {QUESTION_FIT_LEVELS.map((option) => (
            <button
              key={option.level}
              type="button"
              disabled={answered}
              aria-pressed={fit === option.level}
              onClick={() => void sendFit(option.level)}
              className="px-2.5 py-1 text-[11px] font-black border-2 disabled:opacity-50"
              style={{
                borderColor:
                  fit === option.level ? "var(--px-accent)" : "var(--px-border)",
                color:
                  fit === option.level ? "var(--px-accent)" : "var(--px-text)",
                background: "var(--px-bg3)",
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            disabled={answered}
            onClick={() => void sendSkip()}
            className="text-[10px] font-bold underline disabled:opacity-50"
            style={{ color: "var(--px-text2)" }}
          >
            건너뛰기
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
