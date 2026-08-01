"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  copyAppUrl,
  dismissInstallNudge,
  consumeHomeInstallSheetRequest,
  isIosDevice,
  isKakaoTalkInApp,
  isPwaInstallKnown,
  isStandaloneDisplay,
  markPwaInstalled,
} from "@/lib/pwa/installState";
import {
  ensureInstallPromptCapture,
  getDeferredInstallPrompt,
  promptNativeInstall,
  subscribeInstallPrompt,
} from "@/lib/pwa/installPromptStore";

/**
 * 일기 저장 후 「홈으로」→ 홈 하단 설치 시트.
 * Android Chrome: 원탭 설치 / iOS·카톡: 안내.
 */
export default function HomeInstallSheet() {
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [kakao, setKakao] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensureInstallPromptCapture();
    if (isStandaloneDisplay()) markPwaInstalled();
    if (isPwaInstallKnown()) return;

    setIos(isIosDevice());
    setKakao(isKakaoTalkInApp());
    setCanPrompt(Boolean(getDeferredInstallPrompt()) && !isKakaoTalkInApp());

    if (consumeHomeInstallSheetRequest()) {
      setOpen(true);
      captureEvent(ANALYTICS_EVENTS.installPromptShown, {
        surface: "home_post_save_sheet",
        kakao: isKakaoTalkInApp(),
        can_prompt: Boolean(getDeferredInstallPrompt()),
      });
    }

    return subscribeInstallPrompt(() => {
      setCanPrompt(
        Boolean(getDeferredInstallPrompt()) && !isKakaoTalkInApp()
      );
      if (isPwaInstallKnown()) setOpen(false);
    });
  }, []);

  if (!open) return null;

  const close = (dismissCooldown: boolean) => {
    setOpen(false);
    if (dismissCooldown) {
      dismissInstallNudge();
      captureEvent(ANALYTICS_EVENTS.installDismissed, {
        surface: "home_post_save_sheet",
      });
    }
  };

  const onInstall = async () => {
    captureEvent(ANALYTICS_EVENTS.installClicked, {
      surface: "home_post_save_sheet",
      can_prompt: canPrompt,
      ios,
      kakao,
    });

    if (canPrompt) {
      setBusy(true);
      try {
        const outcome = await promptNativeInstall();
        if (outcome === "accepted") {
          markPwaInstalled();
          setOpen(false);
          captureEvent(ANALYTICS_EVENTS.installAccepted, {
            surface: "home_post_save_sheet",
          });
          return;
        }
        if (outcome === "dismissed") {
          captureEvent(ANALYTICS_EVENTS.installDismissed, {
            surface: "home_post_save_sheet",
            stage: "native_prompt",
          });
        }
        // unavailable → 안내로 폴백
        setShowGuide(true);
      } finally {
        setBusy(false);
      }
      return;
    }

    setShowGuide(true);
  };

  const onCopy = async () => {
    const ok = await copyAppUrl();
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const primaryLabel = kakao
    ? "설치 방법 보기"
    : canPrompt
      ? busy
        ? "설치 창 여는 중…"
        : "앱으로 설치하기"
      : ios
        ? "홈 화면에 추가하는 법"
        : "앱으로 설치하기";

  return (
    <div
      className="fixed inset-x-0 z-[90] px-3 pointer-events-none"
      style={{
        bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="홈 화면 앱 설치"
    >
      <div
        className="pointer-events-auto mx-auto w-full max-w-md border-2 p-4 space-y-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]"
        style={{
          borderColor: "var(--px-accent)",
          background: "var(--px-bg2)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p
              className="text-[15px] font-black leading-snug"
              style={{ color: "var(--px-text-on-panel)" }}
            >
              홈 화면에 앱으로 두기
            </p>
            <p
              className="text-[12px] leading-snug"
              style={{ color: "var(--px-text2)" }}
            >
              {kakao
                ? "카톡 안에서는 설치가 안 돼요. Safari·Chrome으로 연 뒤 추가해 주세요."
                : canPrompt
                  ? "버튼을 누르면 바로 설치 창이 열려요."
                  : ios
                    ? "Safari 공유 → 「홈 화면에 추가」로 앱처럼 쓸 수 있어요."
                    : "브라우저 메뉴에서 「앱 설치」또는 「홈 화면에 추가」를 눌러 주세요."}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-[12px] font-bold px-2 py-1"
            style={{ color: "var(--px-text2)", background: "transparent" }}
            onClick={() => close(true)}
          >
            닫기
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          className="ui-primary-btn w-full py-3.5 text-sm font-black disabled:opacity-60"
          onClick={() => void onInstall()}
        >
          {primaryLabel}
        </button>

        {kakao && (
          <button
            type="button"
            className="w-full py-2.5 text-xs font-black border-2"
            style={{
              borderColor: "var(--px-border)",
              color: "var(--px-text-on-panel)",
              background: "var(--px-bg3)",
            }}
            onClick={() => void onCopy()}
          >
            {copied ? "링크 복사됨" : "앱 링크 복사하기"}
          </button>
        )}

        {showGuide && (
          <ol
            className="text-[12px] font-bold list-decimal pl-4 space-y-1"
            style={{ color: "var(--px-text2)" }}
          >
            {kakao ? (
              <>
                <li>카톡 오른쪽 위 ··· (또는 공유)을 눌러요</li>
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
              </>
            ) : ios ? (
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
      </div>
    </div>
  );
}
