import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserRow, getSajuProfile } from "@/lib/db";

/**
 * Google 로그인·연결(linkIdentity)에서 돌아오는 곳. 레거시와 같은 경로라 Supabase 리디렉트 허용 목록을 그대로 쓴다.
 * 연결이면 코드 교환 뒤 같은 user_id의 is_anonymous가 false가 되고 기록은 그대로다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  // Supabase가 오류를 쿼리로 돌려준 경우. 연결하려던 Google이 이미 다른 계정에 묶여 있으면 identity_already_exists
  const providerError = searchParams.get("error");
  if (providerError) {
    const desc = `${searchParams.get("error_code") ?? ""} ${searchParams.get("error_description") ?? ""}`;
    console.error("auth callback provider error", providerError, desc);
    const kind = /identity.*(exist|linked)|already/i.test(desc) ? "link" : "1";
    const back = next.startsWith("/settings") ? "/settings" : "/login";
    const to = new URL(back, origin);
    to.searchParams.set("error", kind);
    if (back === "/login") to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }

  if (!code) return NextResponse.redirect(new URL("/login?error=1", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("auth callback", error);
    return NextResponse.redirect(new URL("/login?error=1", origin));
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
