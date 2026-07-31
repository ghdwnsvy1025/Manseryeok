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

/**
 * Cookie 세션 기준 로그인 사용자 필수.
 * LLM·유료 API 경로에서 사용.
 */
export async function requireAuthUser(): Promise<AuthOk | AuthFail> {
  const client = getSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      response: Response.json(
        { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: Response.json(
        { error: "로그인이 필요합니다.", code: "AUTH_REQUIRED" },
        { status: 401 }
      ),
    };
  }

  return { ok: true, user, client };
}
