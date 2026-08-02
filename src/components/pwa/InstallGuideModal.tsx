"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isIosDevice } from "@/lib/pwa/installState";
import { ANALYTICS_EVENTS, captureEvent } from "@/lib/analytics/posthog";

const PARAM = "install_guide";

function urlWithoutInstallGuideParam(): string {
  if (typeof window === "undefined") return "/";
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/**
 * 카톡 인앱 → 외부 브라우저로 넘어온 뒤(?install_guide=1) 홈 화면 추가 방법을 안내.
 * openInExternalBrowser가 붙인 쿼리 파라미터를 감지해 자동으로 열린다.
 */
export default function InstallGuideModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(PARAM) !== "1") return;
    setIos(isIosDevice());
    setOpen(true);
    captureEvent(ANALYTICS_EVENTS.installPromptShown, {
      surface: "install_guide_modal",
    });
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    router.replace(urlWithoutInstallGuideParam());
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4 motion-modal-backdrop"
      style={{ background: "rgba(0,0,0,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-label="앱 설치 안내"
      onClick={close}
    >
      <div
        className="w-full max-w-sm p-4 border-2 space-y-3 motion-modal-card"
        style={{
          background: "var(--px-bg2)",
          borderColor: "var(--px-accent)",
          boxShadow: "4px 4px 0 #000",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <p
            className="text-[15px] font-black leading-snug"
            style={{ color: "var(--px-text-on-panel)" }}
          >
            홈 화면에 앱으로 추가하기
          </p>
          <button
            type="button"
            className="shrink-0 text-[12px] font-bold px-2 py-1"
            style={{ color: "var(--px-text2)", background: "transparent" }}
            onClick={close}
            aria-label="닫기"
          >
            닫기
          </button>
        </div>

        <p
          className="text-[12px] leading-snug"
          style={{ color: "var(--px-text2)" }}
        >
          이제 이 브라우저에서 아래 순서로 홈 화면에 추가할 수 있어요.
        </p>

        <ol
          className="text-[13px] font-bold list-decimal pl-4 space-y-1.5"
          style={{ color: "var(--px-text-on-panel)" }}
        >
          {ios ? (
            <>
              <li>하단(또는 상단) 공유 버튼을 눌러요</li>
              <li>「홈 화면에 추가」를 선택해요</li>
              <li>오른쪽 위 「추가」를 누르면 완료돼요</li>
            </>
          ) : (
            <>
              <li>오른쪽 위 메뉴(⋮)를 눌러요</li>
              <li>「앱 설치」또는 「홈 화면에 추가」를 선택해요</li>
              <li>설치하면 홈 화면에서 바로 열 수 있어요</li>
            </>
          )}
        </ol>

        <button
          type="button"
          className="ui-primary-btn w-full py-3 text-sm font-black"
          onClick={close}
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
