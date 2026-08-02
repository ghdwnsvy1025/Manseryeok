"use client";

import {
  submitContentFeedback,
  type ContentFeedbackRating,
} from "@/lib/journal/contentFeedback";
import { isContentFeedbackEnabled } from "@/lib/app/featureFlags";
import { useState } from "react";

export type ContentFeedbackMode = "match" | "help" | "thumbs";

type Props = {
  eventDate: string;
  contentType: string;
  contentId?: string | null;
  /** match=텍스트 3단 / help=도움 3단 / thumbs=👍👎 */
  mode?: ContentFeedbackMode;
  /** 프롬프트 직접 지정 (mode보다 우선) */
  prompt?: string;
};

const DEFAULT_PROMPT: Record<ContentFeedbackMode, string> = {
  match: "이 문장이 오늘과 맞았나요?",
  help: "이 문장이 도움이 되었나요?",
  thumbs: "오늘과 맞았나요?",
};

const THUMB_OPTIONS: Array<{
  rating: ContentFeedbackRating;
  glyph: string;
  label: string;
}> = [
  { rating: "loved", glyph: "👍", label: "잘 맞아요" },
  { rating: "not_for_me", glyph: "👎", label: "안 맞아요" },
];

/** 선명하되 보조 UI — 탁한 회색 믹스 최소화, 크기는 작게 */
const RATING_STYLE: Record<
  ContentFeedbackRating,
  { border: string; bg: string; color: string; activeBg: string }
> = {
  loved: {
    border: "#5ad48a",
    bg: "color-mix(in srgb, #5ad48a 12%, var(--px-bg3))",
    color: "#5ad48a",
    activeBg: "color-mix(in srgb, #5ad48a 22%, var(--px-bg3))",
  },
  ok: {
    border: "#f0c14d",
    bg: "color-mix(in srgb, #f0c14d 12%, var(--px-bg3))",
    color: "#f0c14d",
    activeBg: "color-mix(in srgb, #f0c14d 22%, var(--px-bg3))",
  },
  not_for_me: {
    border: "#f07a8a",
    bg: "color-mix(in srgb, #f07a8a 12%, var(--px-bg3))",
    color: "#f07a8a",
    activeBg: "color-mix(in srgb, #f07a8a 22%, var(--px-bg3))",
  },
};

const TEXT_LABELS: Record<
  Exclude<ContentFeedbackMode, "thumbs">,
  Record<ContentFeedbackRating, string>
> = {
  match: {
    loved: "잘 맞아요",
    ok: "보통이에요",
    not_for_me: "안 맞아요",
  },
  help: {
    loved: "도움이 됐어요",
    ok: "그저 그래요",
    not_for_me: "별로예요",
  },
};

const TEXT_RATINGS: ContentFeedbackRating[] = ["loved", "ok", "not_for_me"];

export default function ContentFeedbackButtons({
  eventDate,
  contentType,
  contentId,
  mode = "match",
  prompt,
}: Props) {
  const enabled = isContentFeedbackEnabled();
  const [picked, setPicked] = useState<ContentFeedbackRating | null>(null);
  if (!enabled) return null;

  const promptText = prompt ?? DEFAULT_PROMPT[mode];

  const submit = (rating: ContentFeedbackRating) => {
    if (picked === rating) return;
    setPicked(rating);
    void submitContentFeedback({
      eventDate,
      contentType,
      contentId,
      rating,
    });
    void import("@/lib/analytics/posthog").then(
      ({ ANALYTICS_EVENTS, captureUiClick }) => {
        captureUiClick(
          ANALYTICS_EVENTS.contentFeedbackClicked,
          `content_feedback:${contentType}:${mode}`,
          { surface: contentType, mode, rating }
        );
      }
    );
  };

  if (mode === "thumbs") {
    return (
      <div className="flex items-center justify-center gap-2 pt-1">
        <p
          className="text-[11px] font-semibold leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          {promptText}
        </p>
        <div className="flex items-center gap-1.5" role="group" aria-label={promptText}>
          {THUMB_OPTIONS.map((opt) => {
            const active = picked === opt.rating;
            const s = RATING_STYLE[opt.rating];
            return (
              <button
                key={opt.rating}
                type="button"
                aria-label={opt.label}
                aria-pressed={active}
                className="min-w-[2.5rem] min-h-9 px-2 text-[1.15rem] border-2 leading-none"
                style={{
                  borderColor: active ? s.border : "var(--px-border2)",
                  background: active ? s.activeBg : "var(--px-bg3)",
                  opacity: picked && !active ? 0.4 : 1,
                }}
                onClick={() => submit(opt.rating)}
              >
                {opt.glyph}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const labels = TEXT_LABELS[mode];

  return (
    <div className="space-y-1 pt-1">
      <p
        className="text-[10px] font-semibold leading-snug"
        style={{ color: "var(--px-text2)" }}
      >
        {promptText}
      </p>
      <div className="flex flex-wrap gap-1">
        {TEXT_RATINGS.map((rating) => {
          const active = picked === rating;
          const s = RATING_STYLE[rating];
          return (
            <button
              key={rating}
              type="button"
              className="min-h-7 px-2 text-[10px] font-semibold border"
              style={{
                borderColor: s.border,
                background: active ? s.activeBg : s.bg,
                color: s.color,
                opacity: picked && !active ? 0.4 : 0.92,
              }}
              aria-pressed={active}
              onClick={() => submit(rating)}
            >
              {labels[rating]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
