import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserRow, getSajuProfile } from "@/lib/db";

/** Google 로그인에서 돌아오는 곳. 레거시와 같은 경로라 Supabase 리디렉트 허용 목록을 그대로 쓴다. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

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
