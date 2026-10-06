import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";

/**
 * 세션 쿠키 갱신만 한다 (@supabase/ssr 권장 방식).
 * 익명 시작(docs/ANON_START.md) 뒤로는 보호 경로가 없다 — 세션이 없는 첫 요청도 리디렉트하지 않고,
 * 페이지가 "준비 중"을 그리는 사이 AnonBoot(클라이언트)가 익명 세션을 만들고 새로 그린다.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // 토큰이 만료됐으면 여기서 갱신돼 응답 쿠키에 실린다
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)"],
};
