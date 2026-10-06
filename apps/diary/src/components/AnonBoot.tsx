"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { bootAnonAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * 첫 방문에 익명 세션을 만든다 (docs/ANON_START.md 1절).
 * 서버(미들웨어)가 아니라 클라이언트에서 한 번만 — 매 요청마다 시도하는 일을 막는다.
 * 세션이 생기면 router.refresh()로 서버 컴포넌트를 다시 그린다.
 */
export function AnonBoot() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      const { data: signed, error } = await supabase.auth.signInAnonymously();
      if (error || !signed.user) {
        console.error("익명 시작 실패", error);
        return;
      }
      try {
        await bootAnonAction();
      } catch (e) {
        console.error("익명 사용자 행 만들기 실패", e);
      }
      router.refresh();
    })();
  }, [router]);

  return null;
}
