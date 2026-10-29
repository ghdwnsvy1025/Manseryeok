import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { ensureUserRow, getSajuProfile } from "@/lib/db";
import { alreadyLinkedKind, callbackMode, exchangeFailTarget, providerErrorTarget, verifierCookieName } from "@/lib/googleLink";
import { safeNext } from "@/lib/safeNext";

/**
 * Google 로그인·연결(linkIdentity)에서 돌아오는 곳. 레거시와 같은 경로라 Supabase 리디렉트 허용 목록을 그대로 쓴다.
 * 연결이면 코드 교환 뒤 같은 user_id의 is_anonymous가 false가 되고 기록은 그대로다.
 *
 * iOS 홈 화면 앱에서 누르면 이 요청은 앱이 아니라 Safari·인앱 브라우저 쿠키로 온다 (docs/ANON_START.md 6절).
 * 버튼을 누른 창인지(here)는 PKCE verifier 쿠키로 가르고, 다른 창이면 그 창의 계정을 건드리지 않고 `/auth/done` 안내로 보낸다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const mode = callbackMode(searchParams.get("mode"));
  const here = request.cookies.has(verifierCookieName(supabaseEnv().url));

  // Supabase가 오류를 쿼리로 돌려준 경우. 연결하려던 Google이 이미 묶여 있으면 identity_already_exists —
  // 다른 계정에 묶였으면 실패, 바로 이 계정에 묶였으면(먼저 누른 연결이 이미 끝남) 성공으로 본다
  const providerError = searchParams.get("error");
  if (providerError) {
    const desc = `${searchParams.get("error_code") ?? ""} ${searchParams.get("error_description") ?? ""}`;
    const linked = alreadyLinkedKind(desc);
    if (linked !== "self") console.error("auth callback provider error", providerError, desc, { mode, here });
    return NextResponse.redirect(new URL(providerErrorTarget({ linked, here, mode, next }), origin));
  }

  if (!code) return NextResponse.redirect(new URL("/login?error=1", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("auth callback", error, { mode, here });
    return NextResponse.redirect(new URL(exchangeFailTarget({ here, mode, next }), origin));
  }

  try {
    await ensureUserRow(supabase, data.user.id);
    // 생년월일을 아직 안 넣었으면 먼저 받는다
    const profile = await getSajuProfile(supabase, data.user.id);
    if (!profile) {
      return NextResponse.redirect(new URL(`/onboarding?next=${encodeURIComponent(next)}`, origin));
    }
  } catch (e) {
    console.error("auth callback db", e);
  }
  return NextResponse.redirect(new URL(next, origin));
}
