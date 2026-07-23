"use client";

import { useEffect } from "react";

/**
 * 구 버전 JS가 Service Worker / Cache Storage에 남으면
 * ShellContent hydration 오류가 반복된다.
 * 개발 중에는 항상 해제하고, 프로덕션도 한 번 정리 후 새 sw만 등록.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const clearCaches = async () => {
      if (!("caches" in window)) return;
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    };

    const unregisterAll = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
      await clearCaches();
    };

    if (process.env.NODE_ENV !== "production") {
      void unregisterAll();
      return;
    }

    void (async () => {
      // 예전 캐시(saju-diary-shell-v1 등) 제거 후 새 SW 등록
      await clearCaches();
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const script = reg.active?.scriptURL || reg.installing?.scriptURL || "";
        // 구 스크립트면 해제
        if (script.includes("/sw.js")) {
          await reg.unregister();
        }
      }

      const register = () => {
        void navigator.serviceWorker.register("/sw.js?v=2", { scope: "/" });
      };

      if (document.readyState === "complete") {
        register();
        return;
      }
      window.addEventListener("load", register, { once: true });
    })();
  }, []);

  return null;
}
