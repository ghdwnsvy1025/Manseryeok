"use client";

import { useEffect, useState } from "react";
import InstallAppButton from "@/components/InstallAppButton";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  dismissInstallNudge,
  isInstallNudgeDismissed,
  isStandaloneDisplay,
} from "@/lib/pwa/installState";

type Props = {
  /** 기록이 1개 이상일 때만 부모가 마운트 */
  hasEntries: boolean;
};

/**
 * 홈 — 미설치 사용자에게 앱 추가를 부드럽게 권유.
 */
export default function InstallAppNudge({ hasEntries }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasEntries) return;
    if (isStandaloneDisplay()) return;
    if (isInstallNudgeDismissed()) return;
    setVisible(true);
    captureEvent(ANALYTICS_EVENTS.installPromptShown, { surface: "home_nudge" });
  }, [hasEntries]);

  if (!visible) return null;

  return (
    <div
      className="p-3 border-2 space-y-2"
      style={{
        borderColor: "var(--px-accent)",
        background:
          "color-mix(in srgb, var(--px-accent) 10%, var(--px-bg2))",
        boxShadow: "2px 2px 0 #000",
      }}
      aria-label="앱 설치 안내"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-black" style={{ color: "var(--px-accent)" }}>
            홈 화면에 두면 더 편해요
          </p>
          <p
            className="text-[11px] font-bold leading-snug"
            style={{ color: "var(--px-text2)" }}
          >
            매일 운세·일기를 앱처럼 바로 열어보세요
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-[11px] font-bold underline px-1 py-0.5"
          style={{ color: "var(--px-text2)", background: "transparent" }}
          onClick={() => {
            dismissInstallNudge();
            captureEvent(ANALYTICS_EVENTS.installDismissed, {
              surface: "home_nudge",
            });
            setVisible(false);
          }}
        >
          나중에
        </button>
      </div>
      <InstallAppButton compact surface="home_nudge" />
    </div>
  );
}
