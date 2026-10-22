"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import type { Props } from "@/lib/analytics/core";

/**
 * 서버 컴포넌트 화면이 열렸을 때 이벤트 하나 (예: stats_view, diary_saved).
 * once를 주면 그 열쇠로 이 탭에서 한 번만 — 새로고침·뒤로가기로 같은 화면이 다시 그려져도 두 번 세지 않는다.
 */
export function TrackOnMount({ event, props, once }: { event: string; props?: Props; once?: string }) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    if (once) {
      try {
        const k = `ph_once:${once}`;
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
      } catch {
        /* 저장소를 못 쓰면 그냥 보낸다 */
      }
    }
    track(event, JSON.parse(key) as Props);
  }, [event, key, once]);
  return null;
}
