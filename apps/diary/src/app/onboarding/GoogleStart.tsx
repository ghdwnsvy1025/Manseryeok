"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LinkReturnNote, useLinkReturn } from "@/components/LinkGoogleButton";
import { track } from "@/lib/analytics";
import { anonymousNow, callbackHref, clearLinkPending, markLinkPending, ONBOARDING_LINK_NEXT } from "@/lib/googleLink";
import { createClient } from "@/lib/supabase/client";

/** 폼의 제출 버튼 중 이것을 눌렀다는 표시 (ProfileForm이 submitter로 읽어 then=google을 붙인다) */
export const GOOGLE_SUBMIT = "google";

/**
 * 첫 화면의 "Google로 기록 지키며 시작" (디자인 명세 30 3절, ANON_START.md 7절). 익명 첫 온보딩에서만 그린다.
 * 폼의 두 번째 제출 버튼이다 — 생년월일을 먼저 저장하고(서버 액션이 then: "google"로 돌아온다) `saved`가 바뀌면
 * 이 익명 계정에 Google을 붙이러 간다(linkIdentity, 같은 user_id). 돌아오는 곳은 /welcome.
 * 연결이 안 돼도(취소·이미 다른 계정) 기록은 만들어졌으니 내 카드로 이어 갈 수 있게 "그냥 내 카드 보기"를 둔다.
 * 홈 화면 앱은 Google 화면이 앱 밖에서 끝나므로, 돌아오면 useLinkReturn이 토큰을 갱신해 확인한다 — 연결됐으면 /welcome.
 */
export function GoogleStart({ disabled, saved }: { disabled: boolean; saved: object | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { status, recheck } = useLinkReturn(useCallback(() => setBusy(false), []));

  useEffect(() => {
    if (status === "linked") router.push(ONBOARDING_LINK_NEXT);
  }, [status, router]);

  useEffect(() => {
    if (!saved) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError(null);
      const supabase = createClient();
      const now = await anonymousNow(supabase.auth);
      if (cancelled) return;
      if (now !== true) {
        // 이미 Google 계정이거나 세션이 없다 — 붙일 것이 없으니 저장된 생년월일로 내 카드로
        clearLinkPending();
        router.push(ONBOARDING_LINK_NEXT);
        return;
      }
      track("login_start", { provider: "google", mode: "link", from: "onboarding" });
      markLinkPending();
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: callbackHref(window.location.origin, "link", ONBOARDING_LINK_NEXT) },
      });
      // 성공하면 Google 화면으로 넘어가므로 여기까지 오면 실패한 것
      if (error && !cancelled) {
        console.error("Google 연결(첫 화면)", error);
        clearLinkPending();
        setError("Google 창을 열지 못했어요. 다시 누르거나, 지금은 그냥 시작해요.");
        setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saved, router]);

  const stuck = error !== null || status === "unconfirmed";

  return (
    <div className="-mt-3 flex flex-col gap-2">
      <button
        type="submit"
        data-then={GOOGLE_SUBMIT}
        disabled={disabled || busy || status === "checking" || status === "linked"}
        className="flex h-13 items-center justify-center rounded-xl border border-frame text-[16px] font-bold text-ink disabled:opacity-60"
      >
        {busy ? "Google로 이동하는 중…" : "Google로 기록 지키며 시작"}
      </button>
      <p className="px-1 text-center text-[14px] text-muted">폰을 바꾸거나 앱을 지워도 기록이 그대로예요</p>
      <LinkReturnNote status={status} recheck={recheck} />
      {error && (
        <p role="alert" className="text-[15px] text-danger">
          {error}
        </p>
      )}
      {stuck && (
        <Link href={ONBOARDING_LINK_NEXT} className="tap text-center text-[15px] text-ink underline underline-offset-4">
          그냥 내 카드 보기
        </Link>
      )}
    </div>
  );
}
