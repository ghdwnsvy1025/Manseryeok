"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  hasLocalFitFeedback,
  QUESTION_FIT_LEVELS,
  type FitLevel,
} from "@/lib/journal/questionFeedback";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";
import { loadLocalKeywordBiases } from "@/lib/journal/keywords/learning";
import { trackContentExposure } from "@/lib/journal/exposure";
import { sajuProfileFortuneFingerprint } from "@/lib/journal/fortune/profileFingerprint";
import type { SajuProfile } from "@/lib/diary/types";
import type { FortuneQuestionContext } from "@/lib/journal/weekThemeSummary";
import OpenAiOriginHint from "@/components/journal/OpenAiOriginHint";

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
    weekTheme?: {
      plainLine?: string;
      keyPoints?: string[];
    };
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
  /** sheet: 전체화면 작성 팝업용 — 티즈 없이 바로 질문 로드·표시 */
  variant?: "default" | "sheet";
};

type Phase = "idle" | "loading" | "ready";

type CachedQuestion = {
  question: string;
  keywords: string[];
  keywordCodes: string[];
  openAi?: OpenAiCallStatus | null;
  debug?: DebugInfo | null;
};

const QUESTION_TEASE_LINES = [
  {
    title: "잠들기 전, 오늘을 한 번만",
    sub: "일기에 담기 전에 마음에 건넬 질문이에요",
  },
  {
    title: "오늘 하루, 뭐가 남았을까?",
    sub: "운세와 한 주의 결을 모아 조용히 물어볼게요",
  },
  {
    title: "일기 쓰기 전, 짧은 숨",
    sub: "스스로를 다독이는 한 문장이 기다려요",
  },
  {
    title: "밤에 꺼내 보는 질문",
    sub: "판단 없이, 오늘을 가만히 들여다볼 때",
  },
] as const;

const QUESTION_LOADING_PHRASES = [
  {
    kind: "healing",
    line: "서두를 필요 없어요. 하루를 천천히 모아보는 중이에요.",
  },
  {
    kind: "philosophy",
    line: "질문은 답을 재촉하지 않아요. 마음을 열어줄 뿐이죠.",
  },
  {
    kind: "quote",
    line: "고요한 밤일수록, 작은 질문이 더 멀리 들려요.",
  },
  {
    kind: "healing",
    line: "완벽히 정리하지 않아도 돼요. 느낌만 건져도 충분해요.",
  },
  {
    kind: "philosophy",
    line: "돌아보는 일은, 지나간 날을 붙잡는 게 아니라 나를 찾는 일이에요.",
  },
] as const;

function questionCacheKey(date: string, sajuProfile: unknown | null) {
  const fp = sajuProfileFortuneFingerprint(
    (sajuProfile as SajuProfile | null) ?? null
  );
  return `manseryeok:today-question-v3:${date}:${fp}`;
}

function readCachedQuestion(
  date: string,
  sajuProfile: unknown | null
): CachedQuestion | null {
  try {
    const raw = window.localStorage.getItem(questionCacheKey(date, sajuProfile));
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedQuestion;
    if (!data?.question || typeof data.question !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

function writeCachedQuestion(
  date: string,
  sajuProfile: unknown | null,
  data: CachedQuestion
) {
  try {
    window.localStorage.setItem(
      questionCacheKey(date, sajuProfile),
      JSON.stringify(data)
    );
  } catch {
    /* ignore quota */
  }
}

function readLocalFortuneSnapshot(
  date: string,
  sajuProfile: unknown | null
): FortuneQuestionContext | null {
  try {
    const fp = sajuProfileFortuneFingerprint(
      (sajuProfile as SajuProfile | null) ?? null
    );
    const raw = window.localStorage.getItem(
      `manseryeok:today-fortune-v2.5:${date}:${fp}`
    );
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      overall?: {
        flow?: string;
        score?: number;
        headline?: string;
        interpretation?: string;
        summary?: string;
        action?: string;
        caution?: string;
      };
      presentation?: { signatureEcho?: string | null };
    };
    const o = data.overall;
    if (!o) return null;
    return {
      flow: o.flow ?? null,
      score: typeof o.score === "number" ? o.score : null,
      headline: o.headline ?? null,
      body: o.interpretation || o.summary || null,
      action: o.action ?? null,
      caution: o.caution ?? null,
      signatureEcho: data.presentation?.signatureEcho ?? null,
    };
  } catch {
    return null;
  }
}

function QuestionTeaseButton({
  onClick,
  ready,
}: {
  onClick: () => void;
  ready?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % QUESTION_TEASE_LINES.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, []);
  const line = QUESTION_TEASE_LINES[idx]!;
  return (
    <button
      type="button"
      onClick={onClick}
      className="fortune-tease w-full py-5 px-3 flex flex-col items-center text-center gap-2"
      aria-label={ready ? "오늘의 질문 펼치기" : "오늘의 질문 받기"}
    >
      <span className="fortune-tease-pulse" aria-hidden />
      <p
        className="text-[11px] font-black tracking-wider relative"
        style={{ color: "var(--px-text2)" }}
      >
        오늘의 질문
      </p>
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
        {ready ? "살짝 펼쳐보기 ↓" : "밤에 건넬 질문 열기 ↓"}
      </span>
    </button>
  );
}

function QuestionLoadingHint() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % QUESTION_LOADING_PHRASES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);
  const phrase = QUESTION_LOADING_PHRASES[idx]!;
  return (
    <div
      className="fortune-loading py-6 px-3 flex flex-col items-center text-center gap-4"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative w-8 h-8" aria-hidden>
        <span
          className="absolute inset-0 rounded-full border-2 animate-spin"
          style={{
            borderColor: "color-mix(in srgb, var(--px-accent) 22%, transparent)",
            borderTopColor: "var(--px-accent)",
          }}
        />
      </div>
      <div className="fortune-loading-stage max-w-[20rem] min-h-[3.5rem] flex items-center justify-center">
        <p
          key={`${idx}-${phrase.line.slice(0, 10)}`}
          className="fortune-loading-phrase text-[13px] font-medium leading-[1.75]"
          data-kind={phrase.kind}
        >
          {phrase.line}
        </p>
      </div>
    </div>
  );
}

export default function TodayQuestionCard({
  todayDate,
  enabledCodes,
  entries,
  sajuProfile,
  variant = "default",
}: Props) {
  const isSheet = variant === "sheet";
  const isAdmin = useIsAdmin();
  const [phase, setPhase] = useState<Phase>("idle");
  const [panelOpen, setPanelOpen] = useState(isSheet);
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
  const autoLoadStartedRef = useRef(false);

  // 날짜가 바뀌면 캐시 복원(당일 유지) 또는 idle — 운세처럼 접힌 채 시작
  useEffect(() => {
    requestIdRef.current += 1;
    setFit(null);
    setSkipped(false);
    setFeedbackMsg("");
    setDebugOpen(false);
    setPanelOpen(isSheet);
    shownSent.current = false;
    answeredRef.current = false;
    dismissSentRef.current = false;
    autoLoadStartedRef.current = false;

    const cached = readCachedQuestion(todayDate, sajuProfile);
    if (cached) {
      setQuestion(cached.question);
      setKeywords(cached.keywords ?? []);
      setKeywordCodes(cached.keywordCodes ?? []);
      setOpenAi(cached.openAi ?? null);
      setDebug(cached.debug ?? null);
      contextRef.current = {
        questionText: cached.question,
        keywords:
          (cached.keywordCodes?.length ?? 0) > 0
            ? cached.keywordCodes
            : cached.keywords ?? [],
      };
      shownSent.current = true;
      if (hasLocalFitFeedback(todayDate)) {
        setFit("good");
        answeredRef.current = true;
        setFeedbackMsg("오늘 피드백을 남겨주셨어요.");
      }
      setPhase("ready");
      return;
    }

    setPhase("idle");
    setQuestion(null);
    setOpenAi(null);
    setKeywords([]);
    setKeywordCodes([]);
    setDebug(null);
    contextRef.current = { questionText: null, keywords: [] };
  }, [todayDate, sajuProfile, isSheet]);

  useEffect(() => {
    return () => {
      if (isSheet) return;
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
  }, [todayDate, isSheet]);

  const loadQuestion = useCallback(async () => {
    if (phase === "loading") return;
    const requestId = ++requestIdRef.current;
    setPhase("loading");
    setPanelOpen(true);
    setFit(null);
    setSkipped(false);
    setFeedbackMsg("");
    setDebug(null);
    shownSent.current = false;
    answeredRef.current = false;
    dismissSentRef.current = false;
    contextRef.current = { questionText: null, keywords: [] };

    try {
      const fortune = readLocalFortuneSnapshot(todayDate, sajuProfile);
      const res = await fetch("/api/journal/today-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todayDate,
          enabledCodes,
          entries,
          sajuProfile,
          keywordBiases: loadLocalKeywordBiases(),
          fortune,
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
        ? "잠들기 전, 오늘 마음에 가장 남는 순간은 무엇이었나요?"
        : data.question ?? null;
      setQuestion(q);
      if (q) {
        try {
          const { ANALYTICS_EVENTS, captureEvent } = await import(
            "@/lib/analytics/posthog"
          );
          captureEvent(ANALYTICS_EVENTS.questionShown, {
            ok: res.ok,
          });
        } catch {
          /* analytics optional */
        }
      }
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

      if (q) {
        writeCachedQuestion(todayDate, sajuProfile, {
          question: q,
          keywords: kwLabels,
          keywordCodes: kwCodes,
          openAi: !res.ok
            ? {
                kind: "failed",
                reason: "request_failed",
                detail: data.error,
              }
            : data.openAi ?? null,
          debug: {
            isolation: data.isolation,
            decision: data.decision,
            sajuWeight: data.sajuWeight,
            priorUniqueDays: data.priorUniqueDays,
            feedbackBiasApplied: data.feedbackBiasApplied,
            leakageGuard: data.leakageGuard,
            keywords: rows,
          },
        });
      }

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
      setPanelOpen(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const fallback = "잠들기 전, 오늘 마음에 가장 남는 순간은 무엇이었나요?";
      setQuestion(fallback);
      setOpenAi({
        kind: "failed",
        reason: "network",
        detail: err instanceof Error ? err.message : String(err),
      });
      writeCachedQuestion(todayDate, sajuProfile, {
        question: fallback,
        keywords: [],
        keywordCodes: [],
        openAi: {
          kind: "failed",
          reason: "network",
          detail: err instanceof Error ? err.message : String(err),
        },
      });
      setPhase("ready");
      setPanelOpen(true);
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

  // 시트 모드: 티즈 없이 자동 로드
  useEffect(() => {
    if (!isSheet) return;
    if (phase !== "idle") return;
    if (autoLoadStartedRef.current) return;
    autoLoadStartedRef.current = true;
    void loadQuestion();
  }, [isSheet, phase, loadQuestion]);

  const showDebug = isAdmin;

  if (phase === "idle" && !isSheet) {
    return <QuestionTeaseButton onClick={() => void loadQuestion()} />;
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <div
        className="border-2"
        style={{
          borderColor: "var(--px-border2)",
          background: "var(--px-bg2)",
          boxShadow: isSheet ? "none" : "2px 2px 0 #000",
        }}
      >
        <QuestionLoadingHint />
      </div>
    );
  }

  if (phase === "ready" && question && !panelOpen && !isSheet) {
    return (
      <QuestionTeaseButton
        ready
        onClick={() => {
          setPanelOpen(true);
          void trackContentExposure({
            eventDate: todayDate,
            contentType: "daily_question",
            contentId: "detail",
            eventType: "question_impression",
            metadata: { surface: "journal_expand" },
          });
        }}
      />
    );
  }

  return (
    <section
      className={`px-3 py-3 border-2 space-y-2 fortune-readable${isSheet ? " !shadow-none" : ""}`}
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: isSheet ? "none" : "2px 2px 0 #000",
      }}
    >
      {!isSheet ? (
        <button
          type="button"
          className="w-full text-left"
          onClick={() => setPanelOpen(false)}
          aria-expanded={panelOpen}
        >
          <p
            className="text-[11px] font-black tracking-wider text-center"
            style={{ color: "var(--px-text2)" }}
          >
            오늘의 질문 · 접기 ↑
          </p>
          <p
            className="mt-1 text-[1.2rem] font-black leading-[1.35] tracking-tight text-center fortune-reveal-title"
            style={{ color: "var(--px-accent)", animationDelay: "60ms" }}
          >
            잠들기 전, 한 번만
          </p>
        </button>
      ) : (
        <p
          className="text-[11px] font-black tracking-wider text-center"
          style={{ color: "var(--px-text2)" }}
        >
          오늘의 질문
        </p>
      )}

      <p
        className={`font-bold leading-relaxed text-center fortune-reveal ${isSheet ? "text-[14px]" : "text-[15px]"}`}
        style={{
          color: "var(--px-text-on-panel)",
          lineHeight: 1.55,
          animationDelay: "180ms",
        }}
      >
        {question}
      </p>

      {phase === "ready" && question && (
        <div
          className="flex flex-wrap items-center justify-center gap-1 pt-0.5 fortune-reveal opacity-80"
          style={{ animationDelay: "320ms" }}
        >
          <span
            className="text-[10px] font-medium w-full text-center leading-snug"
            style={{ color: "var(--px-text2)" }}
          >
            이 질문이 도움이 되었나요?
          </span>
          {QUESTION_FIT_LEVELS.map((option) => (
            <button
              key={option.level}
              type="button"
              disabled={answered}
              aria-pressed={fit === option.level}
              onClick={() => void sendFit(option.level)}
              className="px-2 py-1 text-[10px] font-bold border disabled:opacity-50"
              style={{
                borderColor:
                  fit === option.level ? "var(--px-accent)" : "var(--px-border)",
                color:
                  fit === option.level ? "var(--px-accent)" : "var(--px-text2)",
                background: "transparent",
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            disabled={answered}
            onClick={() => void sendSkip()}
            className="text-[10px] font-medium underline disabled:opacity-50"
            style={{ color: "var(--px-text2)" }}
          >
            건너뛰기
          </button>
          {feedbackMsg && (
            <p className="text-[10px] w-full text-center" style={{ color: "var(--px-text2)" }}>
              {feedbackMsg}
            </p>
          )}
        </div>
      )}

      <OpenAiOriginHint status={openAi} className="text-[10px] text-center leading-relaxed" />

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
                week: {debug.decision?.weekTheme?.plainLine ?? "—"}
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
