"use client";

import { useEffect, useRef } from "react";
import TodayQuestionCard from "@/components/journal/TodayQuestionCard";
import type { SajuProfile } from "@/lib/diary/types";
import type { JournalEntry } from "@/lib/journal/types";

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

/**
 * 모바일 키보드에 가리지 않도록 visualViewport에 맞춘 전체화면 작성 시트.
 * 오늘의 질문 + 정리글 textarea를 한곳에서 작성한다.
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

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
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
      textareaRef.current?.focus({ preventScroll: true });
    }, 80);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

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
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diary-write-sheet-title"
    >
      <header
        className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b-2"
        style={{
          borderColor: "var(--px-border2)",
          background: "var(--px-bg2)",
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
        }}
      >
        <div className="min-w-0 flex-1">
          <p
            id="diary-write-sheet-title"
            className="text-sm font-black truncate"
            style={{ color: "var(--px-accent)" }}
          >
            하루 정리글
          </p>
          <p className="text-[10px] font-bold" style={{ color: "var(--px-text2)" }}>
            질문 보고 짧게 적어도 돼요
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 px-3 py-2 text-xs font-black border-2"
          style={{
            borderColor: "#000",
            background: "var(--px-accent)",
            color: "#111",
            boxShadow: "2px 2px 0 #000",
          }}
        >
          완료
        </button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div
          className="shrink-0 max-h-[38%] overflow-y-auto overscroll-contain px-2 pt-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <TodayQuestionCard
            todayDate={date}
            enabledCodes={enabledCodes}
            entries={entries}
            sajuProfile={sajuProfile}
            variant="sheet"
          />
        </div>

        <div className="flex-1 min-h-0 flex flex-col px-2 pb-2 pt-2 gap-1.5">
          <label
            className="text-[11px] font-black shrink-0"
            style={{ color: "var(--px-text2)" }}
            htmlFor="diary-write-sheet-textarea"
          >
            오늘 남길 글
          </label>
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
            className="flex-1 min-h-0 w-full px-3 py-3 border-2 text-base resize-none leading-relaxed"
            style={{
              background: "var(--px-bg3)",
              borderColor: previewLen > 0 ? "var(--px-accent)" : "var(--px-border)",
              color: "var(--px-text-on-panel)",
            }}
            enterKeyHint="done"
          />
          <div className="shrink-0 flex items-center justify-between px-0.5">
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
      </div>
    </div>
  );
}
