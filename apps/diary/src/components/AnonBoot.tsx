"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { bootAnonAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * 첫 방문에 익명 세션을 만든다 (docs/ANON_START.md 1절).
 * 서버(미들웨어)가 아니라 클라이언트에서 — 매 요청마다 시도하는 일을 막는다.
 * 세션이 생기면 router.refresh()로 서버 컴포넌트를 다시 그린다.
 *
 * 경로가 바뀔 때마다 세션을 다시 확인한다 (쿠키만 읽으므로 네트워크 비용 없음).
 * layout에 한 번 마운트되고 서버 액션의 redirect는 소프트 내비게이션이라 마운트 효과가 다시 돌지 않기 때문 —
 * 로그아웃(signOutAction) 뒤에도 세션 없는 화면에 머물지 않게 한다. 로그아웃은 서버에서 바로 새 익명 세션을
 * 만들지만, 그게 실패했을 때의 두 번째 안전망이다.
 */
export function AnonBoot() {
  const router = useRouter();
  const pathname = usePathname();
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session) return;
        const { data: signed, error } = await supabase.auth.signInAnonymously();
        if (error || !signed.user) {
          // 삼키지 않는다 — 화면의 "준비하고 있어요" 카드에 "다시 시도"가 있다 (RetryButton)
          console.error("익명 시작 실패", error ?? new Error("사용자 없음"));
          return;
        }
        try {
          await bootAnonAction();
        } catch (e) {
          console.error("익명 사용자 행 만들기 실패", e);
        }
        router.refresh();
      } finally {
        running.current = false;
      }
    })();
  }, [router, pathname]);

  return null;
}
