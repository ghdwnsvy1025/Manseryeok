"use client";

import { useEffect } from "react";

/** 서비스 워커 등록만 한다. 알림 권한은 사용자가 "나" 화면에서 켤 때 묻는다 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => console.warn("sw 등록 실패", e));
  }, []);
  return null;
}
