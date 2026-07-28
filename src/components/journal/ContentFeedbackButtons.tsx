"use client";

import {
  CONTENT_FEEDBACK_LABELS,
  CONTENT_FEEDBACK_RATINGS,
  submitContentFeedback,
  type ContentFeedbackRating,
} from "@/lib/journal/contentFeedback";
import { isContentFeedbackEnabled } from "@/lib/app/featureFlags";
import { useState } from "react";

type Props = {
  eventDate: string;
  contentType: string;
  contentId?: string | null;
};

export default function ContentFeedbackButtons({
  eventDate,
  contentType,
  contentId,
}: Props) {
  const enabled = isContentFeedbackEnabled();
  const [picked, setPicked] = useState<ContentFeedbackRating | null>(null);
  if (!enabled) return null;

  return (
    <div className="space-y-2 pt-2">
      <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
        이 문장이 오늘과 맞나요?
      </p>
      <div className="flex flex-wrap gap-2">
        {CONTENT_FEEDBACK_RATINGS.map((rating) => (
          <button
            key={rating}
            type="button"
            className="min-h-9 px-3 text-xs font-bold border-2"
            style={{
              borderColor:
                picked === rating ? "var(--px-accent)" : "var(--px-border)",
              background:
                picked === rating
                  ? "color-mix(in srgb, var(--px-accent) 18%, var(--px-bg2))"
                  : "var(--px-bg2)",
              color:
                picked === rating
                  ? "var(--px-accent)"
                  : "var(--px-text-on-panel)",
            }}
            aria-pressed={picked === rating}
            onClick={() => {
              if (picked === rating) return;
              setPicked(rating);
              void submitContentFeedback({
                eventDate,
                contentType,
                contentId,
                rating,
              });
            }}
          >
            {CONTENT_FEEDBACK_LABELS[rating]}
          </button>
        ))}
      </div>
    </div>
  );
}
