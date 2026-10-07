import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** 서버 컴포넌트·서버 액션·라우트 핸들러용. 로그인한 사용자 권한으로 동작한다 (RLS 적용). */
export async function createClient() {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 미들웨어가 맡는다.
        }
      },
    },
  });
}

/** 화면·액션이 쓰는 사용자 정보. 액세스 토큰(JWT)의 클레임에서 바로 읽는다 — 화면은 id·익명 여부·이메일만 쓴다 */
export interface SessionUser {
  id: string;
  is_anonymous: boolean;
  email: string | null;
}

/**
 * 현재 로그인한 사용자. 없으면 null.
 *
 * `auth.getUser()`(Auth 서버 왕복) 대신 `auth.getClaims()`를 쓴다 — 프로젝트가 비대칭 서명 키(ES256)를 쓰므로
 * JWKS(10분 전역 캐시)로 서명을 로컬에서 검증한다. 요청마다 네트워크를 타는 건 미들웨어의 세션 갱신 하나뿐
 * (docs/전수조사-2026-10-07.md A-2). 쓰기는 어차피 RLS가 토큰으로 지키므로 클레임의 id로 충분하다.
 * signOut·Google 연결처럼 Auth 서버가 필요한 동작은 여기 결과와 무관하게 supabase 클라이언트가 직접 한다.
 */
export async function getUser(): Promise<{ supabase: SupabaseClient; user: SessionUser | null }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return { supabase, user: null };
  return {
    supabase,
    user: {
      id: claims.sub,
      is_anonymous: Boolean(claims.is_anonymous),
      email: typeof claims.email === "string" && claims.email ? claims.email : null,
    },
  };
}
