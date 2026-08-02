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
 * 상단 질문(+굿/배드)은 참고용(선택) · 넓은 일기 칸도 선택 · 완료는 「오늘 남길 글」 줄
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
    }, 120);

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
        paddingTop: "max(0.35rem, env(safe-area-inset-top))",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diary-write-sheet-title"
    >
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
            오늘 남길 글 (선택)
          </label>
          <button
            type="button"
            onClick={onClose}
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
          placeholder="질문에 꼭 대답하지 않아도 돼요. 오늘 생각이 나면 자유롭게 적어도 됩니다."
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
              ? "안 적어도 저장할 수 있어요. 적으면 운세·문장이 더 잘 맞아요."
              : "고마워요. 이 글이 오늘을 더 잘 맞춥니다."}
          </p>
          {previewLen > 0 && (
            <p className="ui-hint tabular-nums shrink-0">{previewLen}자</p>
          )}
        </div>
      </div>
    </div>
  );
}
