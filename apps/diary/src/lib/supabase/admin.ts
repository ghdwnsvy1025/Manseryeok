import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * 서비스 역할 클라이언트. RLS를 우회하므로 운세 캐시처럼 서버만 쓰는 테이블에만 쓴다.
 * 사용자 데이터를 읽고 쓸 때는 server.ts의 클라이언트를 쓴다.
 */
export function adminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 필요합니다 (.env.local).");
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
