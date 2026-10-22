"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { initAnalytics, syncAuth, trackPageview } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

/** 경로·쿼리가 바뀔 때마다 $pageview 하나. useSearchParams는 Suspense 안에서만 (Next 규칙) */
function Pageview() {
  const pathname = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (!pathname) return;
    const q = search?.toString();
    trackPageview(`${window.location.origin}${pathname}${q ? `?${q}` : ""}`);
  }, [pathname, search]);
  return null;
}

function toUser(session: Session | null) {
  if (!session) return null;
  const u = session.user;
  const provider = u.app_metadata?.provider;
  return { id: u.id, isAnonymous: Boolean(u.is_anonymous), provider: typeof provider === "string" ? provider : undefined };
}

/**
 * 세션 → identify/reset. onAuthStateChange는 구독 직후 INITIAL_SESSION을 바로 한 번 주므로 getSession을 따로 부르지 않는다.
 * 서버 액션(로그아웃·기록 모두 지우기)이 쿠키를 바꾼 뒤 redirect로 돌아오면 같은 탭의 이벤트가 없다 — AnonBoot처럼 경로가 바뀔 때 다시 구독해 쿠키를 다시 읽는다.
 */
function AuthSync() {
  const pathname = usePathname();
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      void syncAuth(toUser(session));
    });
    return () => data.subscription.unsubscribe();
  }, [pathname]);
  return null;
}

/** layout에 한 번. 화면은 그리지 않는다 */
export function Analytics() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return (
    <>
      <Suspense fallback={null}>
        <Pageview />
      </Suspense>
      <AuthSync />
    </>
  );
}
