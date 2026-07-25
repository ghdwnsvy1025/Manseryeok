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
    <div className="flex flex-wrap gap-1.5 pt-1">
      {CONTENT_FEEDBACK_RATINGS.map((rating) => (
        <button
          key={rating}
          type="button"
          className="text-[10px] px-2 py-1 border font-bold"
          style={{
            borderColor: "var(--px-border)",
            background:
              picked === rating ? "var(--px-accent)" : "var(--px-bg2)",
            color:
              picked === rating ? "var(--px-bg)" : "var(--px-text2)",
          }}
          disabled={picked != null}
          onClick={() => {
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
  );
}
