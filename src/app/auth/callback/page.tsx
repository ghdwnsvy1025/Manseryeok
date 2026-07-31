"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { takeAuthNextPath } from "@/lib/auth/redirectOrigin";

/**
 * OAuth / linkIdentity 콜백 — 클라이언트에서 code·hash 모두 처리.
 * (서버 route만 쓰면 hash 토큰·PKCE 쿠키 불일치로 missing_code가 자주 남)
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [hint, setHint] = useState("로그인 마무리 중…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const oauthError =
        url.searchParams.get("error") ||
        url.searchParams.get("error_code") ||
        url.searchParams.get("error_description");

      if (!supabase) {
        router.replace("/diary/login?authError=not_configured");
        return;
      }

      if (oauthError) {
        const raw = decodeURIComponent(String(oauthError));
        const already =
          /already.*(linked|registered|exists)/i.test(raw) ||
          /identity.*another user/i.test(raw);
        router.replace(
          already
            ? "/diary/login?authError=identity_already_exists"
            : "/diary/login?authError=exchange_failed"
        );
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            const already =
              /already.*(linked|registered|exists)/i.test(error.message) ||
              /identity.*another user/i.test(error.message);
            if (!cancelled) {
              router.replace(
                already
                  ? "/diary/login?authError=identity_already_exists"
                  : "/diary/login?authError=exchange_failed"
              );
            }
            return;
          }
        } else {
          // implicit / hash 세션 — detectSessionInUrl이 파싱했는지 확인
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            // hash에 토큰이 있으면 한 번 더 시도
            const hash = url.hash?.replace(/^#/, "") ?? "";
            if (hash.includes("access_token")) {
              setHint("세션을 확인하는 중…");
              await new Promise((r) => setTimeout(r, 400));
              const again = await supabase.auth.getSession();
              if (!again.data.session && !cancelled) {
                router.replace("/diary/login?authError=missing_code");
                return;
              }
            } else if (!cancelled) {
              router.replace("/diary/login?authError=missing_code");
              return;
            }
          }
        }

        const next = takeAuthNextPath("/diary/login?oauth=success");
        if (!cancelled) {
          window.location.replace(next);
        }
      } catch {
        if (!cancelled) {
          router.replace("/diary/login?authError=exchange_failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <p className="ui-hint p-6 text-center" role="status">
      {hint}
    </p>
  );
}
