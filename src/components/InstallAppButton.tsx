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

export default function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  /** SSR/첫 페인트는 false — isIos()를 렌더에서 호출하면 hydration 깨짐 */
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
      <p className="ui-hint" role="status">
        이 기기에 앱으로 설치되어 있어요.
      </p>
    );
  }

  const canPrompt = Boolean(promptEvent);
  if (!canPrompt && !ios) return null;

  return (
    <div
      className="p-3 border space-y-2"
      style={{ borderColor: "var(--px-border)", background: "var(--px-bg2)" }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--px-accent)" }}>
        홈 화면에서 앱처럼 사용하기
      </p>
      <button
        type="button"
        className="w-full px-3 py-2 text-xs font-bold border-2"
        style={{
          borderColor: "var(--px-accent)",
          color: "var(--px-accent)",
          background: "var(--px-bg3)",
        }}
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          } else {
            setShowIosGuide((prev) => !prev);
          }
        }}
      >
        앱으로 설치하기
      </button>
      {showIosGuide && (
        <p className="ui-hint">
          iPhone Safari에서 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.
        </p>
      )}
    </div>
  );
}
