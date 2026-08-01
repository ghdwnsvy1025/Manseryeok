"use client";

import {
  CONTENT_FEEDBACK_LABELS,
  CONTENT_FEEDBACK_HELP_LABELS,
  CONTENT_FEEDBACK_RATINGS,
  submitContentFeedback,
  type ContentFeedbackRating,
} from "@/lib/journal/contentFeedback";
import { isContentFeedbackEnabled } from "@/lib/app/featureFlags";
import { useState } from "react";

export type ContentFeedbackMode = "match" | "help";

type Props = {
  eventDate: string;
  contentType: string;
  contentId?: string | null;
  /** match=오늘과 맞았나요 / help=도움이 되었나요 */
  mode?: ContentFeedbackMode;
  /** 프롬프트 직접 지정 (mode보다 우선) */
  prompt?: string;
};

const DEFAULT_PROMPT: Record<ContentFeedbackMode, string> = {
  match: "이 문장이 오늘과 맞았나요?",
  help: "이 문장이 도움이 되었나요?",
};

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

  const labels =
    mode === "help" ? CONTENT_FEEDBACK_HELP_LABELS : CONTENT_FEEDBACK_LABELS;
  const promptText = prompt ?? DEFAULT_PROMPT[mode];

  return (
    <div className="space-y-1 pt-1">
      <p
        className="text-[10px] font-semibold leading-snug"
        style={{ color: "var(--px-text2)" }}
      >
        {promptText}
      </p>
      <div className="flex flex-wrap gap-1">
        {CONTENT_FEEDBACK_RATINGS.map((rating) => {
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
              onClick={() => {
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
              }}
            >
              {labels[rating]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
