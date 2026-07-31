"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  isIosDevice,
  isStandaloneDisplay,
} from "@/lib/pwa/installState";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  /** 홈 배너·저장 완료 등 짧은 CTA */
  compact?: boolean;
  /** 노출 위치 (분석) */
  surface?: "settings" | "home_nudge" | "save_complete";
  className?: string;
};

/**
 * PWA 설치 — beforeinstallprompt가 없어도 안내 카드는 항상 표시.
 */
export default function InstallAppButton({
  compact = false,
  surface = "settings",
  className,
}: Props) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIosDevice());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      captureEvent(ANALYTICS_EVENTS.installCompleted, { surface });
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [surface]);

  if (installed) {
    if (compact) return null;
    return (
      <p
        className="text-sm font-bold py-1"
        style={{ color: "var(--px-text2)" }}
        role="status"
      >
        홈 화면 앱 · 설치됨
      </p>
    );
  }

  const canPrompt = Boolean(promptEvent);

  const runInstall = async () => {
    captureEvent(ANALYTICS_EVENTS.installClicked, {
      surface,
      can_prompt: canPrompt,
      ios,
    });
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      captureEvent(
        choice.outcome === "accepted"
          ? ANALYTICS_EVENTS.installAccepted
          : ANALYTICS_EVENTS.installDismissed,
        { surface }
      );
      setPromptEvent(null);
      return;
    }
    setShowGuide((prev) => !prev);
  };

  if (compact) {
    return (
      <div className={className ?? "space-y-1.5"}>
        <button
          type="button"
          className="w-full px-3 py-2.5 text-sm font-black border-2"
          style={{
            borderColor: "var(--px-accent)",
            color: "var(--px-accent)",
            background: "var(--px-bg3)",
            boxShadow: "2px 2px 0 #000",
          }}
          onClick={() => void runInstall()}
        >
          {canPrompt
            ? "홈 화면에 앱 추가"
            : showGuide
              ? "안내 접기"
              : "홈 화면에 앱 추가"}
        </button>
        {showGuide && !canPrompt && (
          <ol
            className="text-xs font-bold list-decimal pl-4 space-y-0.5"
            style={{ color: "var(--px-text2)" }}
          >
            {ios ? (
              <li>Safari 하단 공유 → 「홈 화면에 추가」</li>
            ) : (
              <li>브라우저 메뉴(⋮) → 앱 설치 / 홈 화면에 추가</li>
            )}
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className={className ?? "space-y-2"}>
      <div className="space-y-1">
        <p
          className="text-sm font-black"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          홈 화면에 앱으로 두기
        </p>
        <p
          className="text-[11px] font-bold leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          매일 운세·기록이 한 탭으로 열려요. 알림처럼 바로 찾을 수 있어요.
        </p>
      </div>
      <button
        type="button"
        className="w-full px-3 py-3.5 text-base font-black border-2"
        style={{
          borderColor: "var(--px-accent)",
          color: "var(--px-accent)",
          background: "var(--px-bg2)",
        }}
        onClick={() => void runInstall()}
      >
        {canPrompt
          ? "지금 설치하기"
          : showGuide
            ? "안내 접기"
            : "홈 화면에 앱 추가"}
      </button>
      {showGuide && !canPrompt && (
        <ol
          className="text-sm font-bold list-decimal pl-4 space-y-1"
          style={{ color: "var(--px-text2)" }}
        >
          {ios ? (
            <>
              <li>Safari로 이 페이지를 열어 주세요</li>
              <li>하단 공유 버튼 → 「홈 화면에 추가」</li>
            </>
          ) : (
            <>
              <li>브라우저 메뉴(⋮)를 눌러 주세요</li>
              <li>「앱 설치」또는 「홈 화면에 추가」를 선택</li>
            </>
          )}
        </ol>
      )}
      {ios && !canPrompt && !showGuide && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          iPhone은 버튼을 누르면 설치 방법이 나와요.
        </p>
      )}
    </div>
  );
}
