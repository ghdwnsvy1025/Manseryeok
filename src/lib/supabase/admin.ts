import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service role client — 서버 전용. RLS를 우회하므로 절대 브라우저에 노출하지 말 것.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY와 NEXT_PUBLIC_SUPABASE_URL이 필요합니다."
    );
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
