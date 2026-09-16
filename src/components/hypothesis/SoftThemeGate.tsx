"use client";

/**
 * 감성 톤을 켜고 끄는 스위치.
 *
 * 화면을 그리는 게 아니라 <html> 에 표시만 남긴다.
 * 실제 모양은 globals.css 의 [data-skin="soft"] 블록이 담당한다.
 * 이렇게 하면 컴포넌트를 한 개도 안 고치고 앱 전체 톤이 바뀌고,
 * 플래그를 끄면 표시가 사라져 원래 복고풍으로 즉시 돌아온다.
 */
import { useEffect } from "react";
import { isSoftThemeEnabled } from "@/lib/app/featureFlags";

export default function SoftThemeGate() {
  useEffect(() => {
    if (!isSoftThemeEnabled()) return;

    const root = document.documentElement;
    root.dataset.skin = "soft";
    return () => {
      delete root.dataset.skin;
    };
  }, []);

  return null;
}
