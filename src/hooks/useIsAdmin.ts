"use client";

import { useEffect, useState } from "react";

/**
 * 서버 ADMIN_EMAILS 기준 관리자 여부.
 * 일반 사용자 배포 UI에서 OpenAI/디버그 노출 게이트로 사용.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/whoami", { method: "GET" });
        const data = (await res.json()) as { admin?: boolean };
        if (!cancelled) setIsAdmin(Boolean(data.admin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return isAdmin;
}
