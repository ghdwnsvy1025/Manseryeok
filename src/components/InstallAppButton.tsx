"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/**
 * PWA 설치 — beforeinstallprompt가 없어도 안내 카드는 항상 표시.
 */
export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null
  );
  const [showGuide, setShowGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="w-full px-3 py-3.5 text-base font-black border-2"
        style={{
          borderColor: "var(--px-accent)",
          color: "var(--px-accent)",
          background: "var(--px-bg2)",
        }}
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
            return;
          }
          setShowGuide((prev) => !prev);
        }}
      >
        {canPrompt
          ? "홈 화면에 앱 추가"
          : showGuide
            ? "안내 접기"
            : "홈 화면에 앱 추가"}
      </button>
      {(showGuide || (ios && showGuide)) && !canPrompt && (
        <ol
          className="text-sm font-bold list-decimal pl-4 space-y-1"
          style={{ color: "var(--px-text2)" }}
        >
          {ios ? (
            <>
              <li>Safari 공유 → 홈 화면에 추가</li>
            </>
          ) : (
            <>
              <li>메뉴(⋮) → 앱 설치 / 홈 화면에 추가</li>
            </>
          )}
        </ol>
      )}
      {ios && !canPrompt && !showGuide && (
        <p className="text-xs font-bold" style={{ color: "var(--px-text2)" }}>
          iPhone은 버튼을 눌러 설치 방법을 보세요.
        </p>
      )}
    </div>
  );
}
