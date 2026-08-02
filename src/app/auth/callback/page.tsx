"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { takeAuthNextPath } from "@/lib/auth/redirectOrigin";
import { unlockEntry } from "@/lib/auth/entryGate";

/**
 * OAuth / linkIdentity 콜백 — 클라이언트에서 code·hash 모두 처리.
 * React Strict Mode에서 effect가 두 번 돌아도 code를 한 번만 교환한다.
 */
let callbackInflight: Promise<void> | null = null;

export default function AuthCallbackPage() {
  const router = useRouter();
  const [hint, setHint] = useState("로그인 마무리 중…");

  useEffect(() => {
    if (callbackInflight) {
      void callbackInflight;
      return;
    }

    callbackInflight = (async () => {
      const supabase = getSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const oauthError =
        url.searchParams.get("error") ||
        url.searchParams.get("error_code") ||
        url.searchParams.get("error_description");

      const goError = (q: string) => {
        window.location.replace(`/?authError=${q}`);
      };

      if (!supabase) {
        goError("not_configured");
        return;
      }

      if (oauthError) {
        const raw = decodeURIComponent(String(oauthError));
        const already =
          /already.*(linked|registered|exists)/i.test(raw) ||
          /identity.*another user/i.test(raw);
        goError(already ? "identity_already_exists" : "exchange_failed");
        return;
      }

      try {
        if (code) {
          const exchangeKey = `manseryeok_oauth_exchanged:${code}`;
          let alreadyExchanged = false;
          try {
            alreadyExchanged =
              window.sessionStorage.getItem(exchangeKey) === "1";
          } catch {
            /* ignore */
          }

          if (!alreadyExchanged) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              // Strict Mode 재실행·중복 교환: 세션이 이미 있으면 통과
              const { data } = await supabase.auth.getSession();
              if (!data.session?.user) {
                const already =
                  /already.*(linked|registered|exists)/i.test(error.message) ||
                  /identity.*another user/i.test(error.message) ||
                  /code.*(expired|used|invalid)/i.test(error.message);
                goError(
                  already && /identity/i.test(error.message)
                    ? "identity_already_exists"
                    : "exchange_failed"
                );
                return;
              }
            }
            try {
              window.sessionStorage.setItem(exchangeKey, "1");
            } catch {
              /* ignore */
            }
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            const hash = url.hash?.replace(/^#/, "") ?? "";
            if (hash.includes("access_token")) {
              setHint("세션을 확인하는 중…");
              await new Promise((r) => setTimeout(r, 400));
              const again = await supabase.auth.getSession();
              if (!again.data.session) {
                goError("missing_code");
                return;
              }
            } else {
              goError("missing_code");
              return;
            }
          }
        }

        setHint("거의 다 됐어요…");
        for (let i = 0; i < 15; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) break;
          await new Promise((r) => setTimeout(r, 120));
        }

        unlockEntry();
        const next = takeAuthNextPath("/?oauth=success");
        // 상대 경로만 허용 — 절대 URL이면 홈으로
        const safeNext =
          next.startsWith("/") && !next.startsWith("//")
            ? next
            : "/?oauth=success";
        window.location.replace(safeNext);
      } catch {
        goError("exchange_failed");
      }
    })().finally(() => {
      callbackInflight = null;
    });
  }, [router]);

  return (
    <p className="ui-hint p-6 text-center" role="status">
      {hint}
    </p>
  );
}
