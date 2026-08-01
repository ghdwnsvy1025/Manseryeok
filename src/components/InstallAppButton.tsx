"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  copyAppUrl,
  isIosDevice,
  isKakaoTalkInApp,
  isStandaloneDisplay,
} from "@/lib/pwa/installState";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Props = {
  /** 홈 배너 등 짧은 CTA */
  compact?: boolean;
  /** 텍스트 링크형 — 저장 완료 등 거부감 적은 유도 */
  quiet?: boolean;
  /** 노출 위치 (분석) */
  surface?: "settings" | "home_nudge" | "save_complete";
  className?: string;
};

function InstallGuide({
  kakao,
  ios,
  compact,
}: {
  kakao: boolean;
  ios: boolean;
  compact?: boolean;
}) {
  const textClass = compact
    ? "text-xs font-bold list-decimal pl-4 space-y-0.5"
    : "text-sm font-bold list-decimal pl-4 space-y-1";

  if (kakao) {
    return (
      <ol className={textClass} style={{ color: "var(--px-text2)" }}>
        <li>카톡 오른쪽 위 ··· (또는 공유) 버튼을 눌러요</li>
        <li>
          {ios
            ? "「Safari로 열기」를 선택해요"
            : "「다른 브라우저로 열기」또는 Chrome으로 열어요"}
        </li>
        <li>
          {ios
            ? "Safari에서 공유 → 「홈 화면에 추가」"
            : "브라우저 메뉴(⋮) → 앱 설치 / 홈 화면에 추가"}
        </li>
      </ol>
    );
  }

  if (ios) {
    return (
      <ol className={textClass} style={{ color: "var(--px-text2)" }}>
        <li>Safari로 이 페이지를 열어 주세요</li>
        <li>하단 공유 버튼 → 「홈 화면에 추가」</li>
      </ol>
    );
  }

  return (
    <ol className={textClass} style={{ color: "var(--px-text2)" }}>
      <li>브라우저 메뉴(⋮)를 눌러 주세요</li>
      <li>「앱 설치」또는 「홈 화면에 추가」를 선택</li>
    </ol>
  );
}

/**
 * PWA 설치 — 카카오톡 인앱이면 외부 브라우저 안내를 우선.
 */
export default function InstallAppButton({
  compact = false,
  quiet = false,
  surface = "settings",
  className,
}: Props) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [kakao, setKakao] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneDisplay());
    setIos(isIosDevice());
    const inKakao = isKakaoTalkInApp();
    setKakao(inKakao);
    // 카톡에서는 바로 설치가 안 되므로 안내를 기본으로 펼침 (quiet 제외)
    if (inKakao && !quiet) setShowGuide(true);

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
  }, [surface, quiet]);

  if (installed) {
    if (compact || quiet) return null;
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

  const canPrompt = Boolean(promptEvent) && !kakao;

  const runInstall = async () => {
    captureEvent(ANALYTICS_EVENTS.installClicked, {
      surface,
      can_prompt: canPrompt,
      ios,
      kakao,
      quiet,
    });
    if (promptEvent && !kakao) {
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

  const onCopyLink = async () => {
    const ok = await copyAppUrl();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      captureEvent(ANALYTICS_EVENTS.installClicked, {
        surface,
        action: "copy_link",
        kakao: true,
      });
    }
  };

  const primaryLabel = kakao
    ? showGuide
      ? "안내 접기"
      : "설치 방법 보기"
    : canPrompt
      ? quiet
        ? "홈 화면에 두기"
        : compact
          ? "홈 화면에 앱 추가"
          : "지금 설치하기"
      : showGuide
        ? "안내 접기"
        : quiet
          ? "추가 방법 보기"
          : "홈 화면에 앱 추가";

  if (quiet) {
    return (
      <div className={className ?? "space-y-1"}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            className="text-[12px] font-bold underline"
            style={{ color: "var(--px-accent)", background: "transparent" }}
            onClick={() => void runInstall()}
          >
            {primaryLabel}
          </button>
          {kakao && (
            <button
              type="button"
              className="text-[12px] font-bold underline"
              style={{ color: "var(--px-text2)", background: "transparent" }}
              onClick={() => void onCopyLink()}
            >
              {copied ? "링크 복사됨" : "링크 복사"}
            </button>
          )}
        </div>
        {showGuide && !canPrompt && (
          <InstallGuide kakao={kakao} ios={ios} compact />
        )}
      </div>
    );
  }

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
          {primaryLabel}
        </button>
        {kakao && (
          <button
            type="button"
            className="w-full px-3 py-2 text-xs font-black border-2"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-text-on-panel)",
              background: "var(--px-bg2)",
            }}
            onClick={() => void onCopyLink()}
          >
            {copied ? "링크 복사됨" : "앱 링크 복사하기"}
          </button>
        )}
        {showGuide && !canPrompt && (
          <InstallGuide kakao={kakao} ios={ios} compact />
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
          {kakao
            ? "카카오톡 안에서는 설치가 안 돼요. Safari·Chrome으로 연 뒤 홈 화면에 추가하세요."
            : "매일 운세·기록이 한 탭으로 열려요. 알림처럼 바로 찾을 수 있어요."}
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
        {primaryLabel}
      </button>
      {kakao && (
        <button
          type="button"
          className="w-full px-3 py-3 text-sm font-black border-2"
          style={{
            borderColor: "var(--px-border)",
            color: "var(--px-text-on-panel)",
            background: "var(--px-bg3)",
          }}
          onClick={() => void onCopyLink()}
        >
          {copied ? "링크가 복사됐어요" : "앱 링크 복사하기"}
        </button>
      )}
      {showGuide && !canPrompt && (
        <InstallGuide kakao={kakao} ios={ios} />
      )}
      {!kakao && ios && !canPrompt && !showGuide && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          iPhone은 버튼을 누르면 설치 방법이 나와요.
        </p>
      )}
    </div>
  );
}
