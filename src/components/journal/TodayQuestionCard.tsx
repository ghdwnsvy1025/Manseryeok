"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type OpenAiCallStatus,
} from "@/lib/journal/openaiStatus";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  peekLocalFitLevel,
  QUESTION_FIT_LEVELS,
  QUESTION_FIT_THUMBS,
  type FitLevel,
} from "@/lib/journal/questionFeedback";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";
import { loadLocalKeywordBiases } from "@/lib/journal/keywords/learning";
import { trackContentExposure } from "@/lib/journal/exposure";
import { sajuProfileFortuneFingerprint } from "@/lib/journal/fortune/profileFingerprint";
import type { SajuProfile } from "@/lib/diary/types";
import type { FortuneQuestionContext } from "@/lib/journal/weekThemeSummary";
import OpenAiOriginHint from "@/components/journal/OpenAiOriginHint";
import EmotionalLoadingHint from "@/components/ui/EmotionalLoadingHint";
import CherryBlossomLayer from "@/components/motion/CherryBlossomLayer";

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
  /** 질문이 준비되면 (시트에서 완료 후 피드백용) */
  onQuestionReady?: (meta: {
    question: string;
    keywords: string[];
    keywordCodes: string[];
  }) => void;
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
    sub: "대답 필수는 아니에요. 일기 쓸 때 참고만 해도 돼요",
  },
  {
    title: "오늘 하루, 뭐가 남았을까?",
    sub: "운세와 한 주의 결을 모은 참고용 한 문장이에요",
  },
  {
    title: "일기 쓰기 전, 짧은 숨",
    sub: "꼭 답하지 않아도 괜찮아요. 떠오르면 적기만 해도 돼요",
  },
  {
    title: "밤에 꺼내 보는 질문",
    sub: "판단 없이 오늘을 들여다볼 때 — 선택은 자유예요",
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
    const profile = (sajuProfile as SajuProfile | null) ?? null;
    const fp = sajuProfileFortuneFingerprint(profile);
    const profileId =
      profile && typeof profile === "object" && profile.id
        ? String(profile.id)
        : "none";
    const workspace =
      typeof window !== "undefined" &&
      window.localStorage.getItem("manseryeok_guest_mode") === "1"
        ? "guest"
        : "account";
    // TodayFortunePanel 과 동일한 우선순위 키
    const keys = [
      `manseryeok:today-fortune-v2.5:${date}:${workspace}:${fp}`,
      `manseryeok:today-fortune-v2.5:${date}:${profileId}:${fp}`,
      `manseryeok:today-fortune-v2.5:${date}:none:${fp}`,
      `manseryeok:today-fortune-v2.5:${date}:${fp}`,
    ];
    let raw: string | null = null;
    for (const key of keys) {
      raw = window.localStorage.getItem(key);
      if (raw) break;
    }
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
      aria-label={ready ? "오늘의 질문 펼치기" : "참고용 오늘의 질문 받기"}
    >
      <span className="fortune-tease-pulse" aria-hidden />
      <p
        className="text-[11px] font-black tracking-wider relative"
        style={{ color: "var(--px-text2)" }}
      >
        오늘의 질문 · 참고용
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
        {ready ? "살짝 펼쳐보기 ↓" : "참고용 질문 열기 ↓"}
      </span>
    </button>
  );
}

const QUESTION_TEASE_ONCE_KEY = "manseryeok:ph_question_tease_once";

/** 세션 내 최초 1회만 발화 — 재오픈(캐시)에서는 다시 세지 않음 */
function captureQuestionTeaseOnce() {
  if (typeof window === "undefined") return;
  try {
    if (window.sessionStorage.getItem(QUESTION_TEASE_ONCE_KEY) === "1") return;
    window.sessionStorage.setItem(QUESTION_TEASE_ONCE_KEY, "1");
  } catch {
    /* fire anyway this session */
  }
  void import("@/lib/analytics/posthog").then(
    ({ ANALYTICS_EVENTS, captureEvent }) => {
      captureEvent(ANALYTICS_EVENTS.questionTeaseClicked);
    }
  );
}

function QuestionLoadingHint({ compact = false }: { compact?: boolean }) {
  return (
    <EmotionalLoadingHint
      compact={compact}
      status="질문을 고르는 중…"
      intervalMs={4200}
    />
  );
}

export default function TodayQuestionCard({
  todayDate,
  enabledCodes,
  entries,
  sajuProfile,
  variant = "default",
  onQuestionReady,
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
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [blossomToken, setBlossomToken] = useState(0);
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
  const onQuestionReadyRef = useRef(onQuestionReady);
  onQuestionReadyRef.current = onQuestionReady;

  // 날짜가 바뀌면 캐시 복원(당일 유지) 또는 idle — 운세처럼 접힌 채 시작
  useEffect(() => {
    requestIdRef.current += 1;
    setFit(null);
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
      const prevFit = peekLocalFitLevel(todayDate);
      if (prevFit) {
        setFit(prevFit);
        answeredRef.current = true;
        setFeedbackMsg("오늘 피드백을 남겨주셨어요. 바꿀 수 있어요.");
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
    if (phase !== "ready" || !question) return;
    onQuestionReadyRef.current?.({
      question,
      keywords,
      keywordCodes,
    });
  }, [phase, question, keywords, keywordCodes]);

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

    // 당일 캐시가 있으면 네트워크·로딩 없이 즉시 펼침
    const cachedHit = readCachedQuestion(todayDate, sajuProfile);
    if (cachedHit || (phase === "ready" && question)) {
      const data = cachedHit;
      if (data) {
        setQuestion(data.question);
        setKeywords(data.keywords ?? []);
        setKeywordCodes(data.keywordCodes ?? []);
        setOpenAi(data.openAi ?? null);
        setDebug(data.debug ?? null);
        contextRef.current = {
          questionText: data.question,
          keywords:
            (data.keywordCodes?.length ?? 0) > 0
              ? data.keywordCodes
              : data.keywords ?? [],
        };
        const prevFit = peekLocalFitLevel(todayDate);
        if (prevFit) {
          setFit(prevFit);
          answeredRef.current = true;
          setFeedbackMsg("오늘 피드백을 남겨주셨어요. 바꿀 수 있어요.");
        }
      }
      setPhase("ready");
      setPanelOpen(true);
      return;
    }

    const requestId = ++requestIdRef.current;
    setPhase("loading");
    setPanelOpen(true);
    setFit(null);
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
      if (!res.ok) {
        void import("@/lib/analytics/posthog").then(({ captureFlowError }) => {
          captureFlowError({
            step: "question_load",
            errorCode: "REQUEST_FAILED",
            recoverable: true,
          });
        });
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
      if (q) {
        try {
          const { ANALYTICS_EVENTS, captureEvent } = await import(
            "@/lib/analytics/posthog"
          );
          const { questionIdForDate } = await import("@/lib/analytics/buckets");
          captureEvent(ANALYTICS_EVENTS.questionShown, {
            question_id: questionIdForDate(todayDate),
            question_category: kwCodes[0] ?? "unknown",
            question_version: "v1",
            surface: isSheet ? "sheet" : "journal_home",
          });
        } catch {
          /* analytics optional */
        }
      }
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

      const prevFit = peekLocalFitLevel(todayDate);
      if (prevFit) {
        setFit(prevFit);
        answeredRef.current = true;
        setFeedbackMsg("오늘 피드백을 남겨주셨어요. 바꿀 수 있어요.");
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
      setBlossomToken((n) => n + 1);
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
      setBlossomToken((n) => n + 1);
    }
  }, [phase, question, todayDate, enabledCodes, entries, sajuProfile]);

  const sendFit = async (level: FitLevel) => {
    const option = QUESTION_FIT_LEVELS.find((l) => l.level === level);
    if (!question || !option) return;
    // 같은 선택 재클릭은 무시, 굿↔배드는 언제든 바꿀 수 있음
    if (fit === level) return;
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
        changed: fit != null,
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
    return (
      <QuestionTeaseButton
        onClick={() => {
          captureQuestionTeaseOnce();
          void loadQuestion();
        }}
      />
    );
  }

  if (phase === "idle" || phase === "loading") {
    return (
      <div
        className={isSheet ? "" : "border-2"}
        style={
          isSheet
            ? undefined
            : {
                borderColor: "var(--px-border2)",
                background: "var(--px-bg2)",
                boxShadow: "2px 2px 0 #000",
              }
        }
      >
        <QuestionLoadingHint compact={isSheet} />
      </div>
    );
  }

  if (phase === "ready" && question && !panelOpen && !isSheet) {
    return (
      <QuestionTeaseButton
        ready
        onClick={() => {
          captureQuestionTeaseOnce();
          void loadQuestion();
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

  // 시트: 질문 + 옆 굿/배드 (별도 피드백 팝업 없음)
  // 로딩 칸과 같은 최소 높이로 점프를 막는다.
  if (isSheet && question) {
    return (
      <>
        <CherryBlossomLayer playToken={blossomToken} />
        <section className="px-3 py-2.5 space-y-1.5 fortune-readable min-h-[4.75rem] flex flex-col justify-center">
          <div className="flex items-center justify-center gap-2">
            <p
              className="text-[11px] font-black tracking-wider"
              style={{ color: "var(--px-accent)" }}
            >
              오늘의 질문 · 참고용
            </p>
            <div className="flex items-center gap-1" role="group" aria-label="질문 피드백">
              {QUESTION_FIT_THUMBS.map((option) => (
                <button
                  key={option.level}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={fit === option.level}
                  onClick={() => void sendFit(option.level)}
                  className="min-w-[2.25rem] px-1.5 py-0.5 text-[10px] font-black border-2"
                  style={{
                    borderColor:
                      fit === option.level
                        ? "var(--px-accent)"
                        : "var(--px-border2)",
                    color:
                      fit === option.level
                        ? "var(--px-accent)"
                        : "var(--px-text2)",
                    background: "var(--px-bg3)",
                  }}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
          <p
            className="text-[14px] font-bold leading-relaxed text-center"
            style={{ color: "var(--px-text-on-panel)", lineHeight: 1.55 }}
          >
            {question}
          </p>
          <p
            className="text-[10px] text-center font-bold leading-snug"
            style={{ color: "var(--px-text2)" }}
          >
            꼭 대답하지 않아도 돼요. 아래 글은 자유롭게 적어도 됩니다.
          </p>
          {feedbackMsg && (
            <p
              className="text-[10px] text-center font-bold"
              style={{ color: "var(--px-text2)" }}
            >
              {feedbackMsg}
            </p>
          )}
        </section>
      </>
    );
  }

  return (
    <>
    <CherryBlossomLayer playToken={blossomToken} />
    <section
      className="px-3 py-3 border-2 space-y-2 fortune-readable"
      style={{
        borderColor: "var(--px-border2)",
        background: "var(--px-bg2)",
        boxShadow: "2px 2px 0 #000",
      }}
    >
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
          오늘의 질문 · 참고용 · 접기 ↑
        </p>
        <p
          className="mt-1 text-[1.2rem] font-black leading-[1.35] tracking-tight text-center fortune-reveal-title"
          style={{ color: "var(--px-accent)", animationDelay: "60ms" }}
        >
          잠들기 전, 떠올려 보기
        </p>
      </button>

      <p
        className="text-[15px] font-bold leading-relaxed text-center fortune-reveal"
        style={{
          color: "var(--px-text-on-panel)",
          lineHeight: 1.55,
          animationDelay: "180ms",
        }}
      >
        {question}
      </p>
      <p
        className="text-[11px] font-bold text-center leading-snug fortune-reveal"
        style={{ color: "var(--px-text2)", animationDelay: "220ms" }}
      >
        꼭 대답하지 않아도 돼요. 일기 쓸 때 참고만 해도 충분해요.
      </p>

      {phase === "ready" && question && (
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 pt-1.5 pb-1 fortune-reveal border-t"
          style={{
            animationDelay: "320ms",
            borderColor: "var(--px-border)",
          }}
        >
          <div className="flex items-center justify-center gap-2 w-full">
            <span
              className="text-[10px] font-bold leading-snug"
              style={{ color: "var(--px-text2)" }}
            >
              이 질문
            </span>
            <div className="flex items-center gap-1" role="group" aria-label="질문 피드백">
              {QUESTION_FIT_THUMBS.map((option) => (
                <button
                  key={option.level}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={fit === option.level}
                  onClick={() => void sendFit(option.level)}
                  className="min-w-[2.5rem] px-2 py-1 text-[10px] font-black border-2"
                  style={{
                    borderColor:
                      fit === option.level
                        ? "var(--px-accent)"
                        : "var(--px-border2)",
                    color:
                      fit === option.level
                        ? "var(--px-accent)"
                        : "var(--px-text2)",
                    background: "var(--px-bg3)",
                  }}
                >
                  {option.shortLabel}
                </button>
              ))}
            </div>
          </div>
          {feedbackMsg && (
            <p className="text-[10px] w-full text-center font-bold" style={{ color: "var(--px-text2)" }}>
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
    </>
  );
}
