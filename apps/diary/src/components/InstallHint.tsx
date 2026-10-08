"use client";

import { useEffect, useState } from "react";

type Env = "standalone" | "kakao-ios" | "kakao-android" | "ios" | "android" | "desktop" | "unknown";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** 홈 화면에 앱으로 두는 방법. 설치돼 있으면 아무것도 보여 주지 않는다 */
export function InstallHint() {
  const [env, setEnv] = useState<Env>("unknown");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const kakao = /KAKAOTALK/i.test(ua);
    const android = /android/i.test(ua);
    if (standalone) setEnv("standalone");
    else if (kakao) setEnv(ios ? "kakao-ios" : "kakao-android");
    else if (ios) setEnv("ios");
    else if (android) setEnv("android");
    else setEnv("desktop");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (env === "standalone" || env === "unknown") return null;

  const steps: Record<Exclude<Env, "standalone" | "unknown">, string[]> = {
    "kakao-ios": ["카톡 오른쪽 위 ··· 을 눌러요", "「Safari로 열기」를 골라요", "Safari 아래 공유 → 「홈 화면에 추가」"],
    "kakao-android": ["카톡 오른쪽 위 ··· 을 눌러요", "「다른 브라우저로 열기」로 Chrome에서 열어요", "Chrome 메뉴(⋮) → 「홈 화면에 추가」"],
    ios: ["Safari 아래 공유 버튼을 눌러요", "「홈 화면에 추가」를 골라요", "확인을 누르면 아이콘이 생겨요"],
    android: ["브라우저 메뉴(⋮)를 눌러요", "「앱 설치」또는 「홈 화면에 추가」", "설치하면 홈 화면에서 바로 열려요"],
    desktop: ["주소창 오른쪽 설치 아이콘을 눌러요", "또는 메뉴 → 「앱 설치」"],
  };

  return (
    <div className="border-t border-line/40 pt-4">
      <p className="text-[15px] font-bold">홈 화면에 앱으로 두기</p>
      {/* 아이폰만 앱으로 두어야 알림이 온다 — 안드로이드·데스크톱엔 이 줄이 틀린 말 (전수조사 C) */}
      {(env === "ios" || env === "kakao-ios") && <p className="mt-0.5 text-sm text-muted">저녁 알림은 앱으로 두어야 받을 수 있어요.</p>}
      {promptEvent ? (
        <button
          type="button"
          onClick={() => promptEvent.prompt().finally(() => setPromptEvent(null))}
          className="mt-3 h-11 rounded-full border border-frame bg-transparent px-4 text-sm font-bold text-ink"
        >
          앱으로 설치
        </button>
      ) : (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink/85">
          {steps[env].map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
