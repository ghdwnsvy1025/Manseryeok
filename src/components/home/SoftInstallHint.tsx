"use client";

import { useEffect, useState } from "react";
import InstallAppButton from "@/components/InstallAppButton";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  dismissInstallNudge,
  isInstallNudgeDismissed,
  isKakaoTalkInApp,
  isPwaInstallKnown,
  isStandaloneDisplay,
  markPwaInstalled,
} from "@/lib/pwa/installState";

type Surface = "home_nudge" | "save_complete";

type Props = {
  surface: Surface;
  /** 홈: 기록 일수 (2일 이상일 때 표시) */
  uniqueDays?: number;
  /** 저장 완료: 그날 첫 저장일 때만 */
  wasFirstSaveOfDay?: boolean;
};

/**
 * 거부감 적은 설치 유도 — 강요·중앙 모달 없이 한 줄 제안.
 */
export default function SoftInstallHint({
  surface,
  uniqueDays = 0,
  wasFirstSaveOfDay = false,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [kakao, setKakao] = useState(false);

  useEffect(() => {
    // 홈 화면 앱으로 한 번이라도 열리면 플래그 저장 → 이후 브라우저 탭에서도 숨김
    if (isStandaloneDisplay()) markPwaInstalled();
    if (isPwaInstallKnown()) return;
    if (isInstallNudgeDismissed()) return;
    if (surface === "home_nudge" && uniqueDays < 2) return;
    if (surface === "save_complete" && !wasFirstSaveOfDay) return;

    setKakao(isKakaoTalkInApp());
    setVisible(true);
    captureEvent(ANALYTICS_EVENTS.installPromptShown, {
      surface,
      kakao: isKakaoTalkInApp(),
      unique_days: uniqueDays,
    });
  }, [surface, uniqueDays, wasFirstSaveOfDay]);

  if (!visible) return null;

  const title =
    surface === "save_complete"
      ? kakao
        ? "내일도 편하게 보려면 Safari·Chrome에서 홈에 두세요"
        : "내일도 바로 열려면 홈 화면에 두기"
      : kakao
        ? "카톡 밖 브라우저에서 홈에 두면 편해요"
        : "아이콘 한 번으로 운세·일기 열기";

  const body =
    surface === "save_complete"
      ? kakao
        ? "카톡 안에서는 설치가 안 돼요. 원하시면 나중에 해도 괜찮아요."
        : "필수는 아니에요. 원하실 때만 추가해 주세요."
      : kakao
        ? "카톡 안에서는 설치가 안 돼요. Safari·Chrome으로 연 뒤 추가하세요."
        : "자주 오신다면 홈 화면 아이콘이 조금 편할 수 있어요.";

  const isSave = surface === "save_complete";

  return (
    <div
      className={isSave ? "space-y-1.5 pt-1" : "px-3 py-2.5 space-y-1.5 border"}
      style={
        isSave
          ? undefined
          : {
              borderColor: "var(--px-border)",
              background: "var(--px-bg2)",
            }
      }
      aria-label="홈 화면 추가 안내"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p
            className={isSave ? "text-[12px] font-bold leading-snug" : "text-[13px] font-bold leading-snug"}
            style={{ color: "var(--px-text-on-panel)" }}
          >
            {title}
          </p>
          <p
            className="text-[11px] leading-snug"
            style={{ color: "var(--px-text2)" }}
          >
            {body}
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-[11px] font-bold underline px-1 py-0.5"
          style={{ color: "var(--px-text2)", background: "transparent" }}
          onClick={() => {
            dismissInstallNudge();
            captureEvent(ANALYTICS_EVENTS.installDismissed, { surface });
            setVisible(false);
          }}
        >
          나중에
        </button>
      </div>
      <InstallAppButton quiet surface={surface} />
    </div>
  );
}
