"use client";

import { useEffect, useState } from "react";
import BetaFeedbackModal from "@/components/feedback/BetaFeedbackModal";

export const OPEN_BETA_FEEDBACK_EVENT = "manseryeok:open-beta-feedback";

/** 플로팅 버튼 + 모달. 헤더 메뉴는 커스텀 이벤트로 연다. */
export default function BetaFeedbackHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_BETA_FEEDBACK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BETA_FEEDBACK_EVENT, onOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void import("@/lib/analytics/posthog").then(
            ({ ANALYTICS_EVENTS, captureUiClick }) => {
              captureUiClick(ANALYTICS_EVENTS.feedbackOpened, "feedback_open", {
                surface: "floating_button",
              });
            }
          );
        }}
        className="fixed z-[90] right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] px-3 py-2 text-[12px] font-black border-2"
        style={{
          borderColor: "#000",
          background: "var(--px-accent)",
          color: "#111",
          boxShadow: "3px 3px 0 #000",
        }}
        aria-label="의견 보내기"
      >
        의견
      </button>
      <BetaFeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function openBetaFeedback(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_BETA_FEEDBACK_EVENT));
  void import("@/lib/analytics/posthog").then(
    ({ ANALYTICS_EVENTS, captureUiClick }) => {
      captureUiClick(ANALYTICS_EVENTS.feedbackOpened, "feedback_open", {
        surface: "header_menu",
      });
    }
  );
}
