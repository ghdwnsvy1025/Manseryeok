"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { ONBOARDING_FLAG } from "@/lib/analytics/core";

/**
 * /welcome에 한 번. 온보딩 폼이 제출 직전 sessionStorage에 남긴 표(first | edit)를 읽어 onboarding_done을 보내고 지운다.
 * 표가 없으면(새로고침·직접 접근) 보내지 않는다. 서버 액션의 redirect라 폼 쪽에서는 성공을 알 수 없어 이렇게 잇는다.
 */
export function OnboardingDoneTrack() {
  useEffect(() => {
    let mode: string | null = null;
    try {
      mode = sessionStorage.getItem(ONBOARDING_FLAG);
      if (mode) sessionStorage.removeItem(ONBOARDING_FLAG);
    } catch {
      /* 저장소 없음 */
    }
    if (mode) track("onboarding_done", { mode });
  }, []);
  return null;
}
