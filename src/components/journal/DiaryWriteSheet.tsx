"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TodayQuestionCard from "@/components/journal/TodayQuestionCard";
import type { SajuProfile } from "@/lib/diary/types";
import type { JournalEntry } from "@/lib/journal/types";
import {
  hasLocalFitFeedback,
  QUESTION_FIT_LEVELS,
  type FitLevel,
} from "@/lib/journal/questionFeedback";
import { reportQuestionFeedback } from "@/lib/journal/reportQuestionFeedback";

type QuestionMeta = {
  question: string;
  keywords: string[];
  keywordCodes: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  date: string;
  content: string;
  onContentChange: (next: string) => void;
  enabledCodes: string[];
  entries: JournalEntry[];
  sajuProfile: SajuProfile | null;
  /** 첫 글자 입력 시 1회 (노출 이벤트는 부모가 담당) */
  onDiaryStarted?: () => void;
};

type SheetStep = "write" | "feedback";

/**
 * 모바일 키보드에 가리지 않도록 visualViewport에 맞춘 전체화면 작성 시트.
 * 상단 질문(문장만) · 넓은 일기 칸 · 완료는 「오늘 남길 글」 줄 · 피드백은 완료 직후
 */
export default function DiaryWriteSheet({
  open,
  onClose,
  date,
  content,
  onContentChange,
  enabledCodes,
  entries,
  sajuProfile,
  onDiaryStarted,
}: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startedRef = useRef(false);
  const [step, setStep] = useState<SheetStep>("write");
  const [questionMeta, setQuestionMeta] = useState<QuestionMeta | null>(null);
  const [fitBusy, setFitBusy] = useState(false);

  const handleQuestionReady = useCallback((meta: QuestionMeta) => {
    setQuestionMeta(meta);
  }, []);

  const finishClose = useCallback(() => {
    setStep("write");
    setFitBusy(false);
    onClose();
  }, [onClose]);

  const requestDone = useCallback(() => {
    if (hasLocalFitFeedback(date) || !questionMeta?.question) {
      finishClose();
      return;
    }
    setStep("feedback");
  }, [date, questionMeta, finishClose]);

  const sendFit = (level: FitLevel) => {
    if (!questionMeta?.question || fitBusy) return;
    const option = QUESTION_FIT_LEVELS.find((l) => l.level === level);
    if (!option) return;
    setFitBusy(true);
    const meta = questionMeta;
    finishClose();
    void reportQuestionFeedback({
      questionDate: date,
      eventType: option.eventType,
      questionText: meta.question,
      rating: option.rating,
      payload: {
        keywords:
          meta.keywordCodes.length > 0 ? meta.keywordCodes : meta.keywords,
      },
    });
  };

  const skipFit = () => {
    if (!questionMeta?.question || fitBusy) return;
    setFitBusy(true);
    const meta = questionMeta;
    finishClose();
    void reportQuestionFeedback({
      questionDate: date,
      eventType: "skipped",
      questionText: meta.question,
      payload: {
        keywords:
          meta.keywordCodes.length > 0 ? meta.keywordCodes : meta.keywords,
      },
    });
  };

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setStep("write");
      setFitBusy(false);
      setQuestionMeta(null);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const sheet = sheetRef.current;
    const vv = window.visualViewport;

    const syncViewport = () => {
      if (!sheet) return;
      if (vv) {
        sheet.style.height = `${vv.height}px`;
        sheet.style.top = `${vv.offsetTop}px`;
      } else {
        sheet.style.height = "100dvh";
        sheet.style.top = "0px";
      }
    };

    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);

    const focusTimer = window.setTimeout(() => {
      if (step === "write") {
        textareaRef.current?.focus({ preventScroll: true });
      }
    }, 120);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === "feedback") finishClose();
        else requestDone();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, step, finishClose, requestDone]);

  if (!open) return null;

  const previewLen = content.trim().length;

  return (
    <div
      ref={sheetRef}
      className="fixed left-0 right-0 z-[200] flex flex-col"
      style={{
        top: 0,
        height: "100dvh",
        background: "var(--px-bg)",
        paddingTop: "max(0.35rem, env(safe-area-inset-top))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diary-write-sheet-title"
    >
      {step === "write" ? (
        <>
          <div id="diary-write-sheet-title" className="shrink-0 px-2 pb-2">
            <div
              className="border-2"
              style={{
                borderColor: "var(--px-accent)",
                background: "var(--px-bg2)",
                boxShadow: "3px 3px 0 #000",
              }}
            >
              <TodayQuestionCard
                todayDate={date}
                enabledCodes={enabledCodes}
                entries={entries}
                sajuProfile={sajuProfile}
                variant="sheet"
                onQuestionReady={handleQuestionReady}
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col px-2 pb-2 gap-1">
            <div className="shrink-0 flex items-center justify-between gap-2 px-0.5">
              <label
                className="text-[11px] font-black"
                style={{ color: "var(--px-text2)" }}
                htmlFor="diary-write-sheet-textarea"
              >
                오늘 남길 글
              </label>
              <button
                type="button"
                onClick={requestDone}
                className="shrink-0 px-3 py-1.5 text-xs font-black border-2"
                style={{
                  borderColor: "#000",
                  background: "var(--px-accent)",
                  color: "#111",
                  boxShadow: "2px 2px 0 #000",
                }}
              >
                완료
              </button>
            </div>
            <textarea
              id="diary-write-sheet-textarea"
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                const next = e.target.value;
                if (next.trim().length > 0 && !startedRef.current) {
                  startedRef.current = true;
                  onDiaryStarted?.();
                }
                onContentChange(next);
              }}
              placeholder="예) 오늘은 회의가 길었지만, 끝나고 산책하니 좀 풀렸다."
              className="flex-1 min-h-[12rem] w-full px-3 py-3 border-2 text-base resize-none leading-relaxed"
              style={{
                background: "var(--px-bg3)",
                borderColor:
                  previewLen > 0 ? "var(--px-accent)" : "var(--px-border2)",
                color: "var(--px-text-on-panel)",
                boxShadow: "2px 2px 0 #000",
              }}
              enterKeyHint="done"
            />
            <div className="shrink-0 flex items-center justify-between px-0.5 pb-[env(safe-area-inset-bottom,0px)]">
              <p className="ui-hint">
                {previewLen === 0
                  ? "한 줄만 적어도 운세·문장에 반영돼요."
                  : "고마워요. 이 글이 오늘을 더 잘 맞춥니다."}
              </p>
              {previewLen > 0 && (
                <p className="ui-hint tabular-nums shrink-0">{previewLen}자</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 gap-4">
          <div
            className="w-full max-w-sm border-2 p-4 space-y-3"
            style={{
              borderColor: "var(--px-accent)",
              background: "var(--px-bg2)",
              boxShadow: "4px 4px 0 #000",
            }}
          >
            <p
              className="text-sm font-black text-center"
              style={{ color: "var(--px-accent)" }}
            >
              이 질문이 도움이 되었나요?
            </p>
            {questionMeta?.question && (
              <p
                className="text-[13px] font-bold leading-relaxed text-center"
                style={{ color: "var(--px-text-on-panel)" }}
              >
                {questionMeta.question}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {QUESTION_FIT_LEVELS.map((option) => (
                <button
                  key={option.level}
                  type="button"
                  disabled={fitBusy}
                  onClick={() => sendFit(option.level)}
                  className="px-2.5 py-2 text-[11px] font-black border-2 disabled:opacity-50"
                  style={{
                    borderColor: "var(--px-border2)",
                    color: "var(--px-text-on-panel)",
                    background: "var(--px-bg3)",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={fitBusy}
              onClick={skipFit}
              className="block w-full text-center text-[11px] font-bold underline disabled:opacity-50"
              style={{ color: "var(--px-text2)" }}
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
