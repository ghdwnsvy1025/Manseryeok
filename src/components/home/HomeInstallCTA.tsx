"use client";

import { useEffect, useState } from "react";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";
import {
  copyAppUrl,
  isIosDevice,
  isKakaoTalkInApp,
  isPwaInstallKnown,
  isStandaloneDisplay,
  markPwaInstalled,
  openInExternalBrowser,
} from "@/lib/pwa/installState";
import {
  ensureInstallPromptCapture,
  getDeferredInstallPrompt,
  promptNativeInstall,
  subscribeInstallPrompt,
} from "@/lib/pwa/installPromptStore";

/**
 * 홈 스크롤 맨 아래 — 눈에 띄는 앱 설치 CTA.
 * 이미 설치됐으면 숨김.
 */
export default function HomeInstallCTA() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [kakao, setKakao] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensureInstallPromptCapture();
    if (isStandaloneDisplay()) markPwaInstalled();
    if (isPwaInstallKnown()) {
      setVisible(false);
      return;
    }

    setVisible(true);
    setIos(isIosDevice());
    setKakao(isKakaoTalkInApp());
    setCanPrompt(Boolean(getDeferredInstallPrompt()) && !isKakaoTalkInApp());

    captureEvent(ANALYTICS_EVENTS.installPromptShown, {
      surface: "home_bottom_cta",
      kakao: isKakaoTalkInApp(),
      can_prompt: Boolean(getDeferredInstallPrompt()),
    });

    return subscribeInstallPrompt(() => {
      if (isPwaInstallKnown()) {
        setVisible(false);
        return;
      }
      setCanPrompt(
        Boolean(getDeferredInstallPrompt()) && !isKakaoTalkInApp()
      );
    });
  }, []);

  if (!visible) return null;

  const onInstall = async () => {
    captureEvent(ANALYTICS_EVENTS.installClicked, {
      surface: "home_bottom_cta",
      can_prompt: canPrompt,
      ios,
      kakao,
    });

    if (kakao) {
      openInExternalBrowser();
      setShowGuide(true);
      return;
    }

    if (canPrompt) {
      setBusy(true);
      try {
        const outcome = await promptNativeInstall();
        if (outcome === "accepted") {
          markPwaInstalled();
          setVisible(false);
          captureEvent(ANALYTICS_EVENTS.installAccepted, {
            surface: "home_bottom_cta",
          });
          return;
        }
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
    ? "브라우저에서 앱 설치하기"
    : canPrompt
      ? busy
        ? "설치 창 여는 중…"
        : "앱 설치하기"
      : "앱 설치하기";

  return (
    <section
      className="mt-2 border-2 p-4 space-y-3"
      style={{
        borderColor: "var(--px-accent)",
        background:
          "linear-gradient(165deg, color-mix(in srgb, var(--px-accent) 18%, var(--px-bg2)) 0%, var(--px-bg2) 55%)",
      }}
      aria-label="앱 설치"
    >
      <div className="space-y-1.5">
        <p
          className="text-[11px] font-black tracking-wide uppercase"
          style={{ color: "var(--px-accent)" }}
        >
          한 번만 추가하면
        </p>
        <p
          className="text-[17px] font-black leading-snug"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          홈 화면에 앱으로 설치하기
        </p>
        <p
          className="text-[12px] leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          {kakao
            ? "버튼을 누르면 Chrome·Safari로 열려요. 열린 화면에서 「앱 설치하기」를 다시 눌러 주세요."
            : canPrompt
              ? "아래 버튼을 누르면 바로 설치할 수 있어요. 아이콘 한 번으로 운세·일기가 열려요."
              : ios
                ? "Safari 공유 → 「홈 화면에 추가」로 앱처럼 쓸 수 있어요."
                : "버튼을 누르면 설치 방법이 나와요. 매일 바로 열 수 있어요."}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        className="ui-primary-btn w-full py-4 text-base font-black disabled:opacity-60"
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
          className="text-[12px] font-bold list-decimal pl-4 space-y-1.5 pt-1"
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
              <li>확인을 누르면 홈 화면에 아이콘이 생겨요</li>
            </>
          ) : (
            <>
              <li>브라우저 메뉴(⋮)를 눌러 주세요</li>
              <li>「앱 설치」또는 「홈 화면에 추가」를 선택</li>
              <li>설치하면 홈 화면에서 바로 열려요</li>
            </>
          )}
        </ol>
      )}
    </section>
  );
}
