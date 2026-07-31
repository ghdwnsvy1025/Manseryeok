import type { User, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuthOk = {
  ok: true;
  user: User;
  client: SupabaseClient;
};

export type AuthFail = {
  ok: false;
  response: Response;
};

export type OptionalAuth =
  | { ok: true; user: User; client: SupabaseClient }
  | { ok: true; user: null; client: null };

/**
 * Cookie 세션 기준 로그인 사용자 필수.
 * LLM·유료 API 경로에서 사용.
 */
export async function requireAuthUser(): Promise<AuthOk | AuthFail> {
  const optional = await getOptionalAuthUser();
  if (!optional.user || !optional.client) {
    return {
      ok: false,
      response: Response.json(
        { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, user: optional.user, client: optional.client };
}

/**
 * 로그인 있으면 사용자, 없으면 게스트(null).
 * 비로그인 LLM(오늘의 운세 등)에서 사용.
 */
export async function getOptionalAuthUser(): Promise<OptionalAuth> {
  const client = getSupabaseServerClient();
  if (!client) {
    return { ok: true, user: null, client: null };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return { ok: true, user: null, client: null };
  }

  return { ok: true, user, client };
}
